import type { Option } from './OptionGroup';

/**
 * Le contrat accepte tout code ISO 4217 ; le formulaire propose les devises courantes des abonnements
 * d'un compte français, et conserve en plus celle d'un abonnement existant importé dans une autre devise.
 */
const COMMON_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'] as const;

export function currencyOptions(current: string): Option<string>[] {
  const codes: string[] = [...COMMON_CURRENCIES];
  if (!codes.includes(current)) codes.push(current);
  return codes.map((code) => ({ value: code, label: code }));
}
