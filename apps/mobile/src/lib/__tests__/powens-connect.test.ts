import { describe, expect, it, jest } from '@jest/globals';
import type { BankLink } from '@subtracker/contracts';
import { completeConnectCallback } from '../powens-connect';
import { api } from '../api';

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

  it('refuse un retour sans state', async () => {
    await expect(completeConnectCallback({ connection_id: '7' })).rejects.toThrow('state manquant');
  });
});
