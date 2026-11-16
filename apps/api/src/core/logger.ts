import pino from 'pino';

/**
 * Logs structurés. Les secrets et données bancaires ne sont jamais journalisés :
 * en-têtes d'authentification, cookies, tokens, libellés et montants sont masqués.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.APP_ENV === 'test' ? 'silent' : 'info'),
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
