import pino from 'pino';

/** Secrets et données bancaires (libellés, montants) ne sont jamais journalisés. */
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
