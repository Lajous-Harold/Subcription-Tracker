import request from 'supertest';
import { describe, expect, it } from '@jest/globals';
import { registerUser, testApp } from './helpers';

const app = testApp();

/** Un utilisateur B ne peut ni lire ni modifier les ressources de A : 404 systématique. */
describe('isolation stricte entre utilisateurs', () => {
  it('abonnements, paiements, résiliation, candidats, comptes', async () => {
    const alice = await registerUser(app);
    const bob = await registerUser(app);

    const sub = await request(app)
      .post('/api/subscriptions')
      .set(alice.auth)
      .send({ label: 'Privé', amountCents: 999 })
      .expect(201);
    const payment = await request(app)
      .post(`/api/subscriptions/${sub.body.id}/payments`)
      .set(alice.auth)
      .send({ date: '2026-02-01', amountCents: 999 })
      .expect(201);
    await request(app).post('/api/demo/data').set(alice.auth).expect(200);
    const candidates = await request(app).get('/api/detection/candidates').set(alice.auth).expect(200);
    const accounts = await request(app).get('/api/bank/accounts').set(alice.auth).expect(200);
    const candidateId = candidates.body.items[0].id;
    const accountId = accounts.body.items[0].id;

    const id = sub.body.id;
    await request(app).get(`/api/subscriptions/${id}`).set(bob.auth).expect(404);
    await request(app).patch(`/api/subscriptions/${id}`).set(bob.auth).send({ label: 'Volé' }).expect(404);
    await request(app).delete(`/api/subscriptions/${id}`).set(bob.auth).expect(404);
    await request(app).get(`/api/subscriptions/${id}/payments`).set(bob.auth).expect(404);
    await request(app)
      .post(`/api/subscriptions/${id}/payments`)
      .set(bob.auth)
      .send({ date: '2026-02-01', amountCents: 1 })
      .expect(404);
    await request(app).delete(`/api/subscriptions/${id}/payments/${payment.body.id}`).set(bob.auth).expect(404);
    await request(app)
      .put(`/api/subscriptions/${id}/cancellation`)
      .set(bob.auth)
      .send({ status: 'started' })
      .expect(404);
    await request(app).post(`/api/detection/candidates/${candidateId}/accept`).set(bob.auth).send({}).expect(404);
    await request(app).post(`/api/detection/candidates/${candidateId}/reject`).set(bob.auth).expect(404);
    await request(app).patch(`/api/bank/accounts/${accountId}`).set(bob.auth).send({ analyzed: false }).expect(404);

    const bobList = await request(app).get('/api/subscriptions').set(bob.auth).expect(200);
    expect(bobList.body.items).toHaveLength(0);
    const bobCandidates = await request(app).get('/api/detection/candidates').set(bob.auth).expect(200);
    expect(bobCandidates.body.items).toHaveLength(0);
    const bobTx = await request(app).get('/api/transactions').set(bob.auth).expect(200);
    expect(bobTx.body.items).toHaveLength(0);

    // Bob ne peut pas rattacher une transaction d'Alice à son propre abonnement.
    const aliceTx = await request(app).get('/api/transactions?limit=1').set(alice.auth).expect(200);
    const bobSub = await request(app)
      .post('/api/subscriptions')
      .set(bob.auth)
      .send({ label: 'Bob', amountCents: 100 })
      .expect(201);
    await request(app)
      .post(`/api/subscriptions/${bobSub.body.id}/payments/link`)
      .set(bob.auth)
      .send({ transactionId: aliceTx.body.items[0].id })
      .expect(404);
  });

  it('identifiants malformés : 400 ou 404, jamais 500', async () => {
    const user = await registerUser(app);
    const res = await request(app).get('/api/subscriptions/pas-un-id').set(user.auth);
    expect([400, 404]).toContain(res.status);
  });
});
