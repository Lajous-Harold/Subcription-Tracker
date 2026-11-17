import request from 'supertest';
import { createApp } from '../src/app';
import { loadConfig } from '../src/core/config';
import { TEST_ENV } from './setup';

export function testApp(overrides: Record<string, string> = {}) {
  return createApp(loadConfig({ ...TEST_ENV, ...overrides } as NodeJS.ProcessEnv));
}

export type TestApp = ReturnType<typeof testApp>;

export async function registerUser(app: TestApp, email = `user${Math.random().toString(36).slice(2, 8)}@example.com`) {
  const password = 'MotDePasse-Solide-42';
  const res = await request(app)
    .post('/api/auth/register')
    .set('x-client-platform', 'native')
    .send({ email, password })
    .expect(201);
  return {
    email,
    password,
    userId: res.body.user.id as string,
    accessToken: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
    auth: { Authorization: `Bearer ${res.body.accessToken}` },
  };
}
