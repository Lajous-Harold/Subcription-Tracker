import nock from 'nock';
import request from 'supertest';
import { describe, expect, it } from '@jest/globals';
import { purgeExpiredData } from '../src/jobs/scheduler';
import { BankLinkModel, PowensCleanupModel, WebhookEventModel } from '../src/modules/bank/models';
import { waitForSyncs } from '../src/modules/bank/sync';
import { signWebhookForTests } from '../src/modules/powens/client';
import { PaymentModel, SubscriptionModel } from '../src/modules/subscriptions/models';
import { TransactionModel } from '../src/modules/transactions/model';
import { registerUser, testApp, type TestApp } from './helpers';

const POWENS = 'https://test-sandbox.biapi.pro';
const app = testApp();

type Auth = Awaited<ReturnType<typeof registerUser>>;

function monthly(day: number, months: number, from = new Date()) {
  const dates: string[] = [];
  for (let i = months; i >= 1; i -= 1) {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - i, day));
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

const spotifyDates = monthly(5, 5);
const POWENS_TRANSACTIONS = [
  ...spotifyDates.map((date, index) => ({
    id: 1000 + index,
    id_account: 11,
    date,
    value: -10.99,
    original_wording: `CB SPOTIFY P3A1B2C3 STOCKHOLM ${date.slice(8, 10)}/${date.slice(5, 7)}`,
    type: 'card',
    coming: false,
    deleted: null,
    last_update: `${date} 10:00:00`,
  })),
  // crédit : jamais importé (décision D2)
  {
    id: 2000,
    id_account: 11,
    date: spotifyDates[0],
    value: 1850,
    original_wording: 'VIR SALAIRE',
    type: 'transfer',
    last_update: '2026-01-01 10:00:00',
  },
  // compte non analysé : ignoré
  {
    id: 3000,
    id_account: 99,
    date: spotifyDates[0],
    value: -50,
    original_wording: 'CB AUTRE',
    type: 'card',
    last_update: '2026-01-01 10:00:00',
  },
];

const CONNECTION = {
  id: 7,
  id_user: 42,
  state: null,
  last_update: '2026-11-10 10:00:00',
  expire: new Date(Date.now() + 120 * 86_400_000).toISOString(),
  connector: { name: 'Connecteur de test' },
};

const ACCOUNTS = {
  accounts: [
    { id: 11, name: 'Compte courant', type: 'checking', balance: 1234.56, currency: { id: 'EUR' }, disabled: null },
    { id: 99, name: 'Livret', type: 'savings', balance: 10, currency: { id: 'EUR' }, disabled: '2026-01-01 00:00:00' },
  ],
};

function mockSyncCalls(transactions = POWENS_TRANSACTIONS, connection: object = CONNECTION) {
  nock(POWENS).get('/2.0/users/me/connections/7').query(true).reply(200, connection);
  nock(POWENS).get('/2.0/users/me/accounts').query(true).reply(200, ACCOUNTS);
  // Deux pages : vérifie le suivi de `_links.next`.
  nock(POWENS)
    .get('/2.0/users/me/transactions')
    .query((query) => !('offset' in query))
    .reply(200, {
      transactions: transactions.slice(0, 3),
      _links: { next: { href: '/2.0/users/me/transactions?limit=1000&offset=3&all' } },
    });
  nock(POWENS)
    .get('/2.0/users/me/transactions')
    .query((query) => query.offset === '3')
    .reply(200, { transactions: transactions.slice(3), _links: { next: null } });
}

async function startConnect(target: TestApp, user: Auth, platform: 'web' | 'native' = 'native') {
  nock(POWENS).post('/2.0/auth/init', { client_id: 'client-id', client_secret: 'client-secret' }).reply(200, {
    auth_token: 'powens-user-token',
    type: 'permanent',
    id_user: 42,
  });
  nock(POWENS)
    .get('/2.0/auth/token/code')
    .matchHeader('authorization', 'Bearer powens-user-token')
    .reply(200, { code: 'tmp-code' });
  const res = await request(target)
    .post('/api/bank/connect-sessions')
    .set(user.auth)
    .send({ flow: 'connect', platform })
    .expect(201);
  return { ...res.body, state: new URL(res.body.url).searchParams.get('state') as string };
}

async function connectBank(user: Auth) {
  const session = await startConnect(app, user);
  mockSyncCalls();
  nock(POWENS).get('/2.0/users/me/connections/7').query(true).reply(200, CONNECTION);
  nock(POWENS).get('/2.0/users/me/accounts').query(true).reply(200, ACCOUNTS);
  const res = await request(app)
    .post('/api/bank/connect-sessions/complete')
    .set(user.auth)
    .send({ state: session.state, connectionId: '7' })
    .expect(200);
  await waitForSyncs();
  return res.body;
}

