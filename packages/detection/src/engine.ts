import { AVERAGE_MONTH_DAYS, addMonthsClamped, daysBetween, formatFrDate } from './dates';
import { displayLabel, merchantKeyFromLabel, normalizeLabel } from './normalize';
import { mean, median, stdev } from './stats';
import type {
  ConfidenceLevel,
  DetectionCandidate,
  DetectionConfig,
  DetectionOptions,
  EngineTransaction,
  ProviderPattern,
} from './types';

export const DEFAULT_CONFIG: DetectionConfig = {
  includedKinds: ['card', 'deferred_card', 'order', 'payment'],
  excludedKinds: [
    'transfer',
    'withdrawal',
    'check',
    'deposit',
    'loan_repayment',
    'summary_card',
    'market_order',
    'market_fee',
    'arbitrage',
    'profit',
    'refund',
    'payback',
    'payout',
    'bank',
    'fee',
  ],
  amountToleranceRatio: 0.1,
  amountToleranceCents: 100,
  monthlyMedianMin: 27,
  monthlyMedianMax: 33,
  minMonthlyRatio: 0.7,
  highThreshold: 0.75,
  mediumThreshold: 0.5,
  lowThreshold: 0.35,
  staleGraceDays: 15,
  abandonedAfterIntervals: 3,
  paymentIntermediaryPatterns: ['\\bPAYPAL\\b', '\\bLYDIA\\b', '\\bSUMERIA\\b', '\\bPAYLIB\\b'],
};

interface PreparedTransaction extends EngineTransaction {
  absCents: number;
  merchantKey: string;
  label: string;
  provider: ProviderPattern | null;
  kindKnown: boolean;
}

interface CompiledProvider {
  provider: ProviderPattern;
  regexes: RegExp[];
}

function compilePatterns(patterns: string[]): RegExp[] {
  return patterns.flatMap((pattern) => {
    try {
      return [new RegExp(pattern, 'i')];
    } catch {
      return [];
    }
  });
}

function compileProviders(providers: ProviderPattern[]): CompiledProvider[] {
  return providers.map((provider) => ({ provider, regexes: compilePatterns(provider.patterns) }));
}

function matchProvider(texts: string[], compiled: CompiledProvider[]): ProviderPattern | null {
  for (const { provider, regexes } of compiled) {
    if (regexes.some((regex) => texts.some((text) => regex.test(text)))) return provider;
  }
  return null;
}

function prepare(
  transactions: EngineTransaction[],
  compiled: CompiledProvider[],
  config: DetectionConfig,
): PreparedTransaction[] {
  const excluded = new Set(config.excludedKinds);
  const included = new Set(config.includedKinds);
  const intermediaryRegexes = compilePatterns(config.paymentIntermediaryPatterns);
  return transactions
    .filter((tx) => !tx.pending && !tx.deleted && tx.amountCents < 0)
    .filter((tx) => !(tx.kind && excluded.has(tx.kind)))
    .flatMap((tx) => {
      const normalizedLabel = normalizeLabel(tx.label);
      const normalizedCounterparty = tx.counterpartyLabel ? normalizeLabel(tx.counterpartyLabel) : '';
      const texts = [normalizedCounterparty, normalizedLabel].filter(Boolean);
      const provider = matchProvider(texts, compiled);
      // Le libellé d'un intermédiaire ne dit rien du marchand réellement payé : sans fournisseur reconnu,
      // regrouper ces opérations mêlerait des achats sans rapport.
      const paidThroughUnknownIntermediary =
        !provider && intermediaryRegexes.some((regex) => texts.some((text) => regex.test(text)));
      if (paidThroughUnknownIntermediary) return [];
      const labelMerchantKey = merchantKeyFromLabel(normalizedCounterparty || normalizedLabel);
      return [
        {
          ...tx,
          absCents: Math.abs(tx.amountCents),
          merchantKey: provider ? `provider:${provider.slug}` : labelMerchantKey,
          label: provider ? provider.name : displayLabel(labelMerchantKey),
          provider,
          kindKnown: tx.kind !== null && included.has(tx.kind),
        },
      ];
    });
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item);
    const group = groups.get(value);
    if (group) group.push(item);
    else groups.set(value, [item]);
  }
  return groups;
}

function withinTolerance(a: number, b: number, config: DetectionConfig): boolean {
  const reference = Math.max(a, b);
  return Math.abs(a - b) <= Math.max(reference * config.amountToleranceRatio, config.amountToleranceCents);
}

