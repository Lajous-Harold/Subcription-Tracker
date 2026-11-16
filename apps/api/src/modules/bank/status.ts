import type { BankLinkStatus } from '@subtracker/contracts';

const ACTION_REQUIRED = new Set([
  'SCARequired',
  'webauthRequired',
  'decoupled',
  'additionalInformationNeeded',
  'actionNeeded',
  'passwordExpired',
  'wrongpass',
  'wrongPass',
]);
const TEMPORARY = new Set(['validating', 'rateLimiting', 'websiteUnavailable', 'bug']);

/**
 * Traduit l'état Powens d'une connexion en statut affiché.
 * Powens annonce que de nouveaux états peuvent apparaître : tout état inconnu tombe sur `error`.
 */
export function mapConnectionState(state: string | null | undefined): BankLinkStatus {
  if (state === null || state === undefined || state === '') return 'connected';
  if (ACTION_REQUIRED.has(state)) return 'action_required';
  if (TEMPORARY.has(state)) return 'temporary_error';
  if (state === 'notSupported') return 'not_supported';
  return 'error';
}

export const CONSENT_WARNING_DAYS = 14;

export function isConsentExpiringSoon(expiresAt: Date | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() - now.getTime() < CONSENT_WARNING_DAYS * 86_400_000;
}
