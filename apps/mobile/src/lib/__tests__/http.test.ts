import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ApiError, apiRequest, applyAuthResponse } from '../http';

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Session valide en mémoire, sans refresh token : aucun renouvellement ni accès au trousseau pendant l'appel.
async function signIn() {
  await applyAuthResponse({
    user: { id: '0123456789abcdef01234567', email: 'alice@example.com', createdAt: '2026-01-01T00:00:00.000Z' },
    accessToken: 'jeton-acces',
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
  });
}

describe('apiRequest : enveloppe d’erreur de l’API', () => {
  beforeEach(signIn);

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('transforme une réponse 400 en ApiError portant le code, le message, l’explication et les erreurs par champ', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve(
        jsonResponse(400, {
          error: {
            code: 'INVALID_INPUT',
            message: 'Requête invalide',
            hint: 'Vérifiez les champs signalés.',
            fields: [
              { path: 'amountCents', message: 'Le montant doit être positif' },
              { path: 'label', message: 'Libellé requis' },
            ],
          },
        }),
      ),
    ) as typeof fetch;

    const error = await apiRequest('POST', '/subscriptions', { label: '', amountCents: -500 }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'INVALID_INPUT',
      message: 'Requête invalide',
      hint: 'Vérifiez les champs signalés.',
      fieldErrors: { amountCents: 'Le montant doit être positif', label: 'Libellé requis' },
    });
  });
});
