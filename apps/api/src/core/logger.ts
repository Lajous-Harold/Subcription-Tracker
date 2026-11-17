import pino from 'pino';

/**
 * Secrets et données bancaires (libellés, montants) ne sont jamais journalisés.
 * Instancié à l'import, avant le chargement de la config : niveau `info` jusqu'à `setConfig()`,
 * qui applique `LOG_LEVEL`, pour qu'une config invalide reste journalisée au démarrage.
 */
export const logger = pino({
  level: 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.refreshToken',
      '*.accessToken',
      '*.auth_token',
      '*.powensToken',
      '*.label',
      '*.rawLabel',
      '*.amountCents',
    ],
    censor: '[masqué]',
  },
});
