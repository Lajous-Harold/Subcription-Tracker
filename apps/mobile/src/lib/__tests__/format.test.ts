import { describe, expect, it } from '@jest/globals';
import { parseAmountToCents } from '@subtracker/contracts';
import {
  centsToInput,
  formatAccountLabel,
  formatCalendarDay,
  formatMediumDate,
  formatMoney,
  formatOperationCount,
  formatSignedMoney,
  formatTimeAgo,
  initialOf,
} from '../format';

const MINUS_SIGN = String.fromCharCode(0x2212);
const NO_BREAK_SPACE = String.fromCharCode(0xa0);
const normalizeSpaces = (text: string) => text.replace(/\s/g, ' ');

const NOW = new Date('2026-11-18T12:00:00Z');

describe('format', () => {
  it('convertit les montants saisis en centimes et inversement', () => {
    expect(parseAmountToCents('12,99')).toBe(1299);
    expect(parseAmountToCents('12.5')).toBe(1250);
    expect(parseAmountToCents('abc')).toBeNull();
    expect(centsToInput(1099)).toBe('10,99');
  });

  it('formate en euros à la française', () => {
    expect(normalizeSpaces(formatMoney(1099))).toBe('10,99 €');
  });

  it('signe les débits du moins typographique, dans la devise donnée', () => {
    expect(normalizeSpaces(formatSignedMoney(-999))).toBe(`${MINUS_SIGN}9,99 €`);
    expect(normalizeSpaces(formatSignedMoney(-1250, 'USD'))).toBe(`${MINUS_SIGN}12,50 $US`);
    expect(normalizeSpaces(formatSignedMoney(999))).toBe('9,99 €');
  });

  it('donne la date d’une opération avec le mois abrégé et l’année, sans décalage de fuseau', () => {
    expect(formatMediumDate('2026-11-03')).toBe('3 nov. 2026');
    expect(formatMediumDate('2026-09-30')).toBe('30 sept. 2026');
  });

  it('accorde le nombre d’opérations, zéro compris au singulier', () => {
    expect(formatOperationCount(0)).toBe('0 opération');
    expect(formatOperationCount(1)).toBe('1 opération');
    expect(formatOperationCount(412)).toBe('412 opérations');
    expect(normalizeSpaces(formatOperationCount(1234))).toBe('1 234 opérations');
  });

  it('ajoute au nom du compte ses 4 derniers caractères masqués, sans les séparer du nom', () => {
    expect(formatAccountLabel({ name: 'Compte courant', numberLast4: '4821' })).toBe(
      `Compte courant${NO_BREAK_SPACE}••4821`,
    );
    expect(formatAccountLabel({ name: 'Livret A', numberLast4: null })).toBe('Livret A');
  });

  it('dit depuis combien de temps, en unité lisible, puis donne la date au-delà d’une semaine', () => {
    expect(formatTimeAgo('2026-11-18T11:59:30Z', NOW)).toBe('à l’instant');
    expect(formatTimeAgo('2026-11-18T11:35:00Z', NOW)).toBe('il y a 25 min');
    expect(formatTimeAgo('2026-11-18T10:00:00Z', NOW)).toBe('il y a 2 h');
    expect(formatTimeAgo('2026-11-12T12:00:00Z', NOW)).toBe('il y a 6 j');
    expect(formatTimeAgo('2026-11-11T12:00:00Z', NOW)).toBe('le 11 nov.');
  });

  it('ne donne jamais de durée négative pour une date à venir', () => {
    expect(formatTimeAgo('2026-11-18T12:05:00Z', NOW)).toBe('à l’instant');
  });

  it('découpe une date civile en jour et mois abrégé, sans décalage de fuseau', () => {
    expect(formatCalendarDay('2026-12-01')).toEqual({ day: '1', month: 'déc.' });
    expect(formatCalendarDay('2026-05-31')).toEqual({ day: '31', month: 'mai' });
  });

  it('prend la première lettre ou le premier chiffre en majuscule', () => {
    expect(initialOf('netflix')).toBe('N');
    expect(initialOf('  été+')).toBe('É');
    expect(initialOf('_42 Paris')).toBe('4');
    expect(initialOf('')).toBe('?');
    expect(initialOf(null)).toBe('?');
  });
});
