import {
  addMonthsClamped,
  todayIso,
  type CancellationMethod,
  type Origin,
  type Payment,
  type ProviderSummary,
  type Subscription,
  type SubscriptionDetail,
} from '@subtracker/contracts';
import type { PaymentDoc, SubscriptionDoc } from './models';

export interface PaymentStats {
  lastPaymentDate: string | null;
}

/** Échéance : déclarée si fixée et à venir, sinon estimée (jour de prélèvement ou dernier paiement). */
export function computeNextDueDate(
  doc: Pick<SubscriptionDoc, 'status' | 'billingDay' | 'nextDueDateDeclared' | 'updatedAt'>,
  stats: PaymentStats,
  today = todayIso(),
): { value: string; origin: Origin; updatedAt: string } | null {
  if (doc.status === 'cancelled' || doc.status === 'archived') return null;
  const updatedAt = doc.updatedAt.toISOString();
  const rollForward = (start: string, day: number) => {
    let value = start;
    for (let guard = 0; value < today && guard < 600; guard += 1) value = addMonthsClamped(value, 1, day);
    return value;
  };

  const declared = doc.nextDueDateDeclared;
  if (declared) {
    if (declared.value >= today) {
      return { value: declared.value, origin: 'declared', updatedAt: declared.updatedAt.toISOString() };
    }
    return { value: rollForward(declared.value, Number(declared.value.slice(8, 10))), origin: 'estimated', updatedAt };
  }
  if (doc.billingDay) {
    const day = doc.billingDay.value;
    const start = stats.lastPaymentDate
      ? addMonthsClamped(stats.lastPaymentDate, 1, day)
      : addMonthsClamped(`${today.slice(0, 8)}01`, 0, day);
    return { value: rollForward(start, day), origin: 'estimated', updatedAt };
  }
  if (stats.lastPaymentDate) {
    const day = Number(stats.lastPaymentDate.slice(8, 10));
    return { value: rollForward(addMonthsClamped(stats.lastPaymentDate, 1, day), day), origin: 'estimated', updatedAt };
  }
  return null;
}

/** Signal sans effet sur le statut : aucun paiement bancaire observé 7 jours après l'échéance attendue. */
export function computePaymentMissing(
  doc: Pick<SubscriptionDoc, 'status' | 'billingDay' | 'detection'>,
  stats: PaymentStats,
  today = todayIso(),
): boolean {
  if (doc.status !== 'active' || !doc.detection || !stats.lastPaymentDate) return false;
  const day = doc.billingDay?.value ?? Number(stats.lastPaymentDate.slice(8, 10));
  const expected = addMonthsClamped(stats.lastPaymentDate, 1, day);
  const graceEnd = new Date(`${expected}T00:00:00Z`).getTime() + 7 * 86_400_000;
  return new Date(`${today}T00:00:00Z`).getTime() > graceEnd;
}

export function toSubscriptionDto(
  doc: SubscriptionDoc,
  provider: ProviderSummary | null,
  stats: PaymentStats,
  today = todayIso(),
): Subscription {
  return {
    id: doc._id.toString(),
    origin: doc.origin,
    label: doc.label,
    provider,
    customProviderName: doc.customProviderName ?? null,
    amount: {
      value: { cents: doc.amount.cents, currency: doc.amount.currency },
      origin: doc.amount.origin,
      updatedAt: doc.amount.updatedAt.toISOString(),
    },
    cadence: 'monthly',
    billingDay: doc.billingDay
      ? {
          value: doc.billingDay.value,
          origin: doc.billingDay.origin,
          updatedAt: doc.billingDay.updatedAt.toISOString(),
        }
      : null,
    nextDueDate: computeNextDueDate(doc, stats, today),
    status: doc.status,
    cancellation: doc.cancellation
      ? {
          status: doc.cancellation.status,
          method: (doc.cancellation.method ?? null) as CancellationMethod | null,
          startedAt: doc.cancellation.startedAt.toISOString(),
          requestedAt: doc.cancellation.requestedAt ?? null,
          effectiveDate: doc.cancellation.effectiveDate ?? null,
          reference: doc.cancellation.reference ?? null,
          notes: doc.cancellation.notes ?? null,
        }
      : null,
    notes: doc.notes ?? null,
    lastPaymentDate: stats.lastPaymentDate,
    paymentMissing: computePaymentMissing(doc, stats, today),
    bankLinked: Boolean(doc.detection),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toSubscriptionDetailDto(
  doc: SubscriptionDoc,
  provider: ProviderSummary | null,
  stats: PaymentStats,
): SubscriptionDetail {
  return {
    ...toSubscriptionDto(doc, provider, stats),
    events: [...doc.events].reverse().map((event) => ({
      at: event.at.toISOString(),
      actor: event.actor,
      type: event.type,
      field: event.field ?? null,
      from: event.from,
      to: event.to,
    })),
  };
}

export function toPaymentDto(doc: PaymentDoc): Payment {
  return {
    id: doc._id.toString(),
    subscriptionId: doc.subscriptionId.toString(),
    source: doc.source,
    transactionId: doc.transactionId?.toString() ?? null,
    date: doc.date,
    amount: { cents: doc.amountCents, currency: doc.currency },
    note: doc.note ?? null,
    possibleDuplicateOfId: doc.possibleDuplicateOfId?.toString() ?? null,
    createdAt: doc.createdAt.toISOString(),
  };
}
