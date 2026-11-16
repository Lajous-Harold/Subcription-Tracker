/**
 * Utilitaires de dates et montants partagés (sans dépendance).
 * Les montants sont des centimes entiers ; les dates métier des chaînes AAAA-MM-JJ en UTC.
 */

const DAY_MS = 86_400_000;

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / DAY_MS);
}

export function addDays(value: string, days: number): string {
  return toIsoDate(new Date(parseIsoDate(value).getTime() + days * DAY_MS));
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Ajoute des mois en gardant le jour voulu, borné à la fin du mois. */
export function addMonthsClamped(value: string, months: number, preferredDay?: number): string {
  const date = parseIsoDate(value);
  const day = preferredDay ?? date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const clamped = Math.min(day, daysInMonth(target.getUTCFullYear(), target.getUTCMonth()));
  return toIsoDate(new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), clamped)));
}

/** Prochaine occurrence (>= from) d'un jour de mois donné. */
export function nextOccurrenceOfDay(from: string, day: number): string {
  const date = parseIsoDate(from);
  const thisMonth = addMonthsClamped(
    toIsoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))),
    0,
    day,
  );
  return thisMonth >= from ? thisMonth : addMonthsClamped(thisMonth, 1, day);
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

/** Parse un montant saisi (« 12,99 », « 12.99 », « 12 ») en centimes. Retourne null si invalide. */
export function parseAmountToCents(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [units = '0', decimals = ''] = normalized.split('.');
  return Number(units) * 100 + Number(decimals.padEnd(2, '0'));
}

export function formatCents(cents: number, currency = 'EUR', locale = 'fr-FR'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}
