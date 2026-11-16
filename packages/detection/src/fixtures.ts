import { addMonthsClamped, iso, parse } from './dates';
import type { EngineTransaction } from './types';

/**
 * Jeux de transactions fictives, déterministes et relatifs à une date de référence.
 * Ils servent aux tests « golden » du moteur et au chargement de données de démo
 * (application utilisable sans banque connectée).
 */

export interface FixtureScenario {
  id: string;
  description: string;
  /** Résultat attendu du moteur. */
  expect:
    | { detected: false }
    | { detected: true; stale?: boolean; providerSlug?: string; maxLevel?: 'low' | 'medium' | 'high' };
}

export interface FixtureTransaction extends EngineTransaction {
  scenario: string;
}

export const FIXTURE_SCENARIOS: FixtureScenario[] = [
  {
    id: 'spotify',
    description: 'Spotify, mensuel stable par carte',
    expect: { detected: true, providerSlug: 'spotify' },
  },
  {
    id: 'netflix-price-change',
    description: 'Netflix avec une hausse de prix',
    expect: { detected: true, providerSlug: 'netflix' },
  },
  {
    id: 'chatgpt-fx',
    description: 'ChatGPT facturé en dollars : montant qui varie avec le change',
    expect: { detected: true, providerSlug: 'chatgpt' },
  },
  { id: 'claude', description: 'Claude, mensuel stable', expect: { detected: true, providerSlug: 'claude' } },
  { id: 'gym', description: 'Salle de sport inconnue du catalogue, prélèvement SEPA', expect: { detected: true } },
  {
    id: 'stopped',
    description: 'Abonnement arrêté depuis plus de 3 mois',
    expect: { detected: true, stale: true, providerSlug: 'deezer' },
  },
  { id: 'two-payments', description: 'Seulement deux paiements', expect: { detected: true, maxLevel: 'low' } },
  { id: 'one-off', description: 'Achat ponctuel chez un fournisseur connu', expect: { detected: false } },
  { id: 'annual', description: 'Abonnement annuel (hors MVP)', expect: { detected: false } },
  { id: 'groceries', description: 'Courses régulières à montant variable', expect: { detected: false } },
  { id: 'rent', description: 'Loyer par virement', expect: { detected: false } },
  { id: 'salary', description: 'Salaire (crédit)', expect: { detected: false } },
];

const DAY_MS = 86_400_000;

/** Décale un samedi/dimanche au lundi suivant, comme un prélèvement réel. */
function nextBusinessDay(value: string): string {
  const date = parse(value);
  const weekday = date.getUTCDay();
  if (weekday === 6) return iso(new Date(date.getTime() + 2 * DAY_MS));
  if (weekday === 0) return iso(new Date(date.getTime() + DAY_MS));
  return value;
}

function seededRandom(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function monthlyDates(today: string, day: number, fromMonthsAgo: number, toMonthsAgo: number): string[] {
  const dates: string[] = [];
  for (let monthsAgo = fromMonthsAgo; monthsAgo >= toMonthsAgo; monthsAgo -= 1) {
    const date = nextBusinessDay(addMonthsClamped(today, -monthsAgo, day));
    if (date <= today) dates.push(date);
  }
  return dates;
}

function frShort(value: string): string {
  return `${value.slice(8, 10)}/${value.slice(5, 7)}`;
}

/**
 * Génère les transactions de tous les scénarios.
 * @param today date de référence AAAA-MM-JJ
 * @param accountId compte auquel rattacher les transactions
 */
export function generateFixtureTransactions(today: string, accountId = 'fixture-account'): FixtureTransaction[] {
  const txs: FixtureTransaction[] = [];
  let counter = 0;
  const push = (
    scenario: string,
    date: string,
    amountCents: number,
    label: string,
    kind: string | null,
    currency = 'EUR',
  ) => {
    counter += 1;
    txs.push({
      id: `fx-${scenario}-${String(counter).padStart(4, '0')}`,
      accountId,
      date,
      amountCents,
      currency,
      label,
      counterpartyLabel: null,
      kind,
      pending: false,
      scenario,
    });
  };

  for (const date of monthlyDates(today, 5, 8, 0)) {
    push('spotify', date, -1099, `CB SPOTIFY P3A1B2C3 STOCKHOLM ${frShort(date)}`, 'card');
  }

  monthlyDates(today, 12, 8, 0).forEach((date, index) => {
    push('netflix-price-change', date, index < 5 ? -1349 : -1599, `CB NETFLIX.COM ${frShort(date)}`, 'card');
  });

  const fx = seededRandom(42);
  for (const date of monthlyDates(today, 3, 7, 0)) {
    const cents = -(2290 + Math.round(fx() * 60));
    push('chatgpt-fx', date, cents, `CB OPENAI *CHATGPT SUBSCR ${frShort(date)} USD 25,00`, 'card');
  }

  for (const date of monthlyDates(today, 18, 6, 0)) {
    push('claude', date, -2160, `CB ANTHROPIC CLAUDE.AI SUBSCRIPTION ${frShort(date)}`, 'card');
  }

  monthlyDates(today, 1, 6, 0).forEach((date, index) => {
    push('gym', date, -2999, `PRLV SEPA ATHLETIC CLUB LYON REF ${9384756 + index} MANDAT FR12ZZZ123456`, 'order');
  });

  for (const date of monthlyDates(today, 20, 10, 4)) {
    push('stopped', date, -1199, `CB DEEZER PARIS ${frShort(date)}`, 'card');
  }

  for (const date of monthlyDates(today, 8, 1, 0)) {
    push('two-payments', date, -690, `CB LECTURE PLUS MAGAZINE ${frShort(date)}`, 'card');
  }

  const oneOff = nextBusinessDay(addMonthsClamped(today, -2, 14));
  push('one-off', oneOff, -6990, `CB AMAZON PRIME FR ${frShort(oneOff)}`, 'card');

  for (const date of [addMonthsClamped(today, -13, 9), addMonthsClamped(today, -1, 9)]) {
    push('annual', nextBusinessDay(date), -9900, 'CB MICROSOFT 365 FAMILLE ANNUEL', 'card');
  }

  const grocery = seededRandom(7);
  for (let daysAgo = 180; daysAgo >= 0; daysAgo -= 7) {
    const date = iso(new Date(parse(today).getTime() - daysAgo * DAY_MS));
    push(
      'groceries',
      date,
      -(2300 + Math.round(grocery() * 6400)),
      `CB CARREFOUR MARKET LYON ${frShort(date)}`,
      'card',
    );
  }

  for (const date of monthlyDates(today, 2, 8, 0)) {
    push('rent', date, -75000, 'VIR SEPA LOYER APPARTEMENT M DUPONT', 'transfer');
  }

  for (const date of monthlyDates(today, 28, 8, 1)) {
    push('salary', date, 185000, 'VIR SEPA SALAIRE EMPLOYEUR', 'transfer');
  }

  return txs.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