/** Deux abonnements de montants différents chez un même marchand restent séparés. */
function clusterByAmount(items: PreparedTransaction[], config: DetectionConfig): PreparedTransaction[][] {
  const clusters: PreparedTransaction[][] = [];
  for (const tx of [...items].sort((a, b) => a.absCents - b.absCents)) {
    const target = clusters.find((cluster) =>
      withinTolerance(median(cluster.map((item) => item.absCents)), tx.absCents, config),
    );
    if (target) target.push(tx);
    else clusters.push([tx]);
  }
  return clusters.map((cluster) => cluster.sort((a, b) => a.date.localeCompare(b.date)));
}

/**
 * Fusionne deux séries successives d'un même marchand quand le prix change une fois
 * (ex. hausse de 13,49 € à 15,99 €) : la seconde commence environ un mois après la fin de la première.
 */
function mergePriceChanges(clusters: PreparedTransaction[][]): PreparedTransaction[][] {
  const ordered = [...clusters].sort((a, b) => (a[0]?.date ?? '').localeCompare(b[0]?.date ?? ''));
  const merged: PreparedTransaction[][] = [];
  for (const cluster of ordered) {
    const previous = merged[merged.length - 1];
    const previousLast = previous?.[previous.length - 1];
    const first = cluster[0];
    if (previous && previousLast && first && previous.length >= 2) {
      const gap = daysBetween(previousLast.date, first.date);
      const ratio = first.absCents / previousLast.absCents;
      if (gap >= 20 && gap <= 40 && ratio >= 0.65 && ratio <= 1.5) {
        previous.push(...cluster);
        continue;
      }
    }
    merged.push([...cluster]);
  }
  return merged;
}

