import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll } from '@jest/globals';
import nock from 'nock';
import { loadConfig } from '../src/core/config';
import { setConfig } from '../src/core/context';
import { ensureProviderCatalog } from '../src/modules/providers/service';
import { setPowensClient } from '../src/modules/powens';
import { waitForSyncs } from '../src/modules/bank/sync';

export const TEST_ENV = {
  APP_ENV: 'test',
  MONGODB_URI: 'mongodb://unused',
  JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-1234',
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  CORS_ORIGINS: 'http://localhost:8081',
  ENABLE_JOBS: 'false',
  POWENS_DOMAIN: 'test-sandbox',
  POWENS_CLIENT_ID: 'client-id',
  POWENS_CLIENT_SECRET: 'client-secret',
  POWENS_WEBHOOK_SECRET: 'webhook-secret',
  PUBLIC_API_URL: 'http://localhost:4000',
} as const;

setConfig(loadConfig({ ...TEST_ENV } as NodeJS.ProcessEnv));

beforeAll(async () => {
  const dbName = `test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  await mongoose.connect(process.env.MONGODB_TEST_URI!, { dbName });
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
  await ensureProviderCatalog();
  nock.disableNetConnect();
  nock.enableNetConnect(/127\.0\.0\.1|localhost/);
}, 60_000);

afterEach(async () => {
  await waitForSyncs();
  nock.cleanAll();
  setPowensClient(null);
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(
    collections
      .filter((collection) => collection.collectionName !== 'providers')
      .map((collection) => collection.deleteMany({})),
  );
}, 60_000);

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  nock.enableNetConnect();
  // Jest recharge nock pour chaque fichier alors que le module http est partagé :
  // sans restore(), les intercepteurs s'empilent d'un fichier à l'autre.
  nock.restore();
}, 60_000);
