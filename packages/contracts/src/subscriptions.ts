import { z } from 'zod';
import { CentsSchema, CurrencySchema, IdSchema, IsoDateSchema, MoneySchema, TimestampSchema, sourced } from './common';
import { CancellationMethodSchema, ProviderSummarySchema } from './providers';

/**
 * Seul l'utilisateur change un statut, jamais le système.
 * `archived` : plus suivi, conservé pour l'historique.
 */
export const SubscriptionStatusSchema = z.enum(['active', 'cancellation_pending', 'cancelled', 'archived']);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

/** MVP : mensuel uniquement ; l'énumération laisse place à d'autres périodicités. */
export const CadenceSchema = z.enum(['monthly']);
export type Cadence = z.infer<typeof CadenceSchema>;

export const SubscriptionOriginSchema = z.enum(['detected', 'manual']);

export const CancellationStatusSchema = z.enum(['started', 'requested', 'confirmed', 'abandoned']);
export type CancellationStatus = z.infer<typeof CancellationStatusSchema>;

export const CancellationSchema = z.object({
  status: CancellationStatusSchema,
  method: CancellationMethodSchema.nullable(),
  startedAt: TimestampSchema,
  requestedAt: IsoDateSchema.nullable(),
  effectiveDate: IsoDateSchema.nullable(),
  reference: z.string().nullable(),
  notes: z.string().nullable(),
});
export type Cancellation = z.infer<typeof CancellationSchema>;

export const SubscriptionEventSchema = z.object({
  at: TimestampSchema,
  actor: z.enum(['user', 'system']),
  type: z.string(),
  field: z.string().nullable(),
  from: z.unknown().optional(),
  to: z.unknown().optional(),
});
export type SubscriptionEvent = z.infer<typeof SubscriptionEventSchema>;

export const SubscriptionSchema = z.object({
  id: IdSchema,
  origin: SubscriptionOriginSchema,
  label: z.string(),
  provider: ProviderSummarySchema.nullable(),
  customProviderName: z.string().nullable(),
  amount: sourced(MoneySchema),
  cadence: CadenceSchema,
  billingDay: sourced(z.number().int().min(1).max(31)).nullable(),
  /** Calculée à la lecture ; `declared` si l'utilisateur l'a fixée. */
  nextDueDate: sourced(IsoDateSchema).nullable(),
  status: SubscriptionStatusSchema,
  cancellation: CancellationSchema.nullable(),
  notes: z.string().nullable(),
  lastPaymentDate: IsoDateSchema.nullable(),
  /** Signal : aucun paiement observé 7 jours après l'échéance attendue. N'entraîne aucun changement de statut. */
  paymentMissing: z.boolean(),
  bankLinked: z.boolean(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Subscription = z.infer<typeof SubscriptionSchema>;

export const SubscriptionDetailSchema = SubscriptionSchema.extend({
  events: z.array(SubscriptionEventSchema),
});
export type SubscriptionDetail = z.infer<typeof SubscriptionDetailSchema>;

const LabelSchema = z.string().trim().min(1, 'Libellé requis').max(80);
const NotesSchema = z.string().trim().max(1000);

export const CreateSubscriptionBodySchema = z
  .object({
    label: LabelSchema,
    providerId: IdSchema.nullable().optional(),
    customProviderName: z.string().trim().max(80).nullable().optional(),
    amountCents: CentsSchema.positive('Le montant doit être positif'),
    currency: CurrencySchema.default('EUR'),
    billingDay: z.number().int().min(1).max(31).nullable().optional(),
    nextDueDate: IsoDateSchema.nullable().optional(),
    notes: NotesSchema.nullable().optional(),
  })
  .refine((body) => !(body.providerId && body.customProviderName), {
    message: 'Choisir un fournisseur connu ou un nom libre, pas les deux',
    path: ['customProviderName'],
  });
export type CreateSubscriptionBody = z.infer<typeof CreateSubscriptionBodySchema>;

export const UpdateSubscriptionBodySchema = z
  .object({
    label: LabelSchema,
    providerId: IdSchema.nullable(),
    customProviderName: z.string().trim().max(80).nullable(),
    amountCents: CentsSchema.positive('Le montant doit être positif'),
    currency: CurrencySchema,
    billingDay: z.number().int().min(1).max(31).nullable(),
    nextDueDate: IsoDateSchema.nullable(),
    status: z.enum(['active', 'archived']),
    notes: NotesSchema.nullable(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Aucune modification fournie');
export type UpdateSubscriptionBody = z.infer<typeof UpdateSubscriptionBodySchema>;

/** Champs dont l'utilisateur peut abandonner la valeur `declared` pour revenir aux données observées. */
export const ResettableFieldSchema = z.enum(['amount', 'billingDay', 'nextDueDate']);
export type ResettableField = z.infer<typeof ResettableFieldSchema>;

export const SubscriptionListQuerySchema = z.object({
  status: SubscriptionStatusSchema.optional(),
});

export const SubscriptionListResponseSchema = z.object({ items: z.array(SubscriptionSchema) });
export type SubscriptionListResponse = z.infer<typeof SubscriptionListResponseSchema>;

export const PaymentSchema = z.object({
  id: IdSchema,
  subscriptionId: IdSchema,
  source: z.enum(['bank', 'manual']),
  transactionId: IdSchema.nullable(),
  date: IsoDateSchema,
  amount: MoneySchema,
  note: z.string().nullable(),
  /** Paiement manuel qui ressemble à ce paiement bancaire (suggestion de fusion, jamais automatique). */
  possibleDuplicateOfId: IdSchema.nullable(),
  createdAt: TimestampSchema,
});
export type Payment = z.infer<typeof PaymentSchema>;

export const PaymentListResponseSchema = z.object({ items: z.array(PaymentSchema) });
export type PaymentListResponse = z.infer<typeof PaymentListResponseSchema>;

export const CreatePaymentBodySchema = z.object({
  date: IsoDateSchema,
  amountCents: CentsSchema.positive('Le montant doit être positif'),
  currency: CurrencySchema.default('EUR'),
  note: z.string().trim().max(300).nullable().optional(),
});
export type CreatePaymentBody = z.infer<typeof CreatePaymentBodySchema>;

export const LinkPaymentBodySchema = z.object({ transactionId: IdSchema });
export type LinkPaymentBody = z.infer<typeof LinkPaymentBodySchema>;

export const UpsertCancellationBodySchema = z.object({
  status: CancellationStatusSchema,
  method: CancellationMethodSchema.nullable().optional(),
  requestedAt: IsoDateSchema.nullable().optional(),
  effectiveDate: IsoDateSchema.nullable().optional(),
  reference: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});
export type UpsertCancellationBody = z.infer<typeof UpsertCancellationBodySchema>;
