import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { AuthResponse } from '@subtracker/contracts';
import { onSessionChange, refreshSession } from '../http';

// Le scénario visé est celui du navigateur : plusieurs onglets partagent le cookie httpOnly du refresh token.
jest.mock('react-native', () => {
  const reactNative = jest.requireActual<typeof import('react-native')>('react-native');
  Object.defineProperty(reactNative.Platform, 'OS', { value: 'web' });
  return reactNative;
});

const originalFetch = globalThis.fetch;

const renewedSession: AuthResponse = {
  user: { id: '0123456789abcdef01234567', email: 'alice@example.com', createdAt: '2026-01-01T00:00:00.000Z' },
  accessToken: 'jeton-acces-renouvele',
  accessTokenExpiresAt: '2026-11-18T10:15:00.000Z',
  refreshTokenExpiresAt: '2026-12-18T10:00:00.000Z',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const supersededResponse = () =>
  jsonResponse(401, { error: { code: 'REFRESH_SUPERSEDED', message: 'Session renouvelée par un autre onglet' } });

const revokedResponse = () => jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'Session révoquée' } });

let refreshAttempts = 0;

function serveRefreshResponses(...responses: (() => Response)[]) {
  refreshAttempts = 0;
  globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
    if (!String(input).endsWith('/auth/refresh'))
      return Promise.reject(new Error(`Appel inattendu : ${String(input)}`));
    const next = responses[refreshAttempts];
    refreshAttempts += 1;
    return next ? Promise.resolve(next()) : Promise.reject(new Error('Rafraîchissement de trop'));
  }) as typeof fetch;
}

describe('refreshSession sur le web : refresh token remplacé par un autre onglet', () => {
  const sessionChanges: (AuthResponse | null)[] = [];
  let stopListening: () => void = () => undefined;

  beforeEach(() => {
    sessionChanges.length = 0;
    stopListening = onSessionChange((response) => sessionChanges.push(response));
  });

  afterEach(() => {
    stopListening();
    globalThis.fetch = originalFetch;
  });

  it('réessaie une fois et reprend la session sans déconnecter l’utilisateur', async () => {
    serveRefreshResponses(supersededResponse, () => jsonResponse(200, renewedSession));

    const refreshed = await refreshSession();

    expect(refreshed?.accessToken).toBe('jeton-acces-renouvele');
    expect(sessionChanges).not.toContain(null);
  });

  it('déconnecte l’utilisateur si le second essai est aussi refusé', async () => {
    serveRefreshResponses(supersededResponse, supersededResponse);

    const refreshed = await refreshSession();

    expect(refreshAttempts).toBe(2);
    expect(refreshed).toBeNull();
    expect(sessionChanges).toEqual([null]);
  });

  it('déconnecte sans réessayer quand la session est révoquée', async () => {
    serveRefreshResponses(revokedResponse, () => jsonResponse(200, renewedSession));

    const refreshed = await refreshSession();

    expect(refreshAttempts).toBe(1);
    expect(refreshed).toBeNull();
    expect(sessionChanges).toEqual([null]);
  });
});
