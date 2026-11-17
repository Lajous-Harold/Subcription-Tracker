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
