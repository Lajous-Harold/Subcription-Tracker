import type {
  BankLinkStatus,
  CancellationMethod,
  CancellationStatus,
  ConfidenceLevel,
  Origin,
  SubscriptionStatus,
} from '@subtracker/contracts';

export function formatMoney(cents: number, currency = 'EUR'): string {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2).replace('.', ',')} ${currency}`;
  }
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const iso = value.length === 10 ? `${value}T00:00:00Z` : value;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(iso),
  );
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return '—';
  const iso = value.length === 10 ? `${value}T00:00:00Z` : value;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(iso));
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
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

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'Actif',
  cancellation_pending: 'Résiliation en cours',
  cancelled: 'Résilié',
  archived: 'Archivé',
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

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: 'Confiance élevée',
  medium: 'Confiance moyenne',
  low: 'À vérifier',
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
