export const DAY_MS = 86_400_000;
export const AVERAGE_MONTH_DAYS = 30.44;

export const parseIsoDate = (value: string): Date => new Date(`${value}T00:00:00Z`);
export const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

export function daysBetween(from: string, to: string): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / DAY_MS);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function addMonthsClamped(value: string, months: number, preferredDay: number): string {
  const date = parseIsoDate(value);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const day = Math.min(preferredDay, daysInMonth(target.getUTCFullYear(), target.getUTCMonth()));
  return toIsoDate(new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), day)));
}

export function formatFrDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}
