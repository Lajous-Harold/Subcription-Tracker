import { z } from 'zod';

const booleanString = z.enum(['true', 'false', '1', '0']).transform((value) => value === 'true' || value === '1');

const EnvSchema = z
  .object({
    APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().default(4000),
    /** URL publique de l'API (utilisée pour la vérification des webhooks). */
    PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
    MONGODB_URI: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET doit faire au moins 32 caractères'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    /** Clé AES-256-GCM des tokens Powens. */
    TOKEN_ENCRYPTION_KEY: z
      .string()
      .refine(
        (value) => Buffer.from(value, 'base64').length === 32,
        'TOKEN_ENCRYPTION_KEY : 32 octets en base64 attendus',
      ),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:8081')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    COOKIE_SECURE: booleanString.optional(),
    /** Rétention des données bancaires, en années (décision D4 : 5 ans). */
    DATA_RETENTION_YEARS: z.coerce.number().int().positive().default(5),
    ENABLE_DEV_ROUTES: booleanString.optional(),
    ENABLE_JOBS: booleanString.default(true),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    POWENS_DOMAIN: z.string().optional(),
    POWENS_CLIENT_ID: z.string().optional(),
    POWENS_CLIENT_SECRET: z.string().optional(),
    POWENS_WEBHOOK_SECRET: z.string().optional(),
    POWENS_WEBVIEW_BASE_URL: z.string().url().default('https://webview.powens.com'),
    POWENS_WEBVIEW_LANG: z.string().default('fr'),
    POWENS_REDIRECT_URI_NATIVE: z.string().default('subtracker://powens/callback'),
    POWENS_REDIRECT_URI_WEB: z.string().default('http://localhost:8081/powens/callback'),
  })
  .transform((env) => ({
    ...env,
    COOKIE_SECURE: env.COOKIE_SECURE ?? env.APP_ENV === 'production',
    ENABLE_DEV_ROUTES: env.ENABLE_DEV_ROUTES ?? env.APP_ENV !== 'production',
    powensConfigured: Boolean(env.POWENS_DOMAIN && env.POWENS_CLIENT_ID && env.POWENS_CLIENT_SECRET),
  }));

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Configuration invalide :\n${details}`);
  }
  if (parsed.data.APP_ENV === 'production' && parsed.data.ENABLE_DEV_ROUTES) {
    throw new Error('ENABLE_DEV_ROUTES ne peut pas être activé en production');
  }
  return parsed.data;
}
