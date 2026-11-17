import type { BankLinkStatus } from '@subtracker/contracts';
import type { PowensConnection } from '../powens/client';

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

/** Powens annonce que de nouveaux états peuvent apparaître : tout état inconnu tombe sur `error`. */
export function mapConnectionState(state: string | null | undefined): BankLinkStatus {
  if (state === null || state === undefined || state === '') return 'connected';
  if (ACTION_REQUIRED.has(state)) return 'action_required';
  if (TEMPORARY.has(state)) return 'temporary_error';
  if (state === 'notSupported') return 'not_supported';
  return 'error';
}

/** Une connexion sans `last_update` ni `state` n'a jamais été synchronisée : elle reste `pending`. */
export function linkFieldsFromConnection(
  connection: PowensConnection,
  previousConnectorName: string | null | undefined,
) {
  const status: BankLinkStatus =
    connection.last_update || connection.state ? mapConnectionState(connection.state) : 'pending';
  return {
    connectorName: connection.connector?.name ?? previousConnectorName ?? null,
    status,
    powensState: connection.state ?? null,
    powensMessage: connection.error_message ?? null,
    consentExpiresAt: connection.expire ? new Date(connection.expire) : null,
  };
}

const CONSENT_WARNING_DAYS = 14;

export function isConsentExpiringSoon(expiresAt: Date | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() - now.getTime() < CONSENT_WARNING_DAYS * 86_400_000;
}
