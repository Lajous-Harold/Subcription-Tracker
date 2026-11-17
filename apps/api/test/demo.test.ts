import request from 'supertest';
import { describe, expect, it } from '@jest/globals';
import { registerUser, testApp } from './helpers';

/**
 * Données de démonstration : `POST` / `DELETE /api/demo/data`, pilotées par `ENABLE_DEMO_DATA`
 * (actif par défaut hors production, inactif par défaut en production, activable en production).
 * Chaque test construit son app : `createApp` fixe la config globale lue par les limiteurs de débit.
 */
describe('données de démonstration : /api/demo/data', () => {
  it('l’ancienne URL /api/dev/fixtures n’existe plus', async () => {
    const app = testApp();
    const user = await registerUser(app);
    const loaded = await request(app).post('/api/dev/fixtures').set(user.auth);
    expect(loaded.status).toBe(404);
    expect(loaded.body.error.code).toBe('NOT_FOUND');
    const removed = await request(app).delete('/api/dev/fixtures').set(user.auth);
    expect(removed.status).toBe(404);
    expect(removed.body.error.code).toBe('NOT_FOUND');
  });

  it('en production, la route est absente par défaut', async () => {
    const prod = testApp({ APP_ENV: 'production' });
    const user = await registerUser(prod);
    const res = await request(prod).post('/api/demo/data').set(user.auth);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('en production avec ENABLE_DEMO_DATA=true, les données de démo se chargent puis se retirent', async () => {
    const prod = testApp({ APP_ENV: 'production', ENABLE_DEMO_DATA: 'true' });
    const user = await registerUser(prod);

    const loaded = await request(prod).post('/api/demo/data').set(user.auth);
    expect(loaded.status).toBe(200);
    expect(loaded.body.imported).toBeGreaterThan(0);
    expect(loaded.body.detection.created).toBeGreaterThanOrEqual(6);

    await request(prod).delete('/api/demo/data').set(user.auth).expect(204);
    const transactions = await request(prod).get('/api/transactions').set(user.auth).expect(200);
    expect(transactions.body.items).toHaveLength(0);
  });
});
