import { describe, expect, it, jest } from '@jest/globals';
import type { BankLink } from '@subtracker/contracts';
import { completeConnectCallback, PowensConnectError } from '../powens-connect';
import { api } from '../api';
import { ApiError } from '../http';

jest.mock('../api', () => ({
  api: { completeConnectSession: jest.fn(() => Promise.resolve({ id: 'link', status: 'pending' })) },
}));

const connectedLink: BankLink = {
  id: 'link-apres-nouvel-essai',
  status: 'connected',
  connectorName: 'Banque Démo',
  providerState: null,
  providerMessage: null,
  consentExpiresAt: null,
  consentExpiringSoon: false,
  lastSyncAt: null,
  syncInProgress: false,
  createdAt: '2026-11-17T10:00:00.000Z',
};

describe('completeConnectCallback', () => {
  it('ne finalise qu’une fois un même state (retour d’onglet + lien profond)', async () => {
    const params = { state: 'state-unique-1234567890', connection_id: '7' };
    const [first, second] = await Promise.all([completeConnectCallback(params), completeConnectCallback(params)]);
    expect(first).toBe(second);
    expect(api.completeConnectSession).toHaveBeenCalledTimes(1);
    expect(api.completeConnectSession).toHaveBeenCalledWith({
      state: 'state-unique-1234567890',
      connectionId: '7',
      error: undefined,
      errorDescription: undefined,
    });
  });

  it('refait la finalisation d’un state dont le premier essai a échoué', async () => {
    jest
      .mocked(api.completeConnectSession)
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce(connectedLink);
    const params = { state: 'state-echec-passager-0987654321', connection_id: '8' };

    await expect(completeConnectCallback(params)).rejects.toThrow('Network request failed');

    await expect(completeConnectCallback(params)).resolves.toEqual(connectedLink);
  });

  it('refuse un retour sans state avec un message pour l’utilisateur, la cause restant technique', async () => {
    const rejection = completeConnectCallback({ connection_id: '7' });

    await expect(rejection).rejects.toThrow('La connexion à votre banque n’a pas abouti');
    await expect(rejection).rejects.toMatchObject({ reason: 'MISSING_STATE' });
  });

  it('reformule un refus de l’API sans afficher l’explication technique de Powens', async () => {
    const refusal = new ApiError(400, 'WEBVIEW_TOS_DECLINED', 'Conditions d’utilisation refusées', 'tos not accepted');
    jest.mocked(api.completeConnectSession).mockRejectedValueOnce(refusal);

    const rejection = completeConnectCallback({ state: 'state-cgu-refusees-1122334455', error: 'tos_declined' });

    await expect(rejection).rejects.toBeInstanceOf(PowensConnectError);
    await expect(rejection).rejects.toMatchObject({
      message: expect.stringContaining('conditions de Powens'),
      reason: 'WEBVIEW_TOS_DECLINED',
      cause: refusal,
    });
  });

  it('garde un message générique pour un code de refus inconnu', async () => {
    jest
      .mocked(api.completeConnectSession)
      .mockRejectedValueOnce(new ApiError(400, 'MISSING_CONNECTION', 'Identifiant de connexion manquant'));

    await expect(completeConnectCallback({ state: 'state-sans-connexion-5566778899' })).rejects.toMatchObject({
      message: 'La connexion à votre banque n’a pas abouti. Relancez-la depuis l’écran Banque.',
      reason: 'MISSING_CONNECTION',
    });
  });
});
