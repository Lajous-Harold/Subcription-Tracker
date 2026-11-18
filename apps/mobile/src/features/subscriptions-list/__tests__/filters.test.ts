import { describe, expect, it } from '@jest/globals';
import type { Subscription } from '@subtracker/contracts';
import { filterSubscriptions, providerHint, summarizeCancellation } from '../filters';

const UPDATED_AT = '2026-11-01T00:00:00.000Z';

function subscription(overrides: Partial<Subscription>): Subscription {
  return {
    id: 'sub-1',
    origin: 'manual',
    label: 'Netflix',
    provider: null,
    customProviderName: null,
    amount: { value: { cents: 1349, currency: 'EUR' }, origin: 'declared', updatedAt: UPDATED_AT },
    cadence: 'monthly',
    billingDay: null,
    nextDueDate: null,
    status: 'active',
    cancellation: null,
    notes: null,
    lastPaymentDate: null,
    paymentMissing: false,
    bankLinked: false,
    createdAt: UPDATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

describe('filterSubscriptions', () => {
  const tracked = subscription({ id: 'a', label: 'Électricité', status: 'cancellation_pending' });
  const archived = subscription({ id: 'b', label: 'Salle de sport', status: 'archived' });
  const custom = subscription({ id: 'c', label: 'Musique', customProviderName: 'Deezer' });

  it('garde les abonnements du filtre de statut choisi', () => {
    expect(filterSubscriptions([tracked, archived, custom], 'tracked').map((sub) => sub.id)).toEqual(['a', 'c']);
    expect(filterSubscriptions([tracked, archived, custom], 'archived').map((sub) => sub.id)).toEqual(['b']);
  });

  it('cherche dans le libellé et le fournisseur, sans tenir compte des accents ni de la casse', () => {
    expect(filterSubscriptions([tracked, custom], 'tracked', 'electri').map((sub) => sub.id)).toEqual(['a']);
    expect(filterSubscriptions([tracked, custom], 'tracked', '  DEEZ ').map((sub) => sub.id)).toEqual(['c']);
  });
});

describe('providerHint', () => {
  it('ne répète pas un fournisseur identique au libellé', () => {
    expect(providerHint(subscription({ label: 'Deezer', customProviderName: 'deezer' }))).toBeNull();
    expect(providerHint(subscription({ label: 'Musique', customProviderName: 'Deezer' }))).toBe('Deezer');
  });
});

describe('summarizeCancellation', () => {
  const cancellation = {
    method: null,
    startedAt: UPDATED_AT,
    requestedAt: null,
    effectiveDate: '2026-12-05',
    reference: null,
    notes: null,
  };

  it('signale une démarche en cours à suivre, avec sa date d’effet', () => {
    const summary = summarizeCancellation(subscription({ cancellation: { ...cancellation, status: 'requested' } }));
    expect(summary?.needsFollowUp).toBe(true);
    expect(summary?.text).toMatch(/^Demande envoyée · effective le 5 déc/);
  });

  it('ne signale ni une résiliation confirmée ni une démarche abandonnée', () => {
    expect(summarizeCancellation(subscription({ cancellation: { ...cancellation, status: 'confirmed' } }))).toEqual(
      expect.objectContaining({ needsFollowUp: false }),
    );
    expect(summarizeCancellation(subscription({ cancellation: { ...cancellation, status: 'abandoned' } }))).toBeNull();
  });
});