function levelFor(confidence: number, config: DetectionConfig): ConfidenceLevel {
  if (confidence >= config.highThreshold) return 'high';
  if (confidence >= config.mediumThreshold) return 'medium';
  return 'low';
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/**
 * Marchand fréquenté (courses, carburant…) : achats bien plus fréquents qu'un mois
 * et la série étudiée n'en représente qu'une minorité. Ses montants proches sont du hasard.
 */
function isFrequentMerchant(group: PreparedTransaction[], series: PreparedTransaction[]): boolean {
  const dates = [...new Set(group.map((tx) => tx.date))].sort();
  if (dates.length < 4) return false;
  const gaps: number[] = [];
  for (let index = 1; index < dates.length; index += 1) {
    gaps.push(daysBetween(dates[index - 1] as string, dates[index] as string));
  }
  return median(gaps) < 20 && series.length / group.length < 0.5;
}

function analyzeSeries(
  series: PreparedTransaction[],
  options: DetectionOptions,
  config: DetectionConfig,
): DetectionCandidate | null {
  const first = series[0];
  const last = series[series.length - 1];
  if (!first || !last) return null;

  const uniqueDates = [...new Set(series.map((tx) => tx.date))].sort();
  if (uniqueDates.length < 2) return null;

  const intervals: number[] = [];
  for (let index = 1; index < uniqueDates.length; index += 1) {
    intervals.push(daysBetween(uniqueDates[index - 1] as string, uniqueDates[index] as string));
  }

  // Un intervalle compte s'il correspond à 1 ou 2 mois (un mois sans prélèvement est toléré).
  const monthlyIntervals: number[] = [];
  let skippedMonths = 0;
  for (const interval of intervals) {
    const months = Math.round(interval / AVERAGE_MONTH_DAYS);
    if (months >= 1 && months <= 2 && Math.abs(interval - months * AVERAGE_MONTH_DAYS) <= 4 * months + 1) {
      monthlyIntervals.push(interval / months);
      skippedMonths += months - 1;
    }
  }
  if (monthlyIntervals.length === 0) return null;
  const monthlyRatio = monthlyIntervals.length / intervals.length;
  const intervalDays = median(monthlyIntervals);
  if (
    monthlyRatio < config.minMonthlyRatio ||
    intervalDays < config.monthlyMedianMin ||
    intervalDays > config.monthlyMedianMax
  ) {
    return null;
  }

  const amounts = series.map((tx) => tx.absCents);
  const medianCents = Math.round(median(amounts));
  const minCents = Math.min(...amounts);
  const maxCents = Math.max(...amounts);
  const amountVariation = mean(amounts) === 0 ? 0 : stdev(amounts) / mean(amounts);
  const paymentDays = uniqueDates.map((value) => Number(value.slice(8, 10)));
  const dayOfMonth = Math.min(31, Math.max(1, Math.round(median(paymentDays))));
  const intervalStdev = stdev(monthlyIntervals);
  const daySpread = stdev(paymentDays.map((day) => Math.min(day, 28)));
  const occurrences = uniqueDates.length;
  const provider = first.provider;
  const daysSinceLastPayment = daysBetween(last.date, options.today);
  if (daysSinceLastPayment > config.abandonedAfterIntervals * intervalDays) return null;
  const stale = daysSinceLastPayment > intervalDays + config.staleGraceDays;
  const unknownKinds = series.some((tx) => !tx.kindKnown);

  let score = occurrences >= 5 ? 0.7 : occurrences === 4 ? 0.65 : occurrences === 3 ? 0.55 : 0.35;
  if (intervalStdev <= 2) score += 0.1;
  else if (intervalStdev <= 4) score += 0.05;
  if (amountVariation <= 0.02) score += 0.1;
  else if (amountVariation <= 0.1) score += 0.05;
  if (daySpread <= 2) score += 0.05;
  if (provider) score += 0.15;
  if (monthlyRatio < 1) score -= 0.1 * (1 - monthlyRatio) * 2;
  if (skippedMonths > 0) score -= 0.05 * Math.min(skippedMonths, 2);
  if (stale) score -= 0.15;
  if (unknownKinds) score -= 0.1;
  if (occurrences === 2) score = Math.min(score, provider ? 0.6 : 0.49);
  // Une série interrompue reste à vérifier : jamais en confiance élevée.
  if (stale) score = Math.min(score, config.highThreshold - 0.01);
  // Une série d'opérations n'est jamais une preuve d'abonnement : la confiance plafonne à 0,95.
  const confidence = Math.round(Math.max(0, Math.min(0.95, score)) * 100) / 100;
  if (confidence < config.lowThreshold) return null;

  // Série active : prochaine échéance future. Série interrompue : échéance attendue (passée).
  let nextDueDate = addMonthsClamped(last.date, 1, dayOfMonth);
  for (let guard = 0; !stale && nextDueDate < options.today && guard < 120; guard += 1) {
    nextDueDate = addMonthsClamped(nextDueDate, 1, dayOfMonth);
  }

  const currency = first.currency;
  const reasons = [
    `${occurrences} paiements entre le ${formatFrDate(first.date)} et le ${formatFrDate(last.date)}`,
    `Rythme mensuel : tous les ~${Math.round(intervalDays)} jours${intervalStdev <= 2 ? ', très régulier' : ''}`,
    minCents === maxCents
      ? `Montant stable : ${formatMoney(medianCents, currency)}`
      : amountVariation <= 0.02
        ? `Montant quasi stable : ~${formatMoney(medianCents, currency)} (de ${formatMoney(minCents, currency)} à ${formatMoney(maxCents, currency)})`
        : `Montant variable : de ${formatMoney(minCents, currency)} à ${formatMoney(maxCents, currency)}`,
    `Prélevé vers le ${dayOfMonth} du mois`,
  ];
  if (provider) reasons.push(`Fournisseur reconnu : ${provider.name}`);
  if (occurrences === 2) reasons.push('Seulement 2 paiements : à confirmer');
  if (monthlyRatio < 1 || skippedMonths > 0) reasons.push('Certains mois sans paiement observé');
  if (unknownKinds) reasons.push("Type d'opération inhabituel pour un abonnement");
  if (stale) reasons.push(`Aucun paiement depuis ${daysSinceLastPayment} jours : abonnement peut-être terminé`);

  const amountBucket = Math.round(Math.log2(Math.max(medianCents, 1)));
  return {
    signature: `${first.accountId}|${first.merchantKey}|${amountBucket}`,
    merchantKey: first.merchantKey,
    label: first.label,
    providerId: provider?.id ?? null,
    accountId: first.accountId,
    currency,
    transactionIds: series.map((tx) => tx.id),
    occurrences,
    amount: {
      medianCents,
      minCents,
      maxCents,
      lastCents: last.absCents,
    },
    intervalDays: Math.round(intervalDays * 10) / 10,
    dayOfMonth,
    firstDate: first.date,
    lastDate: last.date,
    nextDueDate,
    confidence,
    level: levelFor(confidence, config),
    reasons,
    stale,
  };
}

/** Pure et déterministe : aucune I/O, même entrée, même résultat. */
export function detectSubscriptions(
  transactions: EngineTransaction[],
  providers: ProviderPattern[],
  options: DetectionOptions,
): DetectionCandidate[] {
  const config: DetectionConfig = { ...DEFAULT_CONFIG, ...options.config };
  const prepared = prepare(transactions, compileProviders(providers), config);
  const groups = groupBy(prepared, (tx) => `${tx.accountId}|${tx.currency}|${tx.merchantKey}`);

  const candidates: DetectionCandidate[] = [];
  for (const group of groups.values()) {
    for (const series of mergePriceChanges(clusterByAmount(group, config))) {
      if (isFrequentMerchant(group, series)) continue;
      const candidate = analyzeSeries(series, options, config);
      if (candidate) candidates.push(candidate);
    }
  }
  return candidates.sort((a, b) => b.confidence - a.confidence || a.label.localeCompare(b.label));
}
