import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { testApp, type TestApp } from './helpers';

describe('documentation Swagger en production', () => {
  it('GET /api/docs/ sert l’interface Swagger en HTML', async () => {
    const prod = testApp({ APP_ENV: 'production' });
    const res = await request(prod).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/html/);
  });

  it('GET /api/openapi.json sert le document OpenAPI', async () => {
    const prod = testApp({ APP_ENV: 'production' });
    const res = await request(prod).get('/api/openapi.json');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.body.openapi).toEqual(expect.stringMatching(/^3\./));
  });
});

const WEB_MARKER = 'marqueur-export-web-subtracker';
const INDEX_HTML = `<!doctype html><html><head><title>SubTracker</title></head><body><div id="${WEB_MARKER}"></div></body></html>`;
const APP_JS = "console.log('bundle web de test');";

describe('app web servie par l’API (WEB_DIST_DIR)', () => {
  let webDistDir: string;
  let app: TestApp;

  beforeAll(async () => {
    webDistDir = await mkdtemp(join(tmpdir(), 'subtracker-web-'));
    await writeFile(join(webDistDir, 'index.html'), INDEX_HTML);
    await mkdir(join(webDistDir, 'assets'));
    await writeFile(join(webDistDir, 'assets', 'app.js'), APP_JS);
    app = testApp({ WEB_DIST_DIR: webDistDir });
  });

  afterAll(async () => {
    await rm(webDistDir, { recursive: true, force: true });
  });

  it('GET / sert index.html', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/html/);
    expect(res.text).toContain(WEB_MARKER);
  });

  it('GET /assets/app.js sert le fichier statique', async () => {
    const res = await request(app).get('/assets/app.js');
    expect(res.status).toBe(200);
    expect(res.text).toBe(APP_JS);
  });

  it('une route côté client (/subscriptions/123) retombe sur index.html', async () => {
    const res = await request(app).get('/subscriptions/123');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/html/);
    expect(res.text).toContain(WEB_MARKER);
  });

  it('une route /api inconnue reste une erreur JSON NOT_FOUND, sans index.html', async () => {
    const res = await request(app).get('/api/route-inexistante');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.text).not.toContain(WEB_MARKER);
  });

  it('GET /api/health reste une réponse JSON de l’API', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.text).not.toContain(WEB_MARKER);
  });
});

describe('sans WEB_DIST_DIR', () => {
  it('GET / renvoie une erreur JSON NOT_FOUND', async () => {
    const app = testApp();
    const res = await request(app).get('/');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
