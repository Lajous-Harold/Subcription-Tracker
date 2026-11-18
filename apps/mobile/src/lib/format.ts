import type {
  BankAccount,
  BankLink,
  BankLinkStatus,
  CancellationMethod,
  CancellationStatus,
  Origin,
} from '@subtracker/contracts';

const CIVIL_DATE_LENGTH = 'YYYY-MM-DD'.length;

function toUtcDate(value: string): Date {
  return new Date(value.length === CIVIL_DATE_LENGTH ? `${value}T00:00:00Z` : value);
}

export function formatMoney(cents: number, currency = 'EUR'): string {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2).replace('.', ',')} ${currency}`;
  }
}

/** Le signe moins typographique (U+2212) s'aligne sur la largeur des chiffres, pas le trait d'union. */
export function formatSignedMoney(cents: number, currency = 'EUR'): string {
  return cents < 0 ? `\u2212${formatMoney(-cents, currency)}` : formatMoney(cents, currency);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    toUtcDate(value),
  );
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(toUtcDate(value));
}

export function formatMediumDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    toUtcDate(value),
  );
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/** En français, zéro s'accorde au singulier : « 0 opération ». */
export function formatOperationCount(count: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(count)} ${Math.abs(count) < 2 ? 'opération' : 'opérations'}`;
}

export function formatMaskedAccountNumber(numberLast4: string): string {
  return `••${numberLast4}`;
}

/** Espace insécable : le numéro masqué ne passe jamais seul à la ligne. */
export function formatAccountLabel(account: Pick<BankAccount, 'name' | 'numberLast4'>): string {
  return account.numberLast4 ? `${account.name}\u00a0${formatMaskedAccountNumber(account.numberLast4)}` : account.name;
}

/** Première lettre ou chiffre, pour les monogrammes et l'avatar du compte. */
export function initialOf(text: string | null | undefined): string {
  return text?.match(/[\p{L}\p{N}]/u)?.[0]?.toLocaleUpperCase('fr-FR') ?? '?';
}

export const ORIGIN_LABELS: Record<Origin, string> = {
  observed: 'Observé',
  declared: 'Déclaré',
  estimated: 'Estimé',
};

export const ORIGIN_HELP: Record<Origin, string> = {
  observed: 'Tiré de vos paiements bancaires',
  declared: 'Saisi ou corrigé par vous : jamais modifié automatiquement',
  estimated: 'Calculé par l’application',
};

export const CANCELLATION_STATUS_LABELS: Record<CancellationStatus, string> = {
  started: 'Démarche commencée',
  requested: 'Demande envoyée',
  confirmed: 'Résiliation confirmée',
  abandoned: 'Abandonnée',
};

export const CANCELLATION_METHOD_LABELS: Record<CancellationMethod, string> = {
  online: 'En ligne',
  in_app: 'Dans l’application',
  email: 'Par email',
  letter: 'Par courrier',
  phone: 'Par téléphone',
  in_person: 'En agence / sur place',
};

export const BANK_STATUS_LABELS: Record<BankLinkStatus, string> = {
  pending: 'Synchronisation en cours',
  connected: 'Connectée',
  action_required: 'Action requise',
  temporary_error: 'Temporairement indisponible',
  not_supported: 'Non supportée',
  error: 'Erreur',
  disconnected: 'Déconnectée',
};

export const BANK_STATUS_HELP: Record<BankLinkStatus, string> = {
  pending: 'La banque transmet vos opérations. Cela peut prendre quelques minutes.',
  connected: 'Les nouvelles opérations sont importées automatiquement.',
  action_required:
    'Votre banque demande une nouvelle authentification. Reconnectez-vous pour reprendre la synchronisation.',
  temporary_error: 'La banque ou le service d’agrégation est indisponible. Un nouvel essai aura lieu automatiquement.',
  not_supported: 'Cette source n’est pas prise en charge. Vous pouvez suivre vos abonnements manuellement.',
  error: 'Un problème inattendu est survenu. Essayez de vous reconnecter, ou suivez vos abonnements manuellement.',
  disconnected: 'La connexion a été supprimée. Connectez à nouveau votre banque pour reprendre la détection.',
};

export function needsBankReconnection(bank: Pick<BankLink, 'status' | 'consentExpiringSoon'>): boolean {
  return bank.status === 'action_required' || bank.status === 'error' || bank.consentExpiringSoon;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const DAYS_SHOWN_AS_ELAPSED = 7;

export function formatTimeAgo(timestamp: string, now: Date = new Date()): string {
  const elapsedMs = Math.max(0, now.getTime() - new Date(timestamp).getTime());
  if (elapsedMs < MINUTE_MS) return 'à l’instant';
  if (elapsedMs < HOUR_MS) return `il y a ${Math.floor(elapsedMs / MINUTE_MS)} min`;
  if (elapsedMs < DAY_MS) return `il y a ${Math.floor(elapsedMs / HOUR_MS)} h`;
  const elapsedDays = Math.floor(elapsedMs / DAY_MS);
  if (elapsedDays < DAYS_SHOWN_AS_ELAPSED) return `il y a ${elapsedDays} j`;
  return `le ${formatShortDate(timestamp)}`;
}

export function formatCalendarDay(value: string): { day: string; month: string } {
  const date = toUtcDate(value);
  return {
    day: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone: 'UTC' }).format(date),
    month: new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' }).format(date),
  };
}
