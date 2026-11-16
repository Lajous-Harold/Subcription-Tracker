import { Types } from 'mongoose';
import type {
  BankAccount,
  BankLink,
  CompleteConnectSessionBody,
  ConnectSessionResponse,
  CreateConnectSessionBody,
} from '@subtracker/contracts';
import { getConfig } from '../../core/context';
import { decrypt, encrypt, randomToken, sha256 } from '../../core/crypto';
import { AppError, badRequest, conflict, notFound } from '../../core/errors';
import { logger } from '../../core/logger';
import { getPowensClient, PowensError } from '../powens';
import { TransactionModel } from '../transactions/model';
import { PaymentModel } from '../subscriptions/models';
import {
  BankAccountModel,
  BankLinkModel,
  ConnectSessionModel,
  PowensCleanupModel,
  type BankAccountDoc,
  type BankLinkDoc,
} from './models';
import { isConsentExpiringSoon, mapConnectionState } from './status';
import { refreshAccounts, scheduleSync } from './sync';

const CONNECT_SESSION_TTL_MS = 30 * 60 * 1000;

export function powensToken(link: Pick<BankLinkDoc, 'powensTokenEnc'>): string {
  return decrypt(link.powensTokenEnc, getConfig().TOKEN_ENCRYPTION_KEY);
}

export function toBankLinkDto(link: BankLinkDoc, now = new Date()): BankLink {
  return {
    id: link._id.toString(),
    status: link.status,
    connectorName: link.connectorName ?? null,
    providerState: link.powensState ?? null,
    providerMessage: link.powensMessage ?? null,
    consentExpiresAt: link.consentExpiresAt?.toISOString() ?? null,
    consentExpiringSoon: link.status !== 'disconnected' && isConsentExpiringSoon(link.consentExpiresAt, now),
    lastSyncAt: link.lastSyncAt?.toISOString() ?? null,
    syncInProgress: Boolean(link.syncLockUntil && link.syncLockUntil.getTime() > now.getTime()),
    createdAt: link.createdAt.toISOString(),
  };
}

export function toBankAccountDto(account: BankAccountDoc): BankAccount {
  return {
    id: account._id.toString(),
    name: account.name,
    type: account.type ?? null,
    currency: account.currency ?? 'EUR',
    balanceCents: account.balanceCents ?? null,
    sharedWithApp: account.sharedWithApp,
    analyzed: account.analyzed,
    lastUpdate: account.lastUpdate?.toISOString() ?? null,
  };
}

export async function getBankLink(userId: string): Promise<BankLink | null> {
  const link = await BankLinkModel.findOne({ userId }).lean<BankLinkDoc>();
  return link ? toBankLinkDto(link) : null;
}

/** Crée l'utilisateur Powens au premier besoin. Le token est chiffré et ne quitte jamais le backend. */
async function ensureBankLink(userId: string): Promise<BankLinkDoc> {
  const existing = await BankLinkModel.findOne({ userId }).lean<BankLinkDoc>();
  if (existing) return existing;
  const created = await getPowensClient().createUser();
  try {
    const doc = await BankLinkModel.create({
      userId,
      powensUserId: created.powensUserId,
      powensTokenEnc: encrypt(created.token, getConfig().TOKEN_ENCRYPTION_KEY),
      status: 'pending',
    });
    return doc.toObject() as BankLinkDoc;
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const raced = await BankLinkModel.findOne({ userId }).lean<BankLinkDoc>();
      if (raced) return raced;
    }
    throw error;
  }
}

