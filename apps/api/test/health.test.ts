import request from 'supertest';
import { describe, expect, it } from '@jest/globals';
import { testApp } from './helpers';

/**
 * Une seule route de santé, publique et sous le préfixe de l'API : `GET /api/health`.
 * Elle ne divulgue rien d'autre que son statut.
 */
const app = testApp();

describe('santé de l’API', () => {
  it('GET /api/health répond 200 sans jeton, avec pour seul corps { status: "ok" }', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('l’ancienne route GET /health n’existe plus : 404 NOT_FOUND', async () => {
    const res = await request(app).get('/health').expect(404);
    expect(res.body.error?.code).toBe('NOT_FOUND');
  });
});
