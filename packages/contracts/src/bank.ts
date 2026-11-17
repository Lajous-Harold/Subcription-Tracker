import { z } from 'zod';
import { CentsSchema, ClientPlatformSchema, CurrencySchema, IdSchema, IsoDateSchema, TimestampSchema } from './common';

/**
 * Dérivé de l'état Powens de la connexion :
 * - pending : première synchronisation pas encore terminée
 * - action_required : reconnexion nécessaire (SCA, mot de passe…)
 * - temporary_error : indisponibilité banque ou Powens, nouvel essai automatique
 * - error : état Powens inconnu
 * - disconnected : connexion supprimée côté Powens
 */
export const BankLinkStatusSchema = z.enum([
  'pending',
  'connected',
  'action_required',
  'temporary_error',
  'not_supported',
  'error',
  'disconnected',
]);
export type BankLinkStatus = z.infer<typeof BankLinkStatusSchema>;

export const BankLinkSchema = z.object({
  id: IdSchema,
  status: BankLinkStatusSchema,
  connectorName: z.string().nullable(),
  /** État Powens brut, pour diagnostic. */
  providerState: z.string().nullable(),
  providerMessage: z.string().nullable(),
  consentExpiresAt: TimestampSchema.nullable(),
  /** Vrai si le consentement expire dans moins de 14 jours. */
  consentExpiringSoon: z.boolean(),
  lastSyncAt: TimestampSchema.nullable(),
  syncInProgress: z.boolean(),
  createdAt: TimestampSchema,
});
export type BankLink = z.infer<typeof BankLinkSchema>;

export const BankLinkResponseSchema = z.object({ link: BankLinkSchema.nullable() });
export type BankLinkResponse = z.infer<typeof BankLinkResponseSchema>;

export const ConnectFlowSchema = z.enum(['connect', 'reconnect', 'manage']);
export type ConnectFlow = z.infer<typeof ConnectFlowSchema>;

export const CreateConnectSessionBodySchema = z.object({
  flow: ConnectFlowSchema,
  platform: ClientPlatformSchema,
});
export type CreateConnectSessionBody = z.infer<typeof CreateConnectSessionBodySchema>;

export const ConnectSessionResponseSchema = z.object({
  url: z.string().url(),
  redirectUri: z.string(),
  expiresAt: TimestampSchema,
});
export type ConnectSessionResponse = z.infer<typeof ConnectSessionResponseSchema>;

export const CompleteConnectSessionBodySchema = z.object({
  state: z.string().min(16).max(256),
  connectionId: z.string().regex(/^\d+$/).optional(),
  error: z.string().max(100).optional(),
  errorDescription: z.string().max(500).optional(),
});
export type CompleteConnectSessionBody = z.infer<typeof CompleteConnectSessionBodySchema>;

export const BankAccountSchema = z.object({
  id: IdSchema,
  name: z.string(),
  type: z.string().nullable(),
  currency: CurrencySchema,
  balanceCents: CentsSchema.nullable(),
  /** Décidé dans le consentement Powens. */
  sharedWithApp: z.boolean(),
  /** Choix local de l'utilisateur, indépendant du consentement Powens. */
  analyzed: z.boolean(),
  lastUpdate: TimestampSchema.nullable(),
});
export type BankAccount = z.infer<typeof BankAccountSchema>;

export const BankAccountListResponseSchema = z.object({ items: z.array(BankAccountSchema) });
export type BankAccountListResponse = z.infer<typeof BankAccountListResponseSchema>;

export const UpdateBankAccountBodySchema = z.object({ analyzed: z.boolean() });
export type UpdateBankAccountBody = z.infer<typeof UpdateBankAccountBodySchema>;

export const TransactionSchema = z.object({
  id: IdSchema,
  accountId: IdSchema,
  source: z.enum(['powens', 'fixture']),
  date: IsoDateSchema,
  amountCents: CentsSchema,
  currency: CurrencySchema,
  label: z.string(),
  counterpartyLabel: z.string().nullable(),
  bankType: z.string().nullable(),
  coming: z.boolean(),
  subscriptionId: IdSchema.nullable(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const TransactionListQuerySchema = z.object({
  accountId: IdSchema.optional(),
  from: IsoDateSchema.optional(),
  to: IsoDateSchema.optional(),
  q: z.string().trim().max(60).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const TransactionListResponseSchema = z.object({
  items: z.array(TransactionSchema),
  nextCursor: z.string().nullable(),
});
export type TransactionListResponse = z.infer<typeof TransactionListResponseSchema>;
