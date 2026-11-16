import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ProviderModel } from '../src/modules/providers/model';
import { registerUser, testApp } from './helpers';

const app = testApp();

async function spotifyId() {
  const doc = await ProviderModel.findOne({ slug: 'spotify' }).lean();
  return doc!._id.toString();
}

describe('abonnements manuels (fonctionnent sans banque)', () => {
  it('crée un abonnement déclaré avec fournisseur connu', async () => {
    const user = await registerUser(app);
    const res = await request(app)
      .post('/api/subscriptions')
      .set(user.auth)
      .send({ label: 'Spotify Premium', providerId: await spotifyId(), amountCents: 1099, billingDay: 5 })
      .expect(201);
    expect(res.body.origin).toBe('manual');
    expect(res.body.amount).toMatchObject({ value: { cents: 1099, currency: 'EUR' }, origin: 'declared' });
    expect(res.body.billingDay).toMatchObject({ value: 5, origin: 'declared' });
    expect(res.body.provider.slug).toBe('spotify');
    expect(res.body.nextDueDate.origin).toBe('estimated');
    expect(res.body.nextDueDate.value.slice(8, 10)).toBe('05');
    expect(res.body.events[0].type).toBe('created');
  });

  it('accepte un fournisseur inconnu en nom libre, refuse les deux à la fois', async () => {
    const user = await registerUser(app);
    const res = await request(app)
      .post('/api/subscriptions')
      .set(user.auth)
      .send({ label: 'Salle de sport', customProviderName: 'Athletic Club', amountCents: 2999 })
      .expect(201);
    expect(res.body.provider).toBeNull();
    expect(res.body.customProviderName).toBe('Athletic Club');
    await request(app)
      .post('/api/subscriptions')
      .set(user.auth)
      .send({ label: 'X', providerId: await spotifyId(), customProviderName: 'Y', amountCents: 100 })
      .expect(400);
  });

  it('corrige, journalise et remet un champ en automatique', async () => {
    const user = await registerUser(app);
    const created = await request(app)
      .post('/api/subscriptions')
      .set(user.auth)
      .send({ label: 'Netflix', amountCents: 1349, nextDueDate: '2099-01-12' })
      .expect(201);
    expect(created.body.nextDueDate).toMatchObject({ value: '2099-01-12', origin: 'declared' });

    const updated = await request(app)
      .patch(`/api/subscriptions/${created.body.id}`)
      .set(user.auth)
      .send({ amountCents: 1599, label: 'Netflix Standard' })
      .expect(200);
    expect(updated.body.amount.value.cents).toBe(1599);
    expect(updated.body.events.some((e: { field: string }) => e.field === 'amount')).toBe(true);

    const reset = await request(app)
      .post(`/api/subscriptions/${created.body.id}/fields/nextDueDate/reset`)
      .set(user.auth)
      .expect(200);
    expect(reset.body.nextDueDate).toBeNull();

    await request(app).post(`/api/subscriptions/${created.body.id}/fields/amount/reset`).set(user.auth).expect(409);
  });

  it('gère les paiements manuels et calcule l’échéance depuis le dernier', async () => {
    const user = await registerUser(app);
    const sub = await request(app)
      .post('/api/subscriptions')
      .set(user.auth)
      .send({ label: 'Deezer', amountCents: 1199 })
      .expect(201);
    const payment = await request(app)
      .post(`/api/subscriptions/${sub.body.id}/payments`)
      .set(user.auth)
      .send({ date: '2026-01-20', amountCents: 1199 })
      .expect(201);
    expect(payment.body.source).toBe('manual');
    const detail = await request(app).get(`/api/subscriptions/${sub.body.id}`).set(user.auth).expect(200);
    expect(detail.body.lastPaymentDate).toBe('2026-01-20');
    expect(detail.body.nextDueDate.value.slice(8, 10)).toBe('20');
    expect(detail.body.paymentMissing).toBe(false);

    await request(app)
      .delete(`/api/subscriptions/${sub.body.id}/payments/${payment.body.id}`)
      .set(user.auth)
      .expect(204);
    const payments = await request(app).get(`/api/subscriptions/${sub.body.id}/payments`).set(user.auth).expect(200);
    expect(payments.body.items).toHaveLength(0);
  });

  it('suit une résiliation manuelle sans jamais rien envoyer au fournisseur', async () => {
    const user = await registerUser(app);
    const sub = await request(app)
      .post('/api/subscriptions')
      .set(user.auth)
      .send({ label: 'Canal+', amountCents: 2499 })
      .expect(201);
    const started = await request(app)
      .put(`/api/subscriptions/${sub.body.id}/cancellation`)
      .set(user.auth)
      .send({ status: 'started', method: 'online' })
      .expect(200);
    expect(started.body.status).toBe('cancellation_pending');
    const requested = await request(app)
      .put(`/api/subscriptions/${sub.body.id}/cancellation`)
      .set(user.auth)
      .send({ status: 'requested', reference: 'RES-123' })
      .expect(200);
    expect(requested.body.cancellation).toMatchObject({ status: 'requested', method: 'online', reference: 'RES-123' });
    expect(requested.body.cancellation.requestedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const confirmed = await request(app)
      .put(`/api/subscriptions/${sub.body.id}/cancellation`)
      .set(user.auth)
      .send({ status: 'confirmed', effectiveDate: '2026-12-31' })
      .expect(200);
    expect(confirmed.body.status).toBe('cancelled');
    expect(confirmed.body.nextDueDate).toBeNull();
    const cleared = await request(app)
      .delete(`/api/subscriptions/${sub.body.id}/cancellation`)
      .set(user.auth)
      .expect(200);
    expect(cleared.body.status).toBe('active');
  });

  it('supprimer un abonnement le retire de l’application', async () => {
    const user = await registerUser(app);
    const sub = await request(app)
      .post('/api/subscriptions')
      .set(user.auth)
      .send({ label: 'Test', amountCents: 500 })
      .expect(201);
    await request(app).delete(`/api/subscriptions/${sub.body.id}`).set(user.auth).expect(204);
    await request(app).get(`/api/subscriptions/${sub.body.id}`).set(user.auth).expect(404);
  });

  it('tableau de bord : total mensuel, projection, séparation observé / déclaré', async () => {
    const user = await registerUser(app);
    for (const [label, amountCents] of [
      ['A', 1000],
      ['B', 2500],
    ] as const) {
      await request(app).post('/api/subscriptions').set(user.auth).send({ label, amountCents }).expect(201);
    }
    await request(app)
      .post('/api/subscriptions')
      .set(user.auth)
      .send({ label: 'USD', amountCents: 2000, currency: 'USD' })
      .expect(201);
    const res = await request(app).get('/api/dashboard/summary').set(user.auth).expect(200);
    expect(res.body.trackedCount).toBe(3);
    expect(res.body.monthly).toEqual({ totalCents: 3500, observedCents: 0, declaredCents: 3500 });
    expect(res.body.annualProjectionCents).toBe(42000);
    expect(res.body.excludedOtherCurrencies).toEqual([{ currency: 'USD', count: 1 }]);
    expect(res.body.bank).toBeNull();
  });
});

describe('catalogue fournisseurs', () => {
  it('liste et recherche les fournisseurs avec leur procédure de résiliation', async () => {
    const user = await registerUser(app);
    const all = await request(app).get('/api/providers').set(user.auth).expect(200);
    expect(all.body.items.length).toBeGreaterThanOrEqual(20);
    for (const provider of all.body.items) {
      expect(provider.cancellation.instructions.length).toBeGreaterThan(20);
      expect(
        provider.cancellation.lastVerifiedAt === null ||
          /^\d{4}-\d{2}-\d{2}$/.test(provider.cancellation.lastVerifiedAt),
      ).toBe(true);
    }
    const verified = all.body.items.filter(
      (p: { cancellation: { lastVerifiedAt: string | null } }) => p.cancellation.lastVerifiedAt,
    );
    expect(verified.length).toBeGreaterThanOrEqual(9);
    const search = await request(app).get('/api/providers?q=netf').set(user.auth).expect(200);
    expect(search.body.items.map((p: { slug: string }) => p.slug)).toEqual(['netflix']);
    await request(app).get('/api/providers/netflix').set(user.auth).expect(200);
    await request(app).get('/api/providers/inconnu').set(user.auth).expect(404);
  });
});
