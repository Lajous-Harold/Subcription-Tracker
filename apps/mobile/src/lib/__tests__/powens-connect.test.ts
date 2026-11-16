import { describe, expect, it, jest } from '@jest/globals';
import { completeConnectCallback } from '../powens-connect';
import { api } from '../api';

jest.mock('../api', () => ({
  api: { completeConnectSession: jest.fn(() => Promise.resolve({ id: 'link', status: 'pending' })) },
}));

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

  it('refuse un retour sans state', async () => {
    await expect(completeConnectCallback({ connection_id: '7' })).rejects.toThrow('state manquant');
  });
});
