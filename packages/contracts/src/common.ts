import { z } from 'zod';

/** Identifiant MongoDB sérialisé (24 caractères hexadécimaux). */
export const IdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Identifiant invalide');

/** Date métier sans heure, au format AAAA-MM-JJ. */
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ')
  // Date.parse accepte « 2026-02-30 » (reporté au 2 mars) : on exige que la date relue soit identique.
  .refine((value) => {
    const time = Date.parse(`${value}T00:00:00Z`);
    return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
  }, 'Date invalide');

/** Horodatage ISO 8601 complet. */
export const TimestampSchema = z.string().datetime({ offset: true });

/** Code devise ISO 4217. */
export const CurrencySchema = z.string().regex(/^[A-Z]{3}$/, 'Devise ISO 4217 attendue (ex. EUR)');

/** Montant en centimes entiers : jamais de flottants pour l'argent. */
export const CentsSchema = z.number().int().safe();

export const MoneySchema = z.object({
  cents: CentsSchema,
  currency: CurrencySchema,
});
export type Money = z.infer<typeof MoneySchema>;

/**
 * Provenance d'une information :
 * - observed : tirée de transactions bancaires
 * - declared : saisie ou corrigée par l'utilisateur (jamais réécrite par le système)
 * - estimated : calculée par l'application
 */
export const OriginSchema = z.enum(['observed', 'declared', 'estimated']);
export type Origin = z.infer<typeof OriginSchema>;

export const sourced = <T extends z.ZodType>(value: T) =>
  z.object({
    value,
    origin: OriginSchema,
    updatedAt: TimestampSchema,
  });

/** Erreur au format RFC 9457 (application/problem+json). */
export const ProblemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: z.string(),
  detail: z.string().optional(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type Problem = z.infer<typeof ProblemSchema>;

export const PaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const paginated = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });

/** En-tête permettant au backend d'adapter le transport du refresh token. */
export const ClientPlatformSchema = z.enum(['web', 'native']);
export type ClientPlatform = z.infer<typeof ClientPlatformSchema>;
export const CLIENT_PLATFORM_HEADER = 'x-client-platform';