describe('connexion bancaire Powens (simulée)', () => {
  it('construit l’URL Webview officielle sans exposer de secret', async () => {
    const user = await registerUser(app);
    const session = await startConnect(app, user);
    const url = new URL(session.url);
    expect(url.origin + url.pathname).toBe('https://webview.powens.com/fr/connect');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      domain: 'test-sandbox.biapi.pro',
      client_id: 'client-id',
      redirect_uri: 'subtracker://powens/callback',
      code: 'tmp-code',
      connector_capabilities: 'bank',
      max_connections: '1',
    });
    expect(session.url).not.toContain('client-secret');
    expect(session.url).not.toContain('powens-user-token');
    const link = await BankLinkModel.findOne({ userId: user.userId }).lean();
    expect(link?.powensTokenEnc).toBeTruthy();
    expect(link?.powensTokenEnc).not.toContain('powens-user-token');

    const web = await registerUser(app);
    const webSession = await startConnect(app, web, 'web');
    expect(new URL(webSession.url).searchParams.get('redirect_uri')).toBe('http://localhost:8081/powens/callback');
  });

  it('finalise, importe les débits des comptes analysés, détecte, sans doublon au second passage', async () => {
    const user = await registerUser(app);
    const link = await connectBank(user);
    expect(link.connectorName).toBe('Connecteur de test');

    const stored = await TransactionModel.find({ userId: user.userId }).lean();
    expect(stored).toHaveLength(spotifyDates.length);
    expect(stored.every((tx) => tx.amountCents === -1099)).toBe(true);

    const after = await request(app).get('/api/bank/link').set(user.auth).expect(200);
    expect(after.body.link).toMatchObject({ status: 'connected', consentExpiringSoon: false });
    expect(after.body.link.lastSyncAt).toBeTruthy();

    const candidates = await request(app).get('/api/detection/candidates').set(user.auth).expect(200);
    expect(candidates.body.items).toHaveLength(1);
    expect(candidates.body.items[0].provider.slug).toBe('spotify');

    // Second passage : le curseur last_update est transmis, aucun doublon.
    const latest = POWENS_TRANSACTIONS.map((tx) => tx.last_update)
      .sort()
      .at(-1)!;
    nock(POWENS).put('/2.0/users/me/connections/7').reply(200, CONNECTION);
    nock(POWENS).get('/2.0/users/me/connections/7').query(true).reply(200, CONNECTION);
    nock(POWENS).get('/2.0/users/me/accounts').query(true).reply(200, ACCOUNTS);
    nock(POWENS)
      .get('/2.0/users/me/transactions')
      .query((query) => query.last_update === latest)
      .reply(200, { transactions: POWENS_TRANSACTIONS.slice(0, 2), _links: { next: null } });
    await request(app).post('/api/bank/sync').set(user.auth).expect(202);
    await waitForSyncs();
    expect(await TransactionModel.countDocuments({ userId: user.userId })).toBe(spotifyDates.length);
    expect(nock.pendingMocks()).toEqual([]);
  });

  it('suppression côté banque : la transaction est marquée supprimée et sort de la détection', async () => {
    const user = await registerUser(app);
    await connectBank(user);
    const removed = { ...POWENS_TRANSACTIONS[0]!, deleted: '2026-11-15 10:00:00', last_update: '2099-01-01 00:00:00' };
    nock(POWENS).get('/2.0/users/me/connections/7').query(true).reply(200, CONNECTION);
    nock(POWENS).get('/2.0/users/me/accounts').query(true).reply(200, ACCOUNTS);
    nock(POWENS)
      .get('/2.0/users/me/transactions')
      .query(true)
      .reply(200, { transactions: [removed] });
    nock(POWENS).put('/2.0/users/me/connections/7').reply(200, CONNECTION);
    await request(app).post('/api/bank/sync').set(user.auth).expect(202);
    await waitForSyncs();
    const doc = await TransactionModel.findOne({ externalId: String(removed.id) }).lean();
    expect(doc?.deletedAt).toBeTruthy();
    const list = await request(app).get('/api/transactions').set(user.auth).expect(200);
    expect(list.body.items).toHaveLength(spotifyDates.length - 1);
  });

  it('refuse un state invalide, réutilisé ou appartenant à un autre utilisateur', async () => {
    const alice = await registerUser(app);
    const bob = await registerUser(app);
    const session = await startConnect(app, alice);

    await request(app)
      .post('/api/bank/connect-sessions/complete')
      .set(alice.auth)
      .send({ state: 'x'.repeat(40), connectionId: '7' })
      .expect(400);
    await request(app)
      .post('/api/bank/connect-sessions/complete')
      .set(bob.auth)
      .send({ state: session.state, connectionId: '7' })
      .expect(400);

    nock(POWENS).get('/2.0/users/me/connections/7').query(true).reply(200, CONNECTION);
    nock(POWENS).get('/2.0/users/me/accounts').query(true).reply(200, ACCOUNTS);
    mockSyncCalls();
    await request(app)
      .post('/api/bank/connect-sessions/complete')
      .set(alice.auth)
      .send({ state: session.state, connectionId: '7' })
      .expect(200);
    await waitForSyncs();
    const reused = await request(app)
      .post('/api/bank/connect-sessions/complete')
      .set(alice.auth)
      .send({ state: session.state, connectionId: '7' })
      .expect(400);
    expect(reused.body.code).toBe('invalid_state');
  });

  it('remonte proprement l’annulation dans la Webview', async () => {
    const user = await registerUser(app);
    const session = await startConnect(app, user);
    const res = await request(app)
      .post('/api/bank/connect-sessions/complete')
      .set(user.auth)
      .send({ state: session.state, error: 'access_denied', errorDescription: 'User cancelled' })
      .expect(400);
    expect(res.body.code).toBe('webview_access_denied');
    expect(res.body.title).toBe('Connexion annulée');
  });

  it('une seule connexion bancaire par utilisateur', async () => {
    const user = await registerUser(app);
    await connectBank(user);
    await request(app)
      .post('/api/bank/connect-sessions')
      .set(user.auth)
      .send({ flow: 'connect', platform: 'native' })
      .expect(409);
  });

  it('SCA requise : statut « action requise » et parcours reconnect avec connection_id', async () => {
    const user = await registerUser(app);
    await connectBank(user);
    nock(POWENS).put('/2.0/users/me/connections/7').reply(400, { code: 'SCARequired', message: 'SCA required' });
    nock(POWENS)
      .get('/2.0/users/me/connections/7')
      .query(true)
      .reply(200, { ...CONNECTION, state: 'SCARequired' });
    nock(POWENS).get('/2.0/users/me/accounts').query(true).reply(200, ACCOUNTS);
    nock(POWENS).get('/2.0/users/me/transactions').query(true).reply(200, { transactions: [] });
    const res = await request(app).post('/api/bank/sync').set(user.auth).expect(202);
    expect(res.body.status).toBe('action_required');
    await waitForSyncs();

    nock(POWENS).get('/2.0/auth/token/code').reply(200, { code: 'tmp-2' });
    const reconnect = await request(app)
      .post('/api/bank/connect-sessions')
      .set(user.auth)
      .send({ flow: 'reconnect', platform: 'native' })
      .expect(201);
    const url = new URL(reconnect.body.url);
    expect(url.pathname).toBe('/fr/reconnect');
    expect(url.searchParams.get('connection_id')).toBe('7');
  });

  it('signale un consentement qui expire bientôt', async () => {
    const user = await registerUser(app);
    await connectBank(user);
    await BankLinkModel.updateOne(
      { userId: user.userId },
      { $set: { consentExpiresAt: new Date(Date.now() + 3 * 86_400_000) } },
    );
    const res = await request(app).get('/api/bank/link').set(user.auth).expect(200);
    expect(res.body.link.consentExpiringSoon).toBe(true);
    const summary = await request(app).get('/api/dashboard/summary').set(user.auth).expect(200);
    expect(summary.body.bank).toEqual({ status: 'connected', consentExpiringSoon: true });
  });

  it('exclure un compte de l’analyse est un choix local', async () => {
    const user = await registerUser(app);
    await connectBank(user);
    const accounts = await request(app).get('/api/bank/accounts').set(user.auth).expect(200);
    const savings = accounts.body.items.find((a: { name: string }) => a.name === 'Livret');
    expect(savings.sharedWithApp).toBe(false);
    const current = accounts.body.items.find((a: { name: string }) => a.name === 'Compte courant');
    const res = await request(app)
      .patch(`/api/bank/accounts/${current.id}`)
      .set(user.auth)
      .send({ analyzed: false })
      .expect(200);
    expect(res.body.analyzed).toBe(false);
    const rerun = await request(app).post('/api/detection/run').set(user.auth).expect(200);
    expect(rerun.body.analyzedTransactions).toBe(0);
  });

  it('déconnexion : supprime chez Powens, purge les opérations, garde les abonnements', async () => {
    const user = await registerUser(app);
    await connectBank(user);
    const [candidate] = (await request(app).get('/api/detection/candidates').set(user.auth)).body.items;
    const sub = await request(app)
      .post(`/api/detection/candidates/${candidate.id}/accept`)
      .set(user.auth)
      .send({})
      .expect(201);

    nock(POWENS).delete('/2.0/users/me/connections/7').reply(204);
    nock(POWENS).delete('/2.0/users/me').reply(204);
    await request(app).delete('/api/bank/link').set(user.auth).expect(204);
    expect(nock.pendingMocks()).toEqual([]);
    expect(await TransactionModel.countDocuments({ userId: user.userId })).toBe(0);
    expect(await BankLinkModel.countDocuments({ userId: user.userId })).toBe(0);
    expect(await SubscriptionModel.countDocuments({ _id: sub.body.id })).toBe(1);
    const payments = await PaymentModel.find({ subscriptionId: sub.body.id }).lean();
    expect(payments.length).toBeGreaterThan(0);
    expect(payments.every((p) => p.transactionId === null)).toBe(true);
  });

  it('suppression du compte : un échec Powens est mis en file sans bloquer la purge', async () => {
    const user = await registerUser(app);
    await connectBank(user);
    nock(POWENS).delete('/2.0/users/me/connections/7').reply(503, { code: 'websiteUnavailable' });
    await request(app).delete('/api/me').set(user.auth).send({ password: user.password }).expect(204);
    expect(await PowensCleanupModel.countDocuments()).toBe(1);
    expect(await TransactionModel.countDocuments({ userId: user.userId })).toBe(0);
  });

  it('sans identifiants Powens : 503 explicite, le reste de l’application fonctionne', async () => {
    const bare = testApp({ POWENS_DOMAIN: '', POWENS_CLIENT_ID: '', POWENS_CLIENT_SECRET: '' });
    const user = await registerUser(bare);
    const res = await request(bare)
      .post('/api/bank/connect-sessions')
      .set(user.auth)
      .send({ flow: 'connect', platform: 'web' })
      .expect(503);
    expect(res.body.code).toBe('powens_not_configured');
    await request(bare)
      .post('/api/subscriptions')
      .set(user.auth)
      .send({ label: 'Manuel', amountCents: 500 })
      .expect(201);
    testApp(); // restaure la configuration par défaut pour les tests suivants
  });
});

