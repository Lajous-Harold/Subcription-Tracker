import request, { type Response } from 'supertest';
import { describe, expect, it } from '@jest/globals';
import { registerUser, testApp } from './helpers';

/**
 * Validation stricte des entrées : un identifiant d'URL malformé, un `id` / `ownerId` fourni par le client
 * ou une propriété inconnue dans le corps sont refusés en 400 INVALID_INPUT, sans aucun effet de bord.
 */
const app = testApp();
const BASE = '/api/subscriptions';
const MALFORMED_ID = 'pas-un-id';
const ABSENT_ID = '0123456789abcdef01234567';
const SOME_OBJECT_ID = '507f1f77bcf86cd799439011';

function expectInvalidInput(res: Response) {
  expect(res.status).toBe(400);
  expect(res.body.error?.code).toBe('INVALID_INPUT');
}

async function createSpotify(auth: Record<string, string>) {
  const res = await request(app).post(BASE).set(auth).send({ label: 'Spotify', amountCents: 1099 }).expect(201);
  return res.body.id as string;
}

type Call = (auth: Record<string, string>, id: string) => request.Test;

const routesWithIdParam: Array<[string, Call]> = [
  ['GET /subscriptions/:id', (auth, id) => request(app).get(`${BASE}/${id}`).set(auth)],
  ['PATCH /subscriptions/:id', (auth, id) => request(app).patch(`${BASE}/${id}`).set(auth).send({ label: 'Deezer' })],
  ['DELETE /subscriptions/:id', (auth, id) => request(app).delete(`${BASE}/${id}`).set(auth)],
  ['GET /subscriptions/:id/payments', (auth, id) => request(app).get(`${BASE}/${id}/payments`).set(auth)],
  [
    'POST /detection/candidates/:id/reject',
    (auth, id) => request(app).post(`/api/detection/candidates/${id}/reject`).set(auth),
  ],
];

describe('identifiant malformé dans l’URL -> 400 INVALID_INPUT', () => {
  it.each(routesWithIdParam)('%s refuse « pas-un-id »', async (_route, call) => {
    const user = await registerUser(app);
    const res = await call(user.auth, MALFORMED_ID);
    expectInvalidInput(res);
  });

  it.each(routesWithIdParam)(
    '%s : un identifiant bien formé mais absent reste en 404 NOT_FOUND',
    async (_route, call) => {
      const user = await registerUser(app);
      const res = await call(user.auth, ABSENT_ID);
      expect(res.status).toBe(404);
      expect(res.body.error?.code).toBe('NOT_FOUND');
    },
  );
});

describe('POST /subscriptions : corps strict', () => {
  it('accepte un corps valide sans champ en trop (201)', async () => {
    const user = await registerUser(app);
    const res = await request(app).post(BASE).set(user.auth).send({ label: 'Netflix', amountCents: 1349 });
    expect(res.status).toBe(201);
    expect(res.body.label).toBe('Netflix');
  });

  it.each([
    ['ownerId', { label: 'Netflix', amountCents: 1349, ownerId: SOME_OBJECT_ID }],
    ['id', { label: 'Netflix', amountCents: 1349, id: SOME_OBJECT_ID }],
    ['une propriété inconnue (couleur)', { label: 'Netflix', amountCents: 1349, couleur: 'rouge' }],
  ])('refuse un corps contenant %s, sans rien créer', async (_case, body) => {
    const user = await registerUser(app);
    const res = await request(app).post(BASE).set(user.auth).send(body);
    expectInvalidInput(res);

    const list = await request(app).get(BASE).set(user.auth).expect(200);
    expect(list.body.items).toEqual([]);
  });
});

describe('PATCH /subscriptions/:id : corps strict', () => {
  it('accepte un corps valide sans champ en trop (200)', async () => {
    const user = await registerUser(app);
    const id = await createSpotify(user.auth);
    const res = await request(app).patch(`${BASE}/${id}`).set(user.auth).send({ label: 'Spotify Duo' });
    expect(res.status).toBe(200);
    expect(res.body.label).toBe('Spotify Duo');
  });

  it('refuse toujours un corps vide {}', async () => {
    const user = await registerUser(app);
    const id = await createSpotify(user.auth);
    const res = await request(app).patch(`${BASE}/${id}`).set(user.auth).send({});
    expectInvalidInput(res);
  });

  it.each([
    ['ownerId seul', { ownerId: SOME_OBJECT_ID }],
    ['un label accompagné d’un id', { label: 'X', id: SOME_OBJECT_ID }],
    ['un label accompagné d’une propriété inconnue (couleur)', { label: 'X', couleur: 'rouge' }],
  ])('refuse un corps contenant %s, sans modifier l’abonnement', async (_case, body) => {
    const user = await registerUser(app);
    const id = await createSpotify(user.auth);
    const res = await request(app).patch(`${BASE}/${id}`).set(user.auth).send(body);
    expectInvalidInput(res);

    const detail = await request(app).get(`${BASE}/${id}`).set(user.auth).expect(200);
    expect(detail.body.id).toBe(id);
    expect(detail.body.label).toBe('Spotify');
    expect(detail.body.amount.value.cents).toBe(1099);
  });
});
