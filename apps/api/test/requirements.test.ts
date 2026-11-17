import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from '@jest/globals';
import { registerUser, testApp } from './helpers';

/**
 * Exigences minimales de la suite de tests (livret, TP 8), sur la ressource métier principale :
 * (1) parcours CRUD nominal ; (2) donnée métier invalide -> 400 ;
 * (3) accès sans JWT valide -> 401 ; (4) B ne peut ni lire ni modifier un objet de A.
 */
const app = testApp();
const BASE = '/api/subscriptions';

describe('TP 8 (1) : parcours CRUD nominal', () => {
  it('crée, liste, consulte, modifie puis supprime un abonnement', async () => {
    const user = await registerUser(app);

    const empty = await request(app).get(BASE).set(user.auth).expect(200);
    expect(empty.body.items).toEqual([]);

    const created = await request(app)
      .post(BASE)
      .set(user.auth)
      .send({ label: 'Netflix Standard', amountCents: 1349 })
      .expect(201);
    const id = created.body.id;
    expect(typeof id).toBe('string');
    expect(created.body.label).toBe('Netflix Standard');
    expect(created.body.amount.value.cents).toBe(1349);

    const list = await request(app).get(BASE).set(user.auth).expect(200);
    expect(list.body.items.map((item: { id: string }) => item.id)).toEqual([id]);

    const detail = await request(app).get(`${BASE}/${id}`).set(user.auth).expect(200);
    expect(detail.body.label).toBe('Netflix Standard');

    const updated = await request(app).patch(`${BASE}/${id}`).set(user.auth).send({ amountCents: 1499 }).expect(200);
    expect(updated.body.amount.value.cents).toBe(1499);
    expect(updated.body.label).toBe('Netflix Standard');

    const deleted = await request(app).delete(`${BASE}/${id}`).set(user.auth).expect(204);
    expect(deleted.text).toBe('');
    await request(app).get(`${BASE}/${id}`).set(user.auth).expect(404);
  });
});

describe('TP 8 (2) : donnée métier invalide -> 400', () => {
  it.each([
    ['montant décimal', { label: 'Courses', amountCents: 12.34 }],
    ['montant nul', { label: 'Courses', amountCents: 0 }],
    ['montant négatif', { label: 'Courses', amountCents: -500 }],
    ['montant en chaîne', { label: 'Courses', amountCents: '1234' }],
    ['libellé vide après trim', { label: '   ', amountCents: 1234 }],
    ['libellé absent', { amountCents: 1234 }],
    ['date impossible', { label: 'Courses', amountCents: 1234, nextDueDate: '2026-02-30' }],
  ])('POST refusé : %s', async (_case, body) => {
    const user = await registerUser(app);
    await request(app).post(BASE).set(user.auth).send(body).expect(400);
    const list = await request(app).get(BASE).set(user.auth).expect(200);
    expect(list.body.items).toHaveLength(0);
  });

  it('PATCH vide ou invalide refusé, sans modifier l’objet', async () => {
    const user = await registerUser(app);
    const sub = await request(app).post(BASE).set(user.auth).send({ label: 'Spotify', amountCents: 1099 }).expect(201);
    await request(app).patch(`${BASE}/${sub.body.id}`).set(user.auth).send({}).expect(400);
    await request(app).patch(`${BASE}/${sub.body.id}`).set(user.auth).send({ amountCents: -1 }).expect(400);
    const detail = await request(app).get(`${BASE}/${sub.body.id}`).set(user.auth).expect(200);
    expect(detail.body.amount.value.cents).toBe(1099);
  });
});

describe('TP 8 (3) : accès sans JWT valide -> 401', () => {
  const forged = jwt.sign({ sid: 'session' }, 'une-autre-cle-de-signature-de-32-caracteres', {
    subject: '507f1f77bcf86cd799439011',
  });

  it.each([
    ['sans en-tête Authorization', undefined],
    ['jeton malformé', 'Bearer pas-un-jwt'],
    ['jeton signé avec une autre clé', `Bearer ${forged}`],
    ['schéma autre que Bearer', 'Basic dXNlcjpwYXNz'],
  ])('%s', async (_case, header) => {
    const user = await registerUser(app);
    const sub = await request(app).post(BASE).set(user.auth).send({ label: 'Privé', amountCents: 999 }).expect(201);

    const withHeader = (req: request.Test) => (header ? req.set('Authorization', header) : req);
    const list = await withHeader(request(app).get(BASE)).expect(401);
    expect(list.body.items).toBeUndefined();
    await withHeader(request(app).post(BASE)).send({ label: 'X', amountCents: 1 }).expect(401);
    await withHeader(request(app).get(`${BASE}/${sub.body.id}`)).expect(401);
    await withHeader(request(app).patch(`${BASE}/${sub.body.id}`))
      .send({ label: 'Y' })
      .expect(401);
    await withHeader(request(app).delete(`${BASE}/${sub.body.id}`)).expect(401);

    // Rien n'a changé pour le propriétaire.
    const detail = await request(app).get(`${BASE}/${sub.body.id}`).set(user.auth).expect(200);
    expect(detail.body.label).toBe('Privé');
  });
});

describe('TP 8 (4) : B ne peut ni lire ni modifier un objet de A', () => {
  it('404 en lecture, modification et suppression ; liste de B vide ; objet de A intact', async () => {
    const alice = await registerUser(app);
    const bob = await registerUser(app);
    const sub = await request(app).post(BASE).set(alice.auth).send({ label: 'Alice', amountCents: 999 }).expect(201);
    const id = sub.body.id;

    const bobList = await request(app).get(BASE).set(bob.auth).expect(200);
    expect(bobList.body.items).toEqual([]);
    await request(app).get(`${BASE}/${id}`).set(bob.auth).expect(404);
    await request(app).patch(`${BASE}/${id}`).set(bob.auth).send({ label: 'Volé', amountCents: 1 }).expect(404);
    await request(app).delete(`${BASE}/${id}`).set(bob.auth).expect(404);

    const detail = await request(app).get(`${BASE}/${id}`).set(alice.auth).expect(200);
    expect(detail.body.label).toBe('Alice');
    expect(detail.body.amount.value.cents).toBe(999);
  });
});
