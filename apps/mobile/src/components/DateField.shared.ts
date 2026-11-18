export interface DateFieldProps {
  label: string;
  /** Date civile `AAAA-MM-JJ`, ou chaîne vide quand aucune date n'est choisie. */
  value: string;
  onChange: (value: string) => void;
  /** Autorise à revenir à « aucune date » (champs facultatifs). */
  clearable?: boolean;
  error?: boolean;
}

/** Date locale à minuit : un passage par UTC décalerait le jour affiché selon le fuseau. */
export function parseCivilDate(value: string): Date {
  const [year = 1970, month = 1, day = 1] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function toCivilDate(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
