import { z } from 'zod';
import { CentsSchema, CurrencySchema, IdSchema, IsoDateSchema, TimestampSchema } from './common';
import { ProviderSummarySchema } from './providers';

export const ConfidenceLevelSchema = z.enum(['high', 'medium', 'low']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export const CandidateStatusSchema = z.enum(['pending', 'accepted', 'rejected', 'dismissed']);
export type CandidateStatus = z.infer<typeof CandidateStatusSchema>;

export const CandidateSchema = z.object({
  id: IdSchema,
  label: z.string(),
  merchantKey: z.string(),
  provider: ProviderSummarySchema.nullable(),
  accountId: IdSchema.nullable(),
  currency: CurrencySchema,
  occurrences: z.number().int(),
  amount: z.object({
    medianCents: CentsSchema,
    minCents: CentsSchema,
    maxCents: CentsSchema,
    lastCents: CentsSchema,
  }),
  intervalDays: z.number(),
  dayOfMonth: z.number().int().min(1).max(31),
  firstDate: IsoDateSchema,
  lastDate: IsoDateSchema,
  nextDueDate: IsoDateSchema,
  confidence: z.number().min(0).max(1),
  level: ConfidenceLevelSchema,
  reasons: z.array(z.string()),
  /** Aucun paiement récent : l'abonnement est peut-être terminé. */
  stale: z.boolean(),
  status: CandidateStatusSchema,
  transactionIds: z.array(IdSchema),
  subscriptionId: IdSchema.nullable(),
  /** Abonnement manuel existant qui pourrait correspondre (même fournisseur). */
  suggestedSubscriptionId: IdSchema.nullable(),
  updatedAt: TimestampSchema,
});
export type Candidate = z.infer<typeof CandidateSchema>;

export const CandidateListQuerySchema = z.object({
  status: CandidateStatusSchema.default('pending'),
});

export const CandidateListResponseSchema = z.object({ items: z.array(CandidateSchema) });
export type CandidateListResponse = z.infer<typeof CandidateListResponseSchema>;

/**
 * Chaque champ fourni devient `declared`.
 * `mergeIntoSubscriptionId` rattache les paiements à un abonnement existant au lieu d'en créer un.
 */
export const AcceptCandidateBodySchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  providerId: IdSchema.nullable().optional(),
  customProviderName: z.string().trim().max(80).nullable().optional(),
  amountCents: CentsSchema.positive().optional(),
  billingDay: z.number().int().min(1).max(31).optional(),
  mergeIntoSubscriptionId: IdSchema.optional(),
});
export type AcceptCandidateBody = z.infer<typeof AcceptCandidateBodySchema>;

export const DetectionRunResponseSchema = z.object({
  analyzedTransactions: z.number().int(),
  created: z.number().int(),
  updated: z.number().int(),
  attachedPayments: z.number().int(),
  pending: z.number().int(),
});
export type DetectionRunResponse = z.infer<typeof DetectionRunResponseSchema>;

export const DemoDataResponseSchema = z.object({ imported: z.number().int(), detection: DetectionRunResponseSchema });
export type DemoDataResponse = z.infer<typeof DemoDataResponseSchema>;
