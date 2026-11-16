import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { PaymentModel } from '../src/modules/subscriptions/models';
import { registerUser, testApp } from './helpers';

const app = testApp();

async function loadFixtures(auth: Record<string, string>) {
  return request(app).post('/api/dev/fixtures').set(auth).expect(200);
}

describe('détection sur données fictives', () => {
  it('détecte les abonnements attendus avec confiance et raisons', async () => {
    const user = await registerUser(app);
    const loaded = await loadFixtures(user.auth);
    expect(loaded.body.detection.created).toBeGreaterThanOrEqual(6);

    const res = await request(app).get('/api/detection/candidates').set(user.auth).expect(200);
    const slugs = res.body.items.map((c: { provider: { slug: string } | null }) => c.provider?.slug).filter(Boolean);
    expect(slugs).toEqual(expect.arrayContaining(['spotify', 'netflix', 'chatgpt', 'claude', 'deezer']));
    const spotify = res.body.items.find((c: { provider: { slug: string } | null }) => c.provider?.slug === 'spotify');
    expect(spotify.level).toBe('high');
    expect(spotify.reasons.join(' ')).toContain('Fournisseur reconnu');
    const deezer = res.body.items.find((c: { provider: { slug: string } | null }) => c.provider?.slug === 'deezer');
    expect(deezer.stale).toBe(true);
    // Le loyer (virement) et les courses ne sortent pas.
    expect(res.body.items.some((c: { label: string }) => /Loyer|Carrefour/i.test(c.label))).toBe(false);
  });

  it('accepter crée l’abonnement observé et rattache les paiements ; relancer ne duplique rien', async () => {
    const user = await registerUser(app);
    await loadFixtures(user.auth);
    const list = await request(app).get('/api/detection/candidates').set(user.auth).expect(200);
    const netflix = list.body.items.find((c: { provider: { slug: string } | null }) => c.provider?.slug === 'netflix');

    const sub = await request(app)
      .post(`/api/detection/candidates/${netflix.id}/accept`)
      .set(user.auth)
      .send({})
      .expect(201);
    expect(sub.body.origin).toBe('detected');
    expect(sub.body.amount).toMatchObject({ value: { cents: 1599 }, origin: 'observed' });
    expect(sub.body.bankLinked).toBe(true);
    const payments = await request(app).get(`/api/subscriptions/${sub.body.id}/payments`).set(user.auth).expect(200);
    expect(payments.body.items.length).toBe(netflix.occurrences);
    expect(payments.body.items.every((p: { source: string }) => p.source === 'bank')).toBe(true);

    await request(app).post(`/api/detection/candidates/${netflix.id}/accept`).set(user.auth).send({}).expect(409);
    const rerun = await request(app).post('/api/detection/run').set(user.auth).expect(200);
    expect(rerun.body.created).toBe(0);
    expect(rerun.body.attachedPayments).toBe(0);
    expect(await PaymentModel.countDocuments({ subscriptionId: sub.body.id })).toBe(netflix.occurrences);
  });

  it('une correction déclarée survit à une nouvelle détection', async () => {
    const user = await registerUser(app);
    await loadFixtures(user.auth);
    const list = await request(app).get('/api/detection/candidates').set(user.auth).expect(200);
    const spotify = list.body.items.find((c: { provider: { slug: string } | null }) => c.provider?.slug === 'spotify');
    const sub = await request(app)
      .post(`/api/detection/candidates/${spotify.id}/accept`)
      .set(user.auth)
      .send({ label: 'Spotify Duo', amountCents: 1499 })
      .expect(201);
    expect(sub.body.amount).toMatchObject({ value: { cents: 1499 }, origin: 'declared' });
    expect(sub.body.label).toBe('Spotify Duo');

    await request(app).post('/api/detection/run').set(user.auth).expect(200);
    const after = await request(app).get(`/api/subscriptions/${sub.body.id}`).set(user.auth).expect(200);
    expect(after.body.amount).toMatchObject({ value: { cents: 1499 }, origin: 'declared' });

    // Remise en automatique : le montant observé reprend la main.
    const reset = await request(app)
      .post(`/api/subscriptions/${sub.body.id}/fields/amount/reset`)
      .set(user.auth)
      .expect(200);
    expect(reset.body.amount).toMatchObject({ value: { cents: 1099 }, origin: 'observed' });
  });

  it('un candidat rejeté n’est jamais reproposé', async () => {
    const user = await registerUser(app);
    await loadFixtures(user.auth);
    const list = await request(app).get('/api/detection/candidates').set(user.auth).expect(200);
    const target = list.body.items[0];
    await request(app).post(`/api/detection/candidates/${target.id}/reject`).set(user.auth).expect(204);
    await request(app).post('/api/detection/run').set(user.auth).expect(200);
    const after = await request(app).get('/api/detection/candidates').set(user.auth).expect(200);
    expect(after.body.items.find((c: { id: string }) => c.id === target.id)).toBeUndefined();
    expect(after.body.items.length).toBe(list.body.items.length - 1);
  });

  it('propose de fusionner avec un abonnement manuel du même fournisseur', async () => {
    const user = await registerUser(app);
    const providers = await request(app).get('/api/providers?q=claude').set(user.auth).expect(200);
    const manual = await request(app)
      .post('/api/subscriptions')
      .set(user.auth)
      .send({ label: 'Claude Pro', providerId: providers.body.items[0].id, amountCents: 2160 })
      .expect(201);
    await request(app)
      .post(`/api/subscriptions/${manual.body.id}/payments`)
      .set(user.auth)
      .send({ date: '2026-11-18', amountCents: 2160, note: 'saisi à la main' })
      .expect(201);
    await loadFixtures(user.auth);
    const list = await request(app).get('/api/detection/candidates').set(user.auth).expect(200);
    const claude = list.body.items.find((c: { provider: { slug: string } | null }) => c.provider?.slug === 'claude');
    expect(claude.suggestedSubscriptionId).toBe(manual.body.id);

    const merged = await request(app)
      .post(`/api/detection/candidates/${claude.id}/accept`)
      .set(user.auth)
      .send({ mergeIntoSubscriptionId: manual.body.id })
      .expect(201);
    expect(merged.body.id).toBe(manual.body.id);
    expect(merged.body.bankLinked).toBe(true);
    // Le montant déclaré à la main est conservé.
    expect(merged.body.amount.origin).toBe('declared');
  });

  it('les transactions de démonstration se retirent proprement', async () => {
    const user = await registerUser(app);
    await loadFixtures(user.auth);
    await request(app).delete('/api/dev/fixtures').set(user.auth).expect(204);
    const tx = await request(app).get('/api/transactions').set(user.auth).expect(200);
    expect(tx.body.items).toHaveLength(0);
    const accounts = await request(app).get('/api/bank/accounts').set(user.auth).expect(200);
    expect(accounts.body.items).toHaveLength(0);
  });

  it('les routes de développement sont absentes en production', async () => {
    const prod = (await import('./helpers')).testApp({ ENABLE_DEV_ROUTES: 'false' });
    const user = await registerUser(prod);
    await request(prod).post('/api/dev/fixtures').set(user.auth).expect(404);
  });
});
