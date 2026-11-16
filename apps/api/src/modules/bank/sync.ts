import type { BankLink } from '@subtracker/contracts';
import { getConfig } from '../../core/context';
import { notFound } from '../../core/errors';
import { logger } from '../../core/logger';
import { runDetection } from '../detection/service';
import { getPowensClient, PowensError } from '../powens';
import type { PowensTransaction } from '../powens/client';
import { TransactionModel } from '../transactions/model';
import { BankAccountModel, BankLinkModel, type BankAccountDoc, type BankLinkDoc } from './models';
import { mapConnectionState } from './status';
import { powensToken, toBankLinkDto } from './service';

const LOCK_MS = 5 * 60 * 1000;
const inFlight = new Set<Promise<unknown>>();

/** Pour les tests : attend la fin des synchronisations lancées en arrière-plan. */
export async function waitForSyncs(): Promise<void> {
  while (inFlight.size > 0) await Promise.allSettled([...inFlight]);
}

export function scheduleSync(userId: string, options: { reason: string; fullResync?: boolean }): void {
  const task = syncUser(userId, options)
    .catch((error) => logger.error({ err: error, reason: options.reason }, 'Synchronisation en échec'))
    .finally(() => inFlight.delete(task));
  inFlight.add(task);
}

/** Met à jour la liste locale des comptes depuis Powens (consentement géré par la Webview). */
export async function refreshAccounts(userId: string): Promise<void> {
  const link = await BankLinkModel.findOne({ userId }).lean<BankLinkDoc>();
  if (!link) return;
  const accounts = await getPowensClient().listAccounts(powensToken(link));
  for (const account of accounts) {
    if (account.deleted) continue;
    await BankAccountModel.updateOne(
      { userId, source: 'powens', externalId: String(account.id) },
      {
        $set: {
          bankLinkId: link._id,
          name: account.name ?? account.original_name ?? `Compte ${account.id}`,
          type: account.type ?? null,
          currency: account.currency?.id ?? 'EUR',
          balanceCents: typeof account.balance === 'number' ? Math.round(account.balance * 100) : null,
          sharedWithApp: !account.disabled,
          lastUpdate: account.last_update ? new Date(account.last_update.replace(' ', 'T') + 'Z') : null,
        },
        $setOnInsert: { analyzed: true },
      },
      { upsert: true },
    );
  }
}

function retentionCutoff(): string {
  const years = getConfig().DATA_RETENTION_YEARS;
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
}

/**
 * Synchronisation en pull, idempotente :
 * 1. état de la connexion ; 2. comptes ; 3. transactions modifiées depuis le curseur
 * (débits uniquement, comptes analysés) ; 4. détection.
 * Un verrou par utilisateur empêche deux synchronisations simultanées.
 */
export async function syncUser(
  userId: string,
  options: { fullResync?: boolean } = {},
): Promise<{ skipped: boolean; imported: number }> {
  const now = new Date();
  const link = await BankLinkModel.findOneAndUpdate(
    {
      userId,
      connectionId: { $ne: null },
      status: { $ne: 'disconnected' },
      $or: [{ syncLockUntil: null }, { syncLockUntil: { $lt: now } }],
    },
    { $set: { syncLockUntil: new Date(now.getTime() + LOCK_MS), lastSyncAttemptAt: now } },
    { returnDocument: 'after' },
  ).lean<BankLinkDoc>();
  if (!link?.connectionId) return { skipped: true, imported: 0 };

  const client = getPowensClient();
  const token = powensToken(link);
  let imported = 0;
  try {
    const connection = await client.getConnection(token, link.connectionId);
    const status = connection.last_update || connection.state ? mapConnectionState(connection.state) : 'pending';
    await BankLinkModel.updateOne(
      { _id: link._id },
      {
        $set: {
          status,
          powensState: connection.state ?? null,
          powensMessage: connection.error_message ?? null,
          consentExpiresAt: connection.expire ? new Date(connection.expire) : null,
          connectorName: connection.connector?.name ?? link.connectorName ?? null,
        },
      },
    );

    await refreshAccounts(userId);
    const accounts = await BankAccountModel.find({
      userId,
      source: 'powens',
      analyzed: true,
      sharedWithApp: true,
    }).lean<BankAccountDoc[]>();
    const accountByExternalId = new Map(accounts.map((account) => [account.externalId, account]));
    const cutoff = retentionCutoff();
    let cursor = options.fullResync ? null : (link.txCursor ?? null);
    let maxLastUpdate = cursor;

    for await (const page of client.iterateTransactions(token, cursor)) {
      for (const tx of page) {
        if (tx.last_update && (!maxLastUpdate || tx.last_update > maxLastUpdate)) maxLastUpdate = tx.last_update;
        const account = accountByExternalId.get(String(tx.id_account));
        if (!account) continue;
        if (await upsertTransaction(userId, account, tx, cutoff)) imported += 1;
      }
    }
    cursor = maxLastUpdate;

    await BankLinkModel.updateOne(
      { _id: link._id },
      { $set: { lastSyncAt: new Date(), txCursor: cursor, lastSyncError: null } },
    );
    await runDetection(userId);
    return { skipped: false, imported };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    const set: Record<string, unknown> = { lastSyncError: message };
    if (error instanceof PowensError && error.code) {
      set.status = mapConnectionState(error.code);
      set.powensState = error.code;
    }
    await BankLinkModel.updateOne({ _id: link._id }, { $set: set });
    throw error;
  } finally {
    await BankLinkModel.updateOne({ _id: link._id }, { $set: { syncLockUntil: null } });
  }
}

