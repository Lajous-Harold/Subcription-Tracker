import { addDays, todayIso, DashboardSummarySchema, type DashboardSummary } from '@subtracker/contracts';
import { createModule } from '../../core/http';
import { BankLinkModel, type BankLinkDoc } from '../bank/models';
import { toBankLinkDto } from '../bank/service';
import { CandidateModel } from '../detection/model';
import { SubscriptionModel, type SubscriptionDoc } from '../subscriptions/models';
import { toDtos } from '../subscriptions/service';

export const dashboardModule = createModule('/dashboard', 'Tableau de bord');

const DASHBOARD_CURRENCY = 'EUR';
const UPCOMING_WINDOW_DAYS = 30;
const UPCOMING_LIMIT = 8;

/** Agrégats calculés à la lecture : rien n'est stocké. */
async function buildSummary(userId: string, today = todayIso()): Promise<DashboardSummary> {
  const [docs, pendingCandidates, link] = await Promise.all([
    SubscriptionModel.find({ userId, status: { $in: ['active', 'cancellation_pending'] } }).lean<SubscriptionDoc[]>(),
    CandidateModel.countDocuments({ userId, status: 'pending' }),
    BankLinkModel.findOne({ userId }).lean<BankLinkDoc>(),
  ]);
  const subscriptions = await toDtos(userId, docs, today);

  let observedCents = 0;
  let declaredCents = 0;
  const otherCurrencyCounts = new Map<string, number>();
  for (const sub of subscriptions) {
    const { currency } = sub.amount.value;
    if (currency !== DASHBOARD_CURRENCY) {
      otherCurrencyCounts.set(currency, (otherCurrencyCounts.get(currency) ?? 0) + 1);
      continue;
    }
    if (sub.amount.origin === 'observed') observedCents += sub.amount.value.cents;
    else declaredCents += sub.amount.value.cents;
  }
  const totalCents = observedCents + declaredCents;
  const horizon = addDays(today, UPCOMING_WINDOW_DAYS);

  const upcoming = subscriptions
    .filter((sub) => sub.status === 'active' && sub.nextDueDate && sub.nextDueDate.value <= horizon)
    .map((sub) => ({
      subscriptionId: sub.id,
      label: sub.label,
      date: sub.nextDueDate!.value,
      dateOrigin: sub.nextDueDate!.origin,
      amountCents: sub.amount.value.cents,
      currency: sub.amount.value.currency,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, UPCOMING_LIMIT);

  const bank = link ? toBankLinkDto(link) : null;
  return {
    currency: DASHBOARD_CURRENCY,
    trackedCount: subscriptions.length,
    monthly: { totalCents, observedCents, declaredCents },
    annualProjectionCents: totalCents * 12,
    excludedOtherCurrencies: [...otherCurrencyCounts.entries()].map(([currency, count]) => ({ currency, count })),
    upcoming,
    pendingCandidates,
    missingPayments: subscriptions.filter((sub) => sub.paymentMissing).length,
    bank: bank ? { status: bank.status, consentExpiringSoon: bank.consentExpiringSoon } : null,
  };
}

dashboardModule.route({
  method: 'get',
  path: '/summary',
  summary: 'Synthèse : nombre d’abonnements, coût mensuel, projection annuelle',
  description:
    'Le coût mensuel distingue la part observée (paiements bancaires) et la part déclarée. La projection annuelle est une estimation (mensuel × 12).',
  response: DashboardSummarySchema,
  handler: ({ userId }) => buildSummary(userId),
});
