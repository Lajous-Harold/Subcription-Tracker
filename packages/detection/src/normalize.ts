// Les banques ajoutent dates, références et préfixes aux libellés : on les retire pour obtenir
// une clé marchand stable (« CB SPOTIFY P3A1B2C3 STOCKHOLM 12/10 » → « SPOTIFY STOCKHOLM »).

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

const MASKED_CARD_NUMBER = /\bX\d{4}\b/g;
const DATE = /\b\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?\b/g;
const TIME = /\b\d{1,2}H\d{2}\b/g;
const SEPA_REFERENCE = /\b(REF|MANDAT|ID|NUM|RUM|ICS)\s*[:.]?\s*\S+/g;
const NOISE = [MASKED_CARD_NUMBER, DATE, TIME, SEPA_REFERENCE];

const STOP_WORDS = new Set(['SAS', 'SA', 'SARL', 'LTD', 'INC', 'EUR', 'FR', 'COM', 'WWW', 'HTTPS', 'HTTP']);

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const isNumeric = (token: string): boolean => /^\d+$/.test(token);

const isReferenceCode = (token: string): boolean => token.length >= 6 && /\d/.test(token) && /[A-Z]/.test(token);

export function normalizeLabel(raw: string): string {
  let value = stripAccents(raw).toUpperCase();
  for (const pattern of NOISE) value = value.replace(pattern, ' ');
  for (const pattern of PREFIXES) value = value.replace(pattern, ' ');
  value = value.replace(/[^A-Z0-9]+/g, ' ');
  const tokens = value
    .split(' ')
    .filter(Boolean)
    .filter((token) => !isNumeric(token))
    .filter((token) => !isReferenceCode(token))
    .filter((token) => !STOP_WORDS.has(token));
  return tokens.join(' ');
}

const MERCHANT_KEY_WORD_COUNT = 2;

export function merchantKeyFromLabel(normalized: string): string {
  const significantWords = normalized.split(' ').filter((word) => word.length > 1);
  const key = significantWords.slice(0, MERCHANT_KEY_WORD_COUNT).join(' ');
  return key || normalized || 'INCONNU';
}

export function displayLabel(key: string): string {
  return key
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
