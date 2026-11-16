import { z } from 'zod';
import { ProviderListQuerySchema, ProviderListResponseSchema, ProviderSchema } from '@subtracker/contracts';
import { createModule } from '../../core/http';
import { getProviderBySlug, listProviders } from './service';

export const providersModule = createModule('/providers', 'Fournisseurs');

providersModule.route({
  method: 'get',
  path: '/',
  summary: 'Catalogue des fournisseurs et procédures de résiliation',
  query: ProviderListQuerySchema,
  response: ProviderListResponseSchema,
  handler: async ({ query }) => ({ items: await listProviders(query.q) }),
});

providersModule.route({
  method: 'get',
  path: '/:slug',
  summary: 'Détail d’un fournisseur',
  params: z.object({ slug: z.string().regex(/^[a-z0-9-]+$/) }),
  response: ProviderSchema,
  errors: [404],
  handler: ({ params }) => getProviderBySlug(params.slug),
});
