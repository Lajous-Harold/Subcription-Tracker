import request from 'supertest';
import { describe, expect, it } from '@jest/globals';
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
      .send({ email: 'bob@example.com', password: 'motdepasse-solide-42' })
      .expect(409);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'c@example.com', password: 'court' })
      .expect(400);
    expect(res.body.code).toBe('validation_error');
    expect(res.headers['content-type']).toContain('application/problem+json');
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
    expect(wrong.body.title).toBe(unknown.body.title);
  });

  it('protège /me et renvoie l’utilisateur courant', async () => {
    await request(app).get('/api/me').expect(401);
    const user = await registerUser(app);
    const res = await request(app).get('/api/me').set(user.auth).expect(200);
    expect(res.body.email).toBe(user.email);
  });

  it('tourne le refresh token et révoque la famille en cas de réutilisation', async () => {
    const user = await registerUser(app);
    const first = await request(app).post('/api/auth/refresh').send({ refreshToken: user.refreshToken }).expect(200);
    expect(first.body.refreshToken).not.toBe(user.refreshToken);

    // Réutilisation de l'ancien token : rejet + révocation de toute la famille.
    await request(app).post('/api/auth/refresh').send({ refreshToken: user.refreshToken }).expect(401);
    await request(app).post('/api/auth/refresh').send({ refreshToken: first.body.refreshToken }).expect(401);
    expect(await SessionModel.countDocuments({ revokedAt: null })).toBe(0);
  });

  it('web : refresh token en cookie httpOnly, jamais dans le corps', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('x-client-platform', 'web')
      .send({ email: 'web@example.com', password: 'motdepasse-solide-42' })
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
