import type { BankLink } from '@subtracker/contracts';
import { getConfig } from '../../core/context';
import { notFound } from '../../core/errors';
import { logger } from '../../core/logger';
import { runDetection } from '../detection/service';
import { getPowensClient, PowensError } from '../powens';
import type { PowensTransaction } from '../powens/client';
import { TransactionModel } from '../transactions/model';
import { BankAccountModel, BankLinkModel, type BankAccountDoc, type BankLinkDoc } from './models';
import { linkFieldsFromConnection, mapConnectionState } from './status';
import { powensToken, toBankLinkDto } from './service';

const SYNC_LOCK_MS = 5 * 60 * 1000;
const PENDING_POLL_INTERVAL_MS = 20_000;
const inFlight = new Set<Promise<unknown>>();

/** Pour les tests : les synchronisations tournent en arrière-plan. */
export async function waitForSyncs(): Promise<void> {
  while (inFlight.size > 0) await Promise.allSettled([...inFlight]);
}

export function scheduleSync(userId: string, options: { reason: string; fullResync?: boolean }): void {
  const task = syncUser(userId, options)
    .catch((error) => logger.error({ err: error, reason: options.reason }, 'Synchronisation en échec'))
    .finally(() => inFlight.delete(task));
  inFlight.add(task);
}

/** Powens renvoie ses horodatages en UTC, au format `AAAA-MM-JJ HH:MM:SS`. */
function parsePowensDate(value: string): Date {
  return new Date(value.replace(' ', 'T') + 'Z');
}

/** Le partage des comptes avec l'application se gère dans la Webview Powens, pas ici. */
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
          lastUpdate: account.last_update ? parsePowensDate(account.last_update) : null,
        },
        $setOnInsert: { analyzed: true },
      },
      { upsert: true },
    );
  }
}

/** Date civile la plus ancienne conservée (rétention, décision D4). */
export function retentionCutoff(now = new Date()): string {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - getConfig().DATA_RETENTION_YEARS);
  return cutoff.toISOString().slice(0, 10);
}

/** Pull idempotent ; le verrou `syncLockUntil` empêche deux synchronisations simultanées d'un même utilisateur. */
async function syncUser(
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
    { $set: { syncLockUntil: new Date(now.getTime() + SYNC_LOCK_MS), lastSyncAttemptAt: now } },
    { returnDocument: 'after' },
  ).lean<BankLinkDoc>();
  if (!link?.connectionId) return { skipped: true, imported: 0 };

  const client = getPowensClient();
  const token = powensToken(link);
  let imported = 0;
  try {
    const connection = await client.getConnection(token, link.connectionId);
    await BankLinkModel.updateOne(
      { _id: link._id },
      { $set: linkFieldsFromConnection(connection, link.connectorName) },
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
    const cursor = options.fullResync ? null : (link.txCursor ?? null);
    let latestUpdate = cursor;

    for await (const page of client.iterateTransactions(token, cursor)) {
      for (const tx of page) {
        if (tx.last_update && (!latestUpdate || tx.last_update > latestUpdate)) latestUpdate = tx.last_update;
        const account = accountByExternalId.get(String(tx.id_account));
        if (!account) continue;
        if (await upsertTransaction(userId, account, tx, cutoff)) imported += 1;
      }
    }

    await BankLinkModel.updateOne(
      { _id: link._id },
      { $set: { lastSyncAt: new Date(), txCursor: latestUpdate, lastSyncError: null } },
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

/** Débits uniquement (décision D2), dans la fenêtre de rétention. Renvoie `true` si la transaction est écrite. */
async function upsertTransaction(
  userId: string,
  account: BankAccountDoc,
  tx: PowensTransaction,
  cutoffDate: string,
): Promise<boolean> {
  const filter = { userId, source: 'powens' as const, externalId: String(tx.id) };
  if (tx.value === null || tx.value >= 0 || tx.date < cutoffDate) {
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
        deletedAt: tx.deleted ? parsePowensDate(tx.deleted) : null,
        remoteUpdatedAt: tx.last_update ? parsePowensDate(tx.last_update) : null,
      },
    },
    { upsert: true },
  );
  return true;
}

/** Bouton « Actualiser » : l'utilisateur est présent, on peut donc demander à la banque (SCA possible). */
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
  if (!updated) throw notFound('Connexion bancaire');
  return toBankLinkDto(updated);
}

/** Sans webhook, la première synchronisation avance grâce aux lectures du lien par l'application. */
export async function nudgePendingSync(link: BankLinkDoc): Promise<void> {
  const now = Date.now();
  const locked = link.syncLockUntil && link.syncLockUntil.getTime() > now;
  const recent = link.lastSyncAttemptAt && now - link.lastSyncAttemptAt.getTime() < PENDING_POLL_INTERVAL_MS;
  if (link.status === 'pending' && link.connectionId && !locked && !recent) {
    scheduleSync(link.userId.toString(), { reason: 'pending_poll' });
  }
}
