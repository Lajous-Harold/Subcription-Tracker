/**
 * Normalisation des libellés bancaires.
 * Objectif : obtenir une clé marchand stable malgré les dates, références et préfixes
 * que les banques ajoutent (« CB SPOTIFY P3A1B2C3 STOCKHOLM 12/10 » → « SPOTIFY STOCKHOLM »).
 */

const PREFIXES = [
  /\bPRLV\s+SEPA\b/g,
  /\bPRELEVEMENT(\s+SEPA)?\b/g,
  /\bPRLV\b/g,
  /\bPAIEMENT\s+(PAR\s+)?CARTE\b/g,
  /\bPAIEMENT\s+CB\b/g,
  /\bACHAT\s+CB\b/g,
  /\bCARTE\b/g,
  /\bCB\b/g,
  /\bECHEANCE\b/g,
  /\bFACTURE\b/g,
];

const NOISE = [
  /\bX\d{4}\b/g, // numéro de carte masqué
  /\b\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?\b/g, // dates
  /\b\d{1,2}H\d{2}\b/g, // heures
  /\b(REF|MANDAT|ID|NUM|RUM|ICS)\s*[:.]?\s*\S+/g, // références SEPA
];

const STOP_WORDS = new Set(['SAS', 'SA', 'SARL', 'LTD', 'INC', 'EUR', 'FR', 'COM', 'WWW', 'HTTPS', 'HTTP']);

export function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Libellé normalisé : majuscules, sans accents, sans préfixes bancaires, dates ni références. */
export function normalizeLabel(raw: string): string {
  let value = stripAccents(raw).toUpperCase();
  for (const pattern of NOISE) value = value.replace(pattern, ' ');
  for (const pattern of PREFIXES) value = value.replace(pattern, ' ');
  value = value.replace(/[^A-Z0-9]+/g, ' ');
  const tokens = value
    .split(' ')
    .filter(Boolean)
    // jetons purement numériques ou codes de référence mêlant lettres et chiffres
    .filter((token) => !/^\d+$/.test(token))
    .filter((token) => !(token.length >= 6 && /\d/.test(token) && /[A-Z]/.test(token)))
    .filter((token) => !STOP_WORDS.has(token));
  return tokens.join(' ');
}

/** Clé marchand : les deux premiers mots significatifs du libellé normalisé. */
export function merchantKeyFromLabel(normalized: string): string {
  const tokens = normalized.split(' ').filter((token) => token.length > 1);
  const key = tokens.slice(0, 2).join(' ');
  return key || normalized || 'INCONNU';
}

/** Libellé lisible dérivé de la clé (« SPOTIFY STOCKHOLM » → « Spotify Stockholm »). */
export function displayLabel(key: string): string {
  return key
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