/** Débits uniquement (décision D2), dans la fenêtre de rétention. Retourne vrai si écrit. */
async function upsertTransaction(
  userId: string,
  account: BankAccountDoc,
  tx: PowensTransaction,
  retentionCutoff: string,
): Promise<boolean> {
  const filter = { userId, source: 'powens' as const, externalId: String(tx.id) };
  if (tx.value === null || tx.value >= 0 || tx.date < retentionCutoff) {
    // Une opération devenue crédit ou trop ancienne ne doit pas rester en base.
    await TransactionModel.deleteOne(filter);
    return false;
  }
  await TransactionModel.updateOne(
    filter,
    {
      $set: {
        accountId: account._id,
        date: tx.date.slice(0, 10),
        amountCents: Math.round(tx.value * 100),
        currency: account.currency ?? 'EUR',
        rawLabel: tx.original_wording ?? tx.wording ?? tx.simplified_wording ?? '',
        simplifiedLabel: tx.simplified_wording ?? null,
        counterpartyLabel: tx.counterparty?.label ?? null,
        bankType: tx.type ?? null,
        coming: Boolean(tx.coming),
        deletedAt: tx.deleted ? new Date(tx.deleted.replace(' ', 'T') + 'Z') : null,
        remoteUpdatedAt: tx.last_update ? new Date(tx.last_update.replace(' ', 'T') + 'Z') : null,
      },
    },
    { upsert: true },
  );
  return true;
}

/** Bouton « Actualiser » : l'utilisateur est présent, on demande à la banque puis on synchronise. */
export async function requestBankRefresh(userId: string): Promise<BankLink> {
  const link = await BankLinkModel.findOne({ userId }).lean<BankLinkDoc>();
  if (!link?.connectionId) throw notFound('Connexion bancaire');
  try {
    const connection = await getPowensClient().syncConnection(powensToken(link), link.connectionId);
    await BankLinkModel.updateOne(
      { _id: link._id },
      {
        $set: {
          status: mapConnectionState(connection.state),
          powensState: connection.state ?? null,
          powensMessage: connection.error_message ?? null,
        },
      },
    );
  } catch (error) {
    if (!(error instanceof PowensError)) throw error;
    await BankLinkModel.updateOne(
      { _id: link._id },
      { $set: { status: mapConnectionState(error.code), powensState: error.code, powensMessage: error.message } },
    );
  }
  scheduleSync(userId, { reason: 'manual_refresh' });
  const updated = await BankLinkModel.findOne({ userId }).lean<BankLinkDoc>();
  return toBankLinkDto(updated!);
}

/** Pendant la première synchronisation, la lecture du lien relance un pull si nécessaire (sans webhook). */
export async function nudgePendingSync(link: BankLinkDoc): Promise<void> {
  const now = Date.now();
  const locked = link.syncLockUntil && link.syncLockUntil.getTime() > now;
  const recent = link.lastSyncAttemptAt && now - link.lastSyncAttemptAt.getTime() < 20_000;
  if (link.status === 'pending' && link.connectionId && !locked && !recent) {
    scheduleSync(link.userId.toString(), { reason: 'pending_poll' });
  }
}
