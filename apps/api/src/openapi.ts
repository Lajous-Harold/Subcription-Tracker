import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { openApiRegistry } from './core/http';
import { API_PREFIX } from './core/paths';

export function buildOpenApiDocument() {
  return new OpenApiGeneratorV31(openApiRegistry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Subscription Tracker API',
      version: '0.1.0',
      description:
        'Gestion et détection d’abonnements bancaires. Erreurs en application/json, enveloppe `{ error: { code, message, fields?, hint? } }`. Montants en centimes entiers ; dates métier AAAA-MM-JJ.',
    },
    servers: [{ url: API_PREFIX }],
  });
}