export async function createConnectSession(
  userId: string,
  body: CreateConnectSessionBody,
): Promise<ConnectSessionResponse> {
  const config = getConfig();
  const existing = await BankLinkModel.findOne({ userId }).lean<BankLinkDoc>();
  if (body.flow === 'connect' && existing?.connectionId && existing.status !== 'disconnected') {
    throw conflict(
      'bank_already_connected',
      'Une connexion bancaire existe déjà',
      'Une seule connexion est possible pour le moment.',
    );
  }
  if (body.flow !== 'connect' && !existing?.connectionId) {
    throw conflict('no_bank_connection', 'Aucune connexion bancaire à gérer');
  }

  const link = await ensureBankLink(userId);
  const client = getPowensClient();
  const code = await client.getTemporaryCode(powensToken(link));
  const state = randomToken(32);
  const expiresAt = new Date(Date.now() + CONNECT_SESSION_TTL_MS);
  await ConnectSessionModel.create({
    stateHash: sha256(state),
    userId,
    flow: body.flow,
    platform: body.platform,
    expiresAt,
  });
  const redirectUri = body.platform === 'web' ? config.POWENS_REDIRECT_URI_WEB : config.POWENS_REDIRECT_URI_NATIVE;
  return {
    url: client.buildWebviewUrl({
      flow: body.flow,
      code,
      state,
      redirectUri,
      connectionId: body.flow === 'connect' ? null : link.connectionId,
    }),
    redirectUri,
    expiresAt: expiresAt.toISOString(),
  };
}

const WEBVIEW_ERRORS: Record<string, string> = {
  access_denied: 'Connexion annulée',
  tos_declined: 'Conditions d’utilisation refusées',
  server_error: 'Erreur côté Powens, réessayez plus tard',
};

/**
 * Retour de la Webview. Le `state` (usage unique, lié à l'utilisateur) prouve que le parcours
 * a été lancé par cet utilisateur ; la relecture de la connexion avec SON token Powens prouve
 * qu'elle lui appartient.
 */
