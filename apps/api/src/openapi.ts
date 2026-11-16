import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { openApiRegistry } from './core/http';

/** Spécification générée depuis les schémas Zod de `@subtracker/contracts` et les routes déclarées. */
export function buildOpenApiDocument() {
  return new OpenApiGeneratorV31(openApiRegistry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Subscription Tracker API',
      version: '0.1.0',
      description:
        'Gestion et détection d’abonnements bancaires. Erreurs au format application/problem+json. Montants en centimes entiers ; dates métier AAAA-MM-JJ.',
    },
    servers: [{ url: '/api' }],
  });
}
