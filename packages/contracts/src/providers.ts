import { z } from 'zod';
import { IdSchema, IsoDateSchema } from './common';

export const ProviderCategorySchema = z.enum([
  'music',
  'video',
  'ai',
  'software',
  'cloud',
  'gaming',
  'news',
  'sport',
  'telecom',
  'delivery',
  'other',
]);
export type ProviderCategory = z.infer<typeof ProviderCategorySchema>;

export const CancellationMethodSchema = z.enum(['online', 'in_app', 'email', 'letter', 'phone', 'in_person']);
export type CancellationMethod = z.infer<typeof CancellationMethodSchema>;

export const CancellationProcedureSchema = z.object({
  method: CancellationMethodSchema,
  url: z.string().url().nullable(),
  /** Toujours présentes, même quand `url` existe. */
  instructions: z.string(),
  /** Page consultée pour établir la procédure (distincte du parcours `url`). */
  sourceUrl: z.string().url().nullable(),
  /** Date de confirmation sur la page officielle ; null si non vérifiée. */
  lastVerifiedAt: IsoDateSchema.nullable(),
});
export type CancellationProcedure = z.infer<typeof CancellationProcedureSchema>;

export const ProviderSchema = z.object({
  id: IdSchema,
  slug: z.string(),
  name: z.string(),
  category: ProviderCategorySchema,
  website: z.string().url().nullable(),
  cancellation: CancellationProcedureSchema,
});
export type Provider = z.infer<typeof ProviderSchema>;

export const ProviderSummarySchema = ProviderSchema.pick({ id: true, slug: true, name: true, category: true });
export type ProviderSummary = z.infer<typeof ProviderSummarySchema>;

export const ProviderListQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
});

export const ProviderListResponseSchema = z.object({ items: z.array(ProviderSchema) });
export type ProviderListResponse = z.infer<typeof ProviderListResponseSchema>;
