import type { BankAccount, BankLink } from '@subtracker/contracts';
import {
  BANK_STATUS_HELP,
  BANK_STATUS_LABELS,
  formatDate,
  formatMaskedAccountNumber,
  formatOperationCount,
  formatTimeAgo,
  needsBankReconnection,
} from '@/lib/format';

const DAY_MS = 24 * 60 * 60_000;

export const isSyncing = (link: BankLink | null | undefined) =>
  Boolean(link && (link.status === 'pending' || link.syncInProgress));

/** Même formulation que l'accueil (« lue il y a 2 h »), pour une même information. */
export function formatSyncAge(lastSyncAt: string | null, now: number): string {
  return lastSyncAt ? formatTimeAgo(lastSyncAt, new Date(now)) : 'jamais';
}

export function formatConsentRemaining(consentExpiresAt: string | null, now: number): string {
  if (!consentExpiresAt) return 'non communiquée';
  const remaining = new Date(consentExpiresAt).getTime() - now;
  if (remaining <= 0) return 'expirée';
  return `encore ${Math.ceil(remaining / DAY_MS)} j`;
}

export type BankNotice = { tone: 'signal' | 'neutral'; message: string };

/** `connected` n'a rien à signaler : l'état se lit déjà sur la pastille. */
export function bankNotice(link: BankLink): BankNotice | null {
  if (link.consentExpiringSoon) {
    return {
      tone: 'signal',
      message: `Votre autorisation expire le ${formatDate(link.consentExpiresAt)}. Renouvelez-la pour continuer la détection.`,
    };
  }
  if (link.status === 'connected') return null;
  const needsAttention = needsBankReconnection(link) || link.status === 'temporary_error';
  return { tone: needsAttention ? 'signal' : 'neutral', message: BANK_STATUS_HELP[link.status] };
}

/** Types de compte renvoyés par Powens (`account.type`). */
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: 'compte courant',
  savings: 'épargne',
  deposit: 'dépôt',
  card: 'carte',
  joint: 'compte joint',
  loan: 'crédit',
  market: 'compte-titres',
  pea: 'PEA',
  lifeinsurance: 'assurance vie',
};

export function accountTypeLabel(type: string | null): string | null {
  if (!type || type === 'unknown') return null;
  return ACCOUNT_TYPE_LABELS[type] ?? type;
}

function accountReadState(account: Pick<BankAccount, 'sharedWithApp' | 'analyzed' | 'transactionCount'>): string {
  if (!account.sharedWithApp) return 'non partagé';
  if (!account.analyzed) return 'ignoré';
  return formatOperationCount(account.transactionCount);
}

const localeLowerCase = (text: string) => text.toLocaleLowerCase('fr-FR');

/**
 * Sous-titre d'une ligne de compte, sur le modèle « ••4821 · 412 opérations ».
 * Le type n'apparaît que s'il apprend quelque chose (« Livret A » → épargne, pas « Compte courant » → compte courant).
 * Un compte non partagé n'a aucune opération importée, et un compte décoché n'est pas lu :
 * on dit pourquoi plutôt que d'afficher un nombre d'opérations qui n'entre pas dans la détection.
 */
export function accountDescription(
  account: Pick<BankAccount, 'name' | 'type' | 'numberLast4' | 'sharedWithApp' | 'analyzed' | 'transactionCount'>,
): string {
  const typeLabel = accountTypeLabel(account.type);
  const typeIsInformative = typeLabel !== null && !localeLowerCase(account.name).includes(localeLowerCase(typeLabel));
  return [
    account.numberLast4 ? formatMaskedAccountNumber(account.numberLast4) : null,
    typeIsInformative ? typeLabel : null,
    accountReadState(account),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Compte créé par `POST /demo/data` : ses opérations viennent des données de démonstration, pas de Powens. */
export const isDemoAccount = (account: Pick<BankAccount, 'source'>) => account.source === 'fixture';

export interface BankLinkSummary {
  title: string;
  detail: string;
  needsAttention: boolean;
}

function bankLinkTitle(link: BankLink): string {
  if (link.consentExpiringSoon) return 'Autorisation à renouveler';
  if (link.status === 'connected' || link.status === 'pending') return 'Banque active';
  return BANK_STATUS_LABELS[link.status];
}

function syncFreshness(link: BankLink, now: number): string {
  if (isSyncing(link)) return 'Synchronisation en cours…';
  return link.lastSyncAt ? `Synchronisée ${formatSyncAge(link.lastSyncAt, now)}` : 'Jamais synchronisée';
}

/** Résumé de la banque liée pour la barre latérale : l'état en titre, la fraîcheur des données en détail. */
export function bankLinkSummary(link: BankLink, now: number): BankLinkSummary {
  return {
    title: bankLinkTitle(link),
    detail: syncFreshness(link, now),
    needsAttention: needsBankReconnection(link) || link.status === 'temporary_error',
  };
}
