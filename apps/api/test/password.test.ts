import request from 'supertest';
import { describe, expect, it } from '@jest/globals';
import { registerUser, testApp } from './helpers';

/**
 * Politique de mot de passe, appliquée à l'inscription seulement : au moins 8 caractères (128 au plus),
 * dont une majuscule, une minuscule, un chiffre et un symbole (tout caractère ni lettre ni chiffre).
 */
const app = testApp();

function register(password: string) {
  return request(app).post('/api/auth/register').send({ email: 'nouveau@example.com', password });
}

describe('politique de mot de passe à l’inscription', () => {
  it('accepte l’exemple du cours MotDePasse123!', async () => {
    await register('MotDePasse123!').expect(201);
  });

  it('accepte un mot de passe conforme de 8 caractères exactement', async () => {
    await register('Abcdef1!').expect(201);
  });

  it.each([
    ['de 7 caractères seulement', 'Abcde1!'],
    ['sans majuscule', 'abcdefgh1!'],
    ['sans minuscule', 'ABCDEFGH1!'],
    ['sans chiffre', 'Abcdefghi!'],
    ['sans symbole', 'Abcdefgh12'],
  ])('refuse un mot de passe %s (%s) en désignant le champ password', async (_cas, password) => {
    const res = await register(password).expect(400);
    expect(res.body.error?.code).toBe('INVALID_INPUT');
    expect(res.body.error?.fields).toEqual(
      expect.arrayContaining([{ path: 'password', message: expect.stringMatching(/\S/) }]),
    );
  });
});

describe('la politique ne s’applique pas hors de l’inscription', () => {
  it('une connexion avec un mot de passe non conforme sur un compte existant renvoie 401, pas 400', async () => {
    const user = await registerUser(app);
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'court' }).expect(401);
    expect(res.body.error?.code).toBe('UNAUTHORIZED');
  });

  it('la suppression de compte avec un mot de passe non conforme renvoie 401, pas 400', async () => {
    const user = await registerUser(app);
    const res = await request(app).delete('/api/me').set(user.auth).send({ password: 'court' }).expect(401);
    expect(res.body.error?.code).toBe('UNAUTHORIZED');
  });
});
