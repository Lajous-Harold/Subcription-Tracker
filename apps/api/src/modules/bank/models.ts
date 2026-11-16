import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

/** Lien bancaire : une connexion Powens par utilisateur au MVP (index unique sur userId). */
const bankLinkSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    powensUserId: { type: Number, default: null, index: true },
    /** Token permanent Powens, chiffré AES-256-GCM. Ne quitte jamais le backend. */
    powensTokenEnc: { type: String, required: true },
    connectionId: { type: Number, default: null },
    connectorName: { type: String, default: null },
    status: {
      type: String,
      enum: ['pending', 'connected', 'action_required', 'temporary_error', 'not_supported', 'error', 'disconnected'],
      default: 'pending',
    },
    powensState: { type: String, default: null },
    powensMessage: { type: String, default: null },
    consentExpiresAt: { type: Date, default: null },
    lastSyncAt: { type: Date, default: null },
    lastSyncAttemptAt: { type: Date, default: null },
    lastSyncError: { type: String, default: null },
    /** Curseur de synchronisation (`last_update` Powens le plus récent vu). */
    txCursor: { type: String, default: null },
    syncLockUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

export type BankLinkDoc = InferSchemaType<typeof bankLinkSchema> & { _id: Types.ObjectId; createdAt: Date };
export const BankLinkModel = model('BankLink', bankLinkSchema);

const bankAccountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    bankLinkId: { type: Schema.Types.ObjectId, ref: 'BankLink', default: null },
    source: { type: String, enum: ['powens', 'fixture'], required: true },
    externalId: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, default: null },
    currency: { type: String, default: 'EUR' },
    balanceCents: { type: Number, default: null },
    /** Partagé via le consentement Powens (compte non désactivé). */
    sharedWithApp: { type: Boolean, default: true },
    /** Choix local : inclure dans l'analyse. */
    analyzed: { type: Boolean, default: true },
    lastUpdate: { type: Date, default: null },
  },
  { timestamps: true },
);
bankAccountSchema.index({ userId: 1, source: 1, externalId: 1 }, { unique: true });

export type BankAccountDoc = InferSchemaType<typeof bankAccountSchema> & { _id: Types.ObjectId };
export const BankAccountModel = model('BankAccount', bankAccountSchema);

/** `state` du parcours Webview : usage unique, lié à l'utilisateur, 30 minutes (durée du code Powens). */
const connectSessionSchema = new Schema(
  {
    stateHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    flow: { type: String, enum: ['connect', 'reconnect', 'manage'], required: true },
    platform: { type: String, enum: ['web', 'native'], required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
connectSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ConnectSessionModel = model('ConnectSession', connectSessionSchema);

/** Nettoyage Powens à retenter quand la suppression distante a échoué (suppression de compte). */
const powensCleanupSchema = new Schema(
  {
    powensTokenEnc: { type: String, required: true },
    connectionId: { type: Number, default: null },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },
  },
  { timestamps: true },
);

export type PowensCleanupDoc = InferSchemaType<typeof powensCleanupSchema> & { _id: Types.ObjectId };
export const PowensCleanupModel = model('PowensCleanup', powensCleanupSchema);

/** Webhooks déjà traités (`id_webhook_data`), conservés 30 jours. */
const webhookEventSchema = new Schema({
  idWebhookData: { type: Number, required: true, unique: true },
  event: { type: String, required: true },
  receivedAt: { type: Date, required: true, default: () => new Date() },
});
webhookEventSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 30 * 86_400 });

export const WebhookEventModel = model('WebhookEvent', webhookEventSchema);
