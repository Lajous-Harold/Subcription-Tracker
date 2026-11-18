import request from 'supertest';
import { describe, expect, it } from '@jest/globals';
import { PaymentModel } from '../src/modules/subscriptions/models';
import { TransactionModel } from '../src/modules/transactions/model';
import { registerUser, testApp } from './helpers';

const app = testApp();

async function loadFixtures(auth: Record<string, string>) {
  return request(app).post('/api/demo/data').set(auth).expect(200);
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
    await request(app).delete('/api/demo/data').set(user.auth).expect(204);
    const tx = await request(app).get('/api/transactions').set(user.auth).expect(200);
    expect(tx.body.items).toHaveLength(0);
    const accounts = await request(app).get('/api/bank/accounts').set(user.auth).expect(200);
    expect(accounts.body.items).toHaveLength(0);
  });

  it('les données de démonstration sont absentes quand ENABLE_DEMO_DATA=false', async () => {
    const withoutDemo = testApp({ ENABLE_DEMO_DATA: 'false' });
    const user = await registerUser(withoutDemo);
    await request(withoutDemo).post('/api/demo/data').set(user.auth).expect(404);
  });
});

type CandidateItem = { id: string; label: string; provider: { slug: string } | null };

async function listCandidates(auth: Record<string, string>, status = 'pending'): Promise<CandidateItem[]> {
  const res = await request(app).get(`/api/detection/candidates?status=${status}`).set(auth).expect(200);
  return res.body.items;
}

function findBySlug(candidates: CandidateItem[], slug: string): CandidateItem {
  const found = candidates.find((candidate) => candidate.provider?.slug === slug);
  if (!found) throw new Error(`Candidat ${slug} absent des données de démonstration`);
  return found;
}

async function demoAccountId(auth: Record<string, string>): Promise<string> {
  const accounts = await request(app).get('/api/bank/accounts').set(auth).expect(200);
  return accounts.body.items[0].id;
}

async function setAnalyzed(auth: Record<string, string>, accountId: string, analyzed: boolean) {
  await request(app).patch(`/api/bank/accounts/${accountId}`).set(auth).send({ analyzed }).expect(200);
}

describe('nettoyage des candidats que la détection ne renvoie plus', () => {
  it('retire de la liste les candidats en attente d’un compte exclu de l’analyse', async () => {
    const user = await registerUser(app);
    await loadFixtures(user.auth);
    await setAnalyzed(user.auth, await demoAccountId(user.auth), false);

    await request(app).post('/api/detection/run').set(user.auth).expect(200);

    expect((await listCandidates(user.auth)).map((candidate) => candidate.label)).toEqual([]);
  });

  it('ne compte plus les candidats disparus ni dans l’exécution ni dans le tableau de bord', async () => {
    const user = await registerUser(app);
    await loadFixtures(user.auth);
    await setAnalyzed(user.auth, await demoAccountId(user.auth), false);

    const run = await request(app).post('/api/detection/run').set(user.auth).expect(200);
    const summary = await request(app).get('/api/dashboard/summary').set(user.auth).expect(200);

    expect(run.body.pending).toBe(0);
    expect(summary.body.pendingCandidates).toBe(0);
  });

  it('garde, avec le même identifiant, les seuls candidats en attente toujours détectés', async () => {
    const user = await registerUser(app);
    await loadFixtures(user.auth);
    const before = await listCandidates(user.auth);
    const netflix = findBySlug(before, 'netflix');
    // Simule des opérations supprimées côté banque, comme le fait la synchronisation Powens.
    await TransactionModel.updateMany(
      { userId: user.userId, rawLabel: /NETFLIX/ },
      { $set: { deletedAt: new Date() } },
    );

    await request(app).post('/api/detection/run').set(user.auth).expect(200);

    const after = await listCandidates(user.auth);
    const stillDetectedIds = before.filter((candidate) => candidate.id !== netflix.id).map((candidate) => candidate.id);
    expect(after.map((candidate) => candidate.id).sort()).toEqual(stillDetectedIds.sort());
  });

  it('ne supprime ni ne modifie les candidats acceptés, rejetés ou écartés', async () => {
    const user = await registerUser(app);
    await loadFixtures(user.auth);
    const pending = await listCandidates(user.auth);
    const accepted = findBySlug(pending, 'netflix');
    const rejected = findBySlug(pending, 'spotify');
    const dismissed = findBySlug(pending, 'claude');
    await request(app).post(`/api/detection/candidates/${accepted.id}/accept`).set(user.auth).send({}).expect(201);
    await request(app).post(`/api/detection/candidates/${rejected.id}/reject`).set(user.auth).expect(204);
    const toDismiss = await request(app)
      .post(`/api/detection/candidates/${dismissed.id}/accept`)
      .set(user.auth)
      .send({})
      .expect(201);
    await request(app).delete(`/api/subscriptions/${toDismiss.body.id}`).set(user.auth).expect(204);
    await setAnalyzed(user.auth, await demoAccountId(user.auth), false);

    await request(app).post('/api/detection/run').set(user.auth).expect(200);

    expect((await listCandidates(user.auth, 'accepted')).map((candidate) => candidate.id)).toEqual([accepted.id]);
    expect((await listCandidates(user.auth, 'rejected')).map((candidate) => candidate.id)).toEqual([rejected.id]);
    expect((await listCandidates(user.auth, 'dismissed')).map((candidate) => candidate.id)).toEqual([dismissed.id]);
  });

  it('propose un nouveau candidat en attente quand la série réapparaît', async () => {
    const user = await registerUser(app);
    await loadFixtures(user.auth);
    const original = findBySlug(await listCandidates(user.auth), 'spotify');
    const accountId = await demoAccountId(user.auth);
    await setAnalyzed(user.auth, accountId, false);
    await request(app).post('/api/detection/run').set(user.auth).expect(200);
    await setAnalyzed(user.auth, accountId, true);

    await request(app).post('/api/detection/run').set(user.auth).expect(200);

    const reappeared = findBySlug(await listCandidates(user.auth), 'spotify');
    expect(reappeared.id).not.toBe(original.id);
  });
});