describe('webhooks Powens', () => {
  const path = '/api/webhooks/powens/CONNECTION_SYNCED';

  function signed(payload: object, options: { date?: string; secret?: string } = {}) {
    const body = JSON.stringify(payload);
    const date = options.date ?? new Date().toISOString();
    const signature = signWebhookForTests({
      secret: options.secret ?? 'webhook-secret',
      method: 'POST',
      endpoint: path,
      date,
      payload: body,
    });
    return request(app)
      .post(path)
      .set('Content-Type', 'application/json')
      .set('BI-Signature-Date', date)
      .set('BI-Signature', signature)
      .send(body);
  }

  it('déclenche une synchronisation pour un webhook signé, ignore un rejeu', async () => {
    const user = await registerUser(app);
    await connectBank(user);
    mockSyncCalls();
    await signed({ id_webhook_data: 501, user: { id: 42 }, connection: { id: 7, id_user: 42 } }).expect(200);
    await waitForSyncs();
    expect(nock.pendingMocks()).toEqual([]);

    // Rejeu : aucun appel Powens attendu (nock refuserait toute requête non simulée).
    await signed({ id_webhook_data: 501, user: { id: 42 } }).expect(200);
    await waitForSyncs();
    expect(await WebhookEventModel.countDocuments({ idWebhookData: 501 })).toBe(1);
  });

  it('rejette une signature invalide, absente ou trop ancienne', async () => {
    await signed({ id_webhook_data: 1 }, { secret: 'mauvais-secret' }).expect(401);
    await request(app).post(path).set('Content-Type', 'application/json').send('{}').expect(401);
    await signed({ id_webhook_data: 2 }, { date: new Date(Date.now() - 3600_000).toISOString() }).expect(401);
  });

  it('CONNECTION_DELETED : la connexion passe à « déconnectée »', async () => {
    const user = await registerUser(app);
    await connectBank(user);
    const body = JSON.stringify({ id_webhook_data: 900, connection: { id: 7, id_user: 42 } });
    const date = new Date().toISOString();
    const endpoint = '/api/webhooks/powens/CONNECTION_DELETED';
    await request(app)
      .post(endpoint)
      .set('Content-Type', 'application/json')
      .set('BI-Signature-Date', date)
      .set(
        'BI-Signature',
        signWebhookForTests({ secret: 'webhook-secret', method: 'POST', endpoint, date, payload: body }),
      )
      .send(body)
      .expect(200);
    const link = await BankLinkModel.findOne({ userId: user.userId }).lean();
    expect(link?.status).toBe('disconnected');
  });
});

describe('rétention des données', () => {
  it('purge les opérations et paiements plus anciens que la durée configurée (5 ans)', async () => {
    const user = await registerUser(app);
    await connectBank(user);
    await TransactionModel.updateOne({ userId: user.userId }, { $set: { date: '2015-01-05' } });
    const result = await purgeExpiredData();
    expect(result.transactions).toBe(1);
    expect(await TransactionModel.countDocuments({ userId: user.userId })).toBe(spotifyDates.length - 1);
  });
});
