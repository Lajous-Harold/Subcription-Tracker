import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SessionModel, UserModel } from '../src/modules/auth/models';
import { registerUser, testApp } from './helpers';

const app = testApp();

describe('auth', () => {
  it('inscrit un utilisateur et hache le mot de passe', async () => {
    const user = await registerUser(app, 'Alice@Example.com');
    expect(user.accessToken).toBeTruthy();
    expect(user.refreshToken).toBeTruthy();
    const doc = await UserModel.findOne({ email: 'alice@example.com' }).lean();
    expect(doc?.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('refuse un email déjà pris et un mot de passe trop court', async () => {
    await registerUser(app, 'bob@example.com');
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'bob@example.com', password: 'MotDePasse-Solide-42' })
      .expect(409);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'c@example.com', password: 'court' })
      .expect(400);
    expect(res.body.error?.code).toBe('INVALID_INPUT');
    expect(res.headers['content-type']).toMatch(/^application\/json/);
  });

  it('connecte avec le bon mot de passe, même message d’erreur sinon', async () => {
    const user = await registerUser(app);
    await request(app).post('/api/auth/login').send({ email: user.email, password: user.password }).expect(200);
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'mauvais-mot-de-passe' })
      .expect(401);
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inconnu@example.com', password: 'mauvais-mot-de-passe' })
      .expect(401);
    expect(wrong.body.error?.code).toBe('UNAUTHORIZED');
    expect(wrong.body.error?.message).toEqual(expect.stringMatching(/\S/));
    expect(wrong.body.error?.message).toBe(unknown.body.error?.message);
  });

  it('protège /me et renvoie l’utilisateur courant', async () => {
    await request(app).get('/api/me').expect(401);
    const user = await registerUser(app);
    const res = await request(app).get('/api/me').set(user.auth).expect(200);
    expect(res.body.email).toBe(user.email);
  });

  it('web : refresh token en cookie httpOnly, jamais dans le corps', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('x-client-platform', 'web')
      .send({ email: 'web@example.com', password: 'MotDePasse-Solide-42' })
      .expect(201);
    expect(res.body.refreshToken).toBeUndefined();
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/st_refresh=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);

    const refreshed = await request(app)
      .post('/api/auth/refresh')
      .set('x-client-platform', 'web')
      .set('Cookie', cookie.split(';')[0]!)
      .send({})
      .expect(200);
    expect(refreshed.body.accessToken).toBeTruthy();
    expect(refreshed.body.refreshToken).toBeUndefined();
  });

  it('déconnexion : la session ne peut plus être rafraîchie', async () => {
    const user = await registerUser(app);
    await request(app).post('/api/auth/logout').send({ refreshToken: user.refreshToken }).expect(204);
    await request(app).post('/api/auth/refresh').send({ refreshToken: user.refreshToken }).expect(401);
  });

  it('suppression du compte : exige le mot de passe et efface tout', async () => {
    const user = await registerUser(app);
    await request(app)
      .post('/api/subscriptions')
      .set(user.auth)
      .send({ label: 'Spotify', amountCents: 1099 })
      .expect(201);
    await request(app).delete('/api/me').set(user.auth).send({ password: 'mauvais-mot-de-passe' }).expect(401);
    await request(app).delete('/api/me').set(user.auth).send({ password: user.password }).expect(204);
    expect(await UserModel.countDocuments()).toBe(0);
    await request(app).post('/api/auth/login').send({ email: user.email, password: user.password }).expect(401);
  });
});

// Seule la date est simulée : les minuteurs restent réels pour le pilote MongoDB et Supertest.
function freezeClock() {
  jest.useFakeTimers({
    doNotFake: [
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
    ],
  });
}

function advanceClockBy(milliseconds: number) {
  jest.setSystemTime(Date.now() + milliseconds);
}

const refreshNative = (refreshToken: string) => request(app).post('/api/auth/refresh').send({ refreshToken });

const refreshWeb = (cookie: string) =>
  request(app).post('/api/auth/refresh').set('x-client-platform', 'web').set('Cookie', cookie).send({});

function refreshCookieOf(res: request.Response): string {
  const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined;
  return setCookie?.[0]?.split(';')[0] ?? '';
}

describe('auth : réutilisation d’un refresh token déjà remplacé', () => {
  beforeEach(freezeClock);
  afterEach(() => {
    jest.useRealTimers();
  });

  it('tourne le refresh token à chaque renouvellement', async () => {
    const user = await registerUser(app);
    const rotated = await refreshNative(user.refreshToken).expect(200);
    expect(rotated.body.refreshToken).toEqual(expect.stringMatching(/\S/));
    expect(rotated.body.refreshToken).not.toBe(user.refreshToken);
  });

  it('refuse avec REFRESH_SUPERSEDED un jeton remplacé il y a moins de 30 secondes', async () => {
    const user = await registerUser(app);
    await refreshNative(user.refreshToken).expect(200);
    advanceClockBy(10_000);

    const replay = await refreshNative(user.refreshToken).expect(401);
    expect(replay.body.error?.code).toBe('REFRESH_SUPERSEDED');
    expect(replay.body.error?.message).toEqual(expect.stringMatching(/\S/));
  });

  it('web : deux onglets rafraîchissent avec le même cookie, le jeton le plus récent reste utilisable', async () => {
    const registered = await request(app)
      .post('/api/auth/register')
      .set('x-client-platform', 'web')
      .send({ email: 'onglets@example.com', password: 'MotDePasse-Solide-42' })
      .expect(201);
    const sharedCookie = refreshCookieOf(registered);

    const firstTab = await refreshWeb(sharedCookie).expect(200);
    const latestCookie = refreshCookieOf(firstTab);
    advanceClockBy(5_000);
    await refreshWeb(sharedCookie).expect(401);

    const resumed = await refreshWeb(latestCookie).expect(200);
    expect(resumed.body.accessToken).toEqual(expect.stringMatching(/\S/));
  });

  it('au-delà de 30 secondes, la réutilisation d’un jeton remplacé révoque toute la famille', async () => {
    const user = await registerUser(app);
    const rotated = await refreshNative(user.refreshToken).expect(200);
    advanceClockBy(31_000);

    const replay = await refreshNative(user.refreshToken).expect(401);
    expect(replay.body.error?.code).toBe('UNAUTHORIZED');
    await refreshNative(rotated.body.refreshToken).expect(401);
    expect(await SessionModel.countDocuments({ revokedAt: null })).toBe(0);
  });

  it('refuse avec UNAUTHORIZED un jeton révoqué par déconnexion, même dans les 30 secondes', async () => {
    const user = await registerUser(app);
    await request(app).post('/api/auth/logout').send({ refreshToken: user.refreshToken }).expect(204);
    advanceClockBy(5_000);

    const res = await refreshNative(user.refreshToken).expect(401);
    expect(res.body.error?.code).toBe('UNAUTHORIZED');
  });

  it('refuse avec UNAUTHORIZED un jeton inconnu', async () => {
    const res = await refreshNative('jeton-qui-n-a-jamais-ete-emis').expect(401);
    expect(res.body.error?.code).toBe('UNAUTHORIZED');
  });
});
