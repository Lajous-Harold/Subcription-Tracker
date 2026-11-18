import type { Subscription, SubscriptionStatus } from '@subtracker/contracts';
import { CANCELLATION_STATUS_LABELS, formatMediumDate, formatShortDate } from '@/lib/format';

export type StatusFilter = 'tracked' | 'cancelled' | 'archived';

const STATUSES_BY_FILTER: Record<StatusFilter, SubscriptionStatus[]> = {
  tracked: ['active', 'cancellation_pending'],
  cancelled: ['cancelled'],
  archived: ['archived'],
};

function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr-FR');
}

export function filterSubscriptions(
  subscriptions: Subscription[],
  statusFilter: StatusFilter,
  searchQuery = '',
): Subscription[] {
  const needle = normalizeForSearch(searchQuery.trim());
  return subscriptions.filter(
    (sub) =>
      STATUSES_BY_FILTER[statusFilter].includes(sub.status) &&
      [sub.label, sub.provider?.name, sub.customProviderName].some(
        (text) => text != null && normalizeForSearch(text).includes(needle),
      ),
  );
}

/** Le nom du fournisseur n'apporte quelque chose que s'il diffère du libellé choisi. */
export function providerHint(sub: Subscription): string | null {
  const providerName = sub.provider?.name ?? sub.customProviderName;
  if (!providerName || normalizeForSearch(providerName) === normalizeForSearch(sub.label)) return null;
  return providerName;
}

export interface CancellationSummary {
  text: string;
  needsFollowUp: boolean;
}

/** Une démarche abandonnée rend l'abonnement actif : elle n'a plus rien à signaler dans la liste. */
export function summarizeCancellation(sub: Subscription): CancellationSummary | null {
  const { cancellation } = sub;
  if (!cancellation || cancellation.status === 'abandoned') return null;
  const effective = cancellation.effectiveDate ? ` · effective le ${formatMediumDate(cancellation.effectiveDate)}` : '';
  return {
    text: `${CANCELLATION_STATUS_LABELS[cancellation.status]}${effective}`,
    needsFollowUp: cancellation.status !== 'confirmed',
  };
}

/** Une échéance est proche : le jour et le mois suffisent, liés pour ne jamais se séparer en fin de ligne. */
export function formatDueDay(value: string): string {
  return formatShortDate(value).replace(/\s/g, ' ');
}

export function isNextDueDateEstimated(sub: Subscription): boolean {
  return sub.nextDueDate?.origin === 'estimated';
}

export function formatNextDueDate(sub: Subscription): string {
  if (!sub.nextDueDate) return '—';
  return `${formatDueDay(sub.nextDueDate.value)}${isNextDueDateEstimated(sub) ? ' (estimée)' : ''}`;
}
