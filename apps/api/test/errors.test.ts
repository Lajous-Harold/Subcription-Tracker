import request, { type Response } from 'supertest';
import { describe, expect, it } from '@jest/globals';
import { registerUser, testApp } from './helpers';

/**
 * Enveloppe d'erreur unique de l'API, pour toute réponse de statut >= 400 :
 * `{ "error": { "code", "message", "fields"?, "hint"? } }` en `application/json`, rien d'autre à la racine.
 */
const app = testApp();
const ABSENT_ID = '0123456789abcdef01234567';
const ALLOWED_ERROR_KEYS = ['code', 'fields', 'hint', 'message'];

function expectErrorEnvelope(res: Response, code: string) {
  expect(Object.keys(res.body)).toEqual(['error']);
  expect(res.body.error?.code).toBe(code);
  expect(res.body.error?.message).toEqual(expect.stringMatching(/\S/));
  for (const key of Object.keys(res.body.error ?? {})) expect(ALLOWED_ERROR_KEYS).toContain(key);
  expect(res.headers['content-type']).toMatch(/^application\/json/);
}

describe('enveloppe d’erreur : 400 INVALID_INPUT', () => {
  it('un corps invalide renvoie INVALID_INPUT avec le message de chaque champ fautif', async () => {
    const user = await registerUser(app);
    const res = await request(app)
      .post('/api/subscriptions')
      .set(user.auth)
      .send({ label: 'Spotify', amountCents: -500 })
      .expect(400);
    expectErrorEnvelope(res, 'INVALID_INPUT');
    expect(res.body.error.fields).toEqual([{ path: 'amountCents', message: 'Le montant doit être positif' }]);
  });

  it('un JSON malformé renvoie INVALID_INPUT', async () => {
    const user = await registerUser(app);
    const res = await request(app)
      .post('/api/subscriptions')
      .set(user.auth)
      .set('Content-Type', 'application/json')
      .send('{"label": "Spotify", "amountCents": ')
      .expect(400);
    expectErrorEnvelope(res, 'INVALID_INPUT');
  });
});

describe('enveloppe d’erreur : 401 UNAUTHORIZED quelle que soit la cause', () => {
  it('sans jeton', async () => {
    const res = await request(app).get('/api/subscriptions').expect(401);
    expectErrorEnvelope(res, 'UNAUTHORIZED');
  });

  it('avec un jeton invalide', async () => {
    const res = await request(app).get('/api/subscriptions').set('Authorization', 'Bearer jeton-invalide').expect(401);
    expectErrorEnvelope(res, 'UNAUTHORIZED');
  });

  it('avec une session révoquée', async () => {
    const user = await registerUser(app);
    await request(app).post('/api/auth/logout').send({ refreshToken: user.refreshToken }).expect(204);
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: user.refreshToken }).expect(401);
    expectErrorEnvelope(res, 'UNAUTHORIZED');
  });

  it('avec de mauvais identifiants', async () => {
    const user = await registerUser(app);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'mauvais-mot-de-passe' })
      .expect(401);
    expectErrorEnvelope(res, 'UNAUTHORIZED');
  });

  it('avec un webhook Powens sans signature valide', async () => {
    const res = await request(app)
      .post('/api/webhooks/powens/CONNECTION_SYNCED')
      .set('Content-Type', 'application/json')
      .send('{}')
      .expect(401);
    expectErrorEnvelope(res, 'UNAUTHORIZED');
  });
});

describe('enveloppe d’erreur : 404 NOT_FOUND', () => {
  it('un abonnement inexistant', async () => {
    const user = await registerUser(app);
    const res = await request(app).get(`/api/subscriptions/${ABSENT_ID}`).set(user.auth).expect(404);
    expectErrorEnvelope(res, 'NOT_FOUND');
  });

  it('un abonnement appartenant à un autre compte', async () => {
    const alice = await registerUser(app);
    const bob = await registerUser(app);
    const created = await request(app)
      .post('/api/subscriptions')
      .set(alice.auth)
      .send({ label: 'Netflix', amountCents: 1349 })
      .expect(201);
    const res = await request(app).get(`/api/subscriptions/${created.body.id}`).set(bob.auth).expect(404);
    expectErrorEnvelope(res, 'NOT_FOUND');
  });

  it('une route inconnue', async () => {
    const res = await request(app).get('/api/route-inexistante').expect(404);
    expectErrorEnvelope(res, 'NOT_FOUND');
  });
});

describe('enveloppe d’erreur : codes métier', () => {
  it('un email déjà utilisé à l’inscription renvoie 409 EMAIL_ALREADY_USED', async () => {
    await registerUser(app, 'deja@example.com');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'deja@example.com', password: 'MotDePasse-Solide-42' })
      .expect(409);
    expectErrorEnvelope(res, 'EMAIL_ALREADY_USED');
  });

  it('sans identifiants Powens, renvoie 503 POWENS_NOT_CONFIGURED avec une explication', async () => {
    const bare = testApp({ POWENS_DOMAIN: '', POWENS_CLIENT_ID: '', POWENS_CLIENT_SECRET: '' });
    const user = await registerUser(bare);
    const res = await request(bare)
      .post('/api/bank/connect-sessions')
      .set(user.auth)
      .send({ flow: 'connect', platform: 'web' })
      .expect(503);
    testApp(); // restaure la configuration par défaut pour les tests suivants
    expectErrorEnvelope(res, 'POWENS_NOT_CONFIGURED');
    expect(res.body.error.hint).toEqual(expect.stringMatching(/\S/));
  });
});
