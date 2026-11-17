/* Sans base de données : createApp() suffit à enregistrer les routes dans le registre OpenAPI. */
import { writeFileSync } from 'node:fs';
import { createApp } from '../src/app';
import { loadConfig } from '../src/core/config';
import { buildOpenApiDocument } from '../src/openapi';

createApp(
  loadConfig({
    APP_ENV: 'development',
    MONGODB_URI: 'mongodb://unused',
    JWT_ACCESS_SECRET: 'x'.repeat(48),
    TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
  } as NodeJS.ProcessEnv),
);
const target = new URL('../openapi.json', import.meta.url);
writeFileSync(target, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`);
process.stdout.write(`OpenAPI écrite dans ${target.pathname}\n`);