export async function completeConnectSession(userId: string, body: CompleteConnectSessionBody): Promise<BankLink> {
  const session = await ConnectSessionModel.findOneAndUpdate(
    { stateHash: sha256(body.state), userId, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  );
  if (!session) throw badRequest('invalid_state', 'Session de connexion invalide ou expirée');

  if (body.error) {
    throw new AppError(
      400,
      `webview_${body.error}`,
      WEBVIEW_ERRORS[body.error] ?? 'Connexion bancaire interrompue',
      body.errorDescription,
    );
  }

  const link = await BankLinkModel.findOne({ userId }).lean<BankLinkDoc>();
  if (!link) throw notFound('Lien bancaire');

  const connectionId = body.connectionId ? Number(body.connectionId) : link.connectionId;
  if (session.flow === 'connect' && !body.connectionId) {
    throw badRequest('missing_connection', 'Identifiant de connexion manquant');
  }
  if (!connectionId) throw badRequest('missing_connection', 'Identifiant de connexion manquant');

  const client = getPowensClient();
  let connection;
  try {
    connection = await client.getConnection(powensToken(link), connectionId);
  } catch (error) {
    if (error instanceof PowensError && (error.status === 404 || error.status === 403)) {
      throw badRequest('unknown_connection', 'Connexion introuvable pour cet utilisateur');
    }
    throw error;
  }

  await BankLinkModel.updateOne(
    { _id: link._id, userId },
    {
      $set: {
        connectionId,
        connectorName: connection.connector?.name ?? link.connectorName ?? null,
        status: connection.last_update || connection.state ? mapConnectionState(connection.state) : 'pending',
        powensState: connection.state ?? null,
        powensMessage: connection.error_message ?? null,
        consentExpiresAt: connection.expire ? new Date(connection.expire) : null,
      },
    },
  );

  await refreshAccounts(userId).catch((error) => logger.warn({ err: error }, 'Lecture des comptes impossible'));
  scheduleSync(userId, { reason: 'webview_callback' });

  const updated = await BankLinkModel.findOne({ userId }).lean<BankLinkDoc>();
  return toBankLinkDto(updated!);
}

export async function listAccounts(userId: string): Promise<BankAccount[]> {
  const accounts = await BankAccountModel.find({ userId }).sort({ source: 1, name: 1 }).lean<BankAccountDoc[]>();
  return accounts.map(toBankAccountDto);
}

export async function updateAccount(userId: string, accountId: string, analyzed: boolean): Promise<BankAccount> {
  if (!Types.ObjectId.isValid(accountId)) throw notFound('Compte');
  const account = await BankAccountModel.findOneAndUpdate(
    { _id: accountId, userId },
    { $set: { analyzed } },
    { returnDocument: 'after' },
  ).lean<BankAccountDoc>();
  if (!account) throw notFound('Compte');
  if (analyzed && account.source === 'powens') scheduleSync(userId, { reason: 'account_enabled', fullResync: true });
  return toBankAccountDto(account);
}

/** Purge locale des comptes Powens et de leurs transactions. Les abonnements restent. */
async function purgeLocalBankData(userId: string): Promise<void> {
  const accounts = await BankAccountModel.find({ userId, source: 'powens' }, { _id: 1 }).lean<BankAccountDoc[]>();
  const accountIds = accounts.map((account) => account._id);
  const txIds = (await TransactionModel.find({ userId, accountId: { $in: accountIds } }, { _id: 1 }).lean()).map(
    (tx) => tx._id,
  );
  // Les paiements bancaires restent lisibles dans l'historique, sans lien vers la transaction supprimée.
  await PaymentModel.updateMany({ userId, transactionId: { $in: txIds } }, { $set: { transactionId: null } });
  await TransactionModel.deleteMany({ userId, accountId: { $in: accountIds } });
  await BankAccountModel.deleteMany({ userId, source: 'powens' });
}

/**
 * Supprime la connexion chez Powens puis l'utilisateur Powens. En cas d'échec, la suppression
 * distante est mise en file pour être retentée sans bloquer la purge locale.
 */
export async function deleteRemoteBankData(link: BankLinkDoc): Promise<void> {
  try {
    const client = getPowensClient();
    const token = powensToken(link);
    if (link.connectionId) {
      await client.deleteConnection(token, link.connectionId).catch((error) => {
        if (!(error instanceof PowensError && error.status === 404)) throw error;
      });
    }
    await client.deleteUser(token).catch((error) => {
      if (!(error instanceof PowensError && error.status === 404)) throw error;
    });
  } catch (error) {
    logger.warn({ err: error }, 'Suppression Powens en échec : mise en file de nouvel essai');
    await PowensCleanupModel.create({
      powensTokenEnc: link.powensTokenEnc,
      connectionId: link.connectionId ?? null,
      lastError: error instanceof Error ? error.message : 'unknown',
    });
  }
}

export async function unlinkBank(userId: string): Promise<void> {
  const link = await BankLinkModel.findOne({ userId }).lean<BankLinkDoc>();
  if (!link) throw notFound('Lien bancaire');
  await deleteRemoteBankData(link);
  await purgeLocalBankData(userId);
  await BankLinkModel.deleteOne({ _id: link._id, userId });
  await ConnectSessionModel.deleteMany({ userId });
}

export async function retryPowensCleanups(): Promise<number> {
  const pending = await PowensCleanupModel.find({ attempts: { $lt: 20 } })
    .limit(50)
    .lean();
  let done = 0;
  for (const item of pending) {
    try {
      const client = getPowensClient();
      const token = decrypt(item.powensTokenEnc, getConfig().TOKEN_ENCRYPTION_KEY);
      if (item.connectionId) await client.deleteConnection(token, item.connectionId).catch(ignoreNotFound);
      await client.deleteUser(token).catch(ignoreNotFound);
      await PowensCleanupModel.deleteOne({ _id: item._id });
      done += 1;
    } catch (error) {
      await PowensCleanupModel.updateOne(
        { _id: item._id },
        { $inc: { attempts: 1 }, $set: { lastError: error instanceof Error ? error.message : 'unknown' } },
      );
    }
  }
  return done;
}

function ignoreNotFound(error: unknown): void {
  if (!(error instanceof PowensError && error.status === 404)) throw error;
}
