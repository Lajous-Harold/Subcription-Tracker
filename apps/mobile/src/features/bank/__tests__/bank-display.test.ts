import { describe, expect, it } from '@jest/globals';
import type { BankAccount, BankLink } from '@subtracker/contracts';
import {
  accountDescription,
  accountTypeLabel,
  bankLinkSummary,
  bankNotice,
  formatConsentRemaining,
  formatSyncAge,
} from '../bank-display';

const NOW = Date.parse('2026-11-18T12:00:00Z');

const link = (overrides: Partial<BankLink>): BankLink => ({
  id: 'link-1',
  status: 'connected',
  connectorName: 'Banque test',
  providerState: null,
  providerMessage: null,
  consentExpiresAt: null,
  consentExpiringSoon: false,
  lastSyncAt: null,
  syncInProgress: false,
  createdAt: '2026-11-01T00:00:00Z',
  ...overrides,
});

const account = (overrides: Partial<BankAccount>): BankAccount => ({
  id: 'account-1',
  name: 'Compte courant',
  type: 'checking',
  numberLast4: '4821',
  currency: 'EUR',
  balanceCents: 120_000,
  sharedWithApp: true,
  analyzed: true,
  lastUpdate: null,
  transactionCount: 412,
  ...overrides,
});

describe('bank-display', () => {
  it('donne l’âge de la dernière synchronisation en unité lisible', () => {
    expect(formatSyncAge(null, NOW)).toBe('jamais');
    expect(formatSyncAge('2026-11-18T11:59:30Z', NOW)).toBe('à l’instant');
    expect(formatSyncAge('2026-11-18T11:35:00Z', NOW)).toBe('il y a 25 min');
    expect(formatSyncAge('2026-11-18T10:00:00Z', NOW)).toBe('il y a 2 h');
    expect(formatSyncAge('2026-11-15T12:00:00Z', NOW)).toBe('il y a 3 j');
  });

  it('compte les jours restants de l’autorisation, arrondis au jour entamé', () => {
    expect(formatConsentRemaining(null, NOW)).toBe('non communiquée');
    expect(formatConsentRemaining('2026-11-18T11:00:00Z', NOW)).toBe('expirée');
    expect(formatConsentRemaining('2026-11-19T00:00:00Z', NOW)).toBe('encore 1 j');
    expect(formatConsentRemaining('2027-05-09T12:00:00Z', NOW)).toBe('encore 172 j');
  });

  it('ne signale rien pour une banque connectée, et met en avant ce qui demande une action', () => {
    expect(bankNotice(link({}))).toBeNull();
    expect(bankNotice(link({ status: 'pending' }))?.tone).toBe('neutral');
    expect(bankNotice(link({ status: 'action_required' }))?.tone).toBe('signal');
    expect(bankNotice(link({ consentExpiringSoon: true, consentExpiresAt: '2026-11-25T00:00:00Z' }))).toEqual({
      tone: 'signal',
      message: 'Votre autorisation expire le 25 novembre 2026. Renouvelez-la pour continuer la détection.',
    });
  });

  it('traduit les types de compte Powens connus et garde les autres tels quels', () => {
    expect(accountTypeLabel('checking')).toBe('compte courant');
    expect(accountTypeLabel('perco')).toBe('perco');
    expect(accountTypeLabel('unknown')).toBeNull();
    expect(accountTypeLabel(null)).toBeNull();
  });

  it('décrit un compte par son numéro masqué et son nombre d’opérations', () => {
    expect(accountDescription(account({}))).toBe('••4821 · 412 opérations');
    expect(accountDescription(account({ transactionCount: 1 }))).toBe('••4821 · 1 opération');
    expect(accountDescription(account({ numberLast4: null, transactionCount: 0 }))).toBe('0 opération');
  });

  it('ne répète pas le type de compte déjà lisible dans son nom', () => {
    expect(accountDescription(account({ name: 'Livret A', type: 'savings', numberLast4: '0937' }))).toBe(
      '••0937 · épargne · 412 opérations',
    );
    expect(accountDescription(account({ name: 'Carte à débit différé', type: 'card' }))).toBe(
      '••4821 · 412 opérations',
    );
  });

  it('dit qu’un compte non partagé n’a pas d’opérations importées', () => {
    expect(accountDescription(account({ sharedWithApp: false, transactionCount: 0 }))).toBe('••4821 · non partagé');
  });

  it('résume la banque liée par son état et l’âge de la dernière synchronisation', () => {
    expect(bankLinkSummary(link({ lastSyncAt: '2026-11-18T10:00:00Z' }), NOW)).toEqual({
      title: 'Banque active',
      detail: 'Synchronisée il y a 2 h',
      needsAttention: false,
    });
    expect(bankLinkSummary(link({ status: 'pending' }), NOW)).toEqual({
      title: 'Banque active',
      detail: 'Synchronisation en cours…',
      needsAttention: false,
    });
    expect(bankLinkSummary(link({ lastSyncAt: null }), NOW).detail).toBe('Jamais synchronisée');
  });

  it('met en avant une banque qui demande une action', () => {
    expect(bankLinkSummary(link({ status: 'action_required' }), NOW)).toMatchObject({
      title: 'Action requise',
      needsAttention: true,
    });
    expect(
      bankLinkSummary(link({ consentExpiringSoon: true, consentExpiresAt: '2026-11-25T00:00:00Z' }), NOW),
    ).toMatchObject({ title: 'Autorisation à renouveler', needsAttention: true });
  });
});
