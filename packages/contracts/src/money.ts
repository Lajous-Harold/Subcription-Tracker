// Dates métier AAAA-MM-JJ, toujours interprétées en UTC pour ne pas dépendre du fuseau local.

const DAY_MS = 86_400_000;

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

export function addDays(value: string, days: number): string {
  return toIsoDate(new Date(parseIsoDate(value).getTime() + days * DAY_MS));
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function addMonthsClamped(value: string, months: number, preferredDay?: number): string {
  const date = parseIsoDate(value);
  const day = preferredDay ?? date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const clamped = Math.min(day, daysInMonth(target.getUTCFullYear(), target.getUTCMonth()));
  return toIsoDate(new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), clamped)));
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

/** Accepte « 12,99 », « 12.99 » ou « 12 » ; null si la saisie est invalide. */
export function parseAmountToCents(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [units = '0', decimals = ''] = normalized.split('.');
  return Number(units) * 100 + Number(decimals.padEnd(2, '0'));
}
