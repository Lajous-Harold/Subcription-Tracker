import { describe, expect, it } from '@jest/globals';
import { loadConfig } from '../src/core/config';
import { TEST_ENV } from './setup';

const RENDER_URL = 'https://subtracker.onrender.com';

function envWithoutPublicUrl(overrides: Record<string, string> = {}) {
  const { PUBLIC_API_URL: _ignored, ...rest } = TEST_ENV;
  return { ...rest, ...overrides } as NodeJS.ProcessEnv;
}

describe('configuration : URL publique de l’API', () => {
  it('reprend RENDER_EXTERNAL_URL quand PUBLIC_API_URL est absent', () => {
    const config = loadConfig(envWithoutPublicUrl({ RENDER_EXTERNAL_URL: RENDER_URL }));
    expect(config.PUBLIC_API_URL).toBe('https://subtracker.onrender.com');
  });

  it('un PUBLIC_API_URL explicite a la priorité sur RENDER_EXTERNAL_URL', () => {
    const config = loadConfig(
      envWithoutPublicUrl({ PUBLIC_API_URL: 'https://api.example.com', RENDER_EXTERNAL_URL: RENDER_URL }),
    );
    expect(config.PUBLIC_API_URL).toBe('https://api.example.com');
  });

  it('sans aucune des deux, vaut http://localhost:4000', () => {
    const config = loadConfig(envWithoutPublicUrl());
    expect(config.PUBLIC_API_URL).toBe('http://localhost:4000');
  });
});

describe('configuration : URL de retour Powens web', () => {
  const WEB_DIST_DIR = '/app/apps/mobile/dist';

  it('pointe vers l’URL Render quand l’API sert l’app web sur Render', () => {
    const config = loadConfig(envWithoutPublicUrl({ WEB_DIST_DIR, RENDER_EXTERNAL_URL: RENDER_URL }));
    expect(config.POWENS_REDIRECT_URI_WEB).toBe('https://subtracker.onrender.com/powens/callback');
  });

  it('pointe vers http://localhost:4000 quand l’API sert l’app web sans URL publique', () => {
    const config = loadConfig(envWithoutPublicUrl({ WEB_DIST_DIR }));
    expect(config.POWENS_REDIRECT_URI_WEB).toBe('http://localhost:4000/powens/callback');
  });

  it('n’ajoute pas de double slash quand PUBLIC_API_URL se termine par un slash', () => {
    const config = loadConfig(envWithoutPublicUrl({ WEB_DIST_DIR, PUBLIC_API_URL: 'https://api.example.com/' }));
    expect(config.POWENS_REDIRECT_URI_WEB).toBe('https://api.example.com/powens/callback');
  });

  it('une valeur explicite a la priorité même quand l’API sert l’app web', () => {
    const config = loadConfig(
      envWithoutPublicUrl({
        WEB_DIST_DIR,
        RENDER_EXTERNAL_URL: RENDER_URL,
        POWENS_REDIRECT_URI_WEB: 'https://app.example.com/retour-banque',
      }),
    );
    expect(config.POWENS_REDIRECT_URI_WEB).toBe('https://app.example.com/retour-banque');
  });

  it('sans export web servi par l’API, vaut http://localhost:8081/powens/callback', () => {
    const config = loadConfig(envWithoutPublicUrl({ RENDER_EXTERNAL_URL: RENDER_URL }));
    expect(config.POWENS_REDIRECT_URI_WEB).toBe('http://localhost:8081/powens/callback');
  });
});

describe('configuration : ENABLE_DEMO_DATA', () => {
  it('est actif par défaut en développement', () => {
    const config = loadConfig(envWithoutPublicUrl({ APP_ENV: 'development' }));
    expect(config).toMatchObject({ ENABLE_DEMO_DATA: true });
  });

  it('est inactif par défaut en production', () => {
    const config = loadConfig(envWithoutPublicUrl({ APP_ENV: 'production' }));
    expect(config).toMatchObject({ ENABLE_DEMO_DATA: false });
  });

  it('peut être activé en production', () => {
    const config = loadConfig(envWithoutPublicUrl({ APP_ENV: 'production', ENABLE_DEMO_DATA: 'true' }));
    expect(config).toMatchObject({ ENABLE_DEMO_DATA: true });
  });
});
