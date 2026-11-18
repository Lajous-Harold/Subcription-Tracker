import { describe, expect, it } from '@jest/globals';
import { describeDashboardPeriod } from '../dashboard-period';

describe('describeDashboardPeriod', () => {
  const now = new Date('2026-11-18T10:00:00Z');

  it('nomme le mois en cours avec une majuscule, puis le nombre d’abonnements suivis', () => {
    expect(describeDashboardPeriod(6, now)).toBe('Novembre 2026 · 6 abonnements suivis');
  });

  it('accorde au singulier', () => {
    expect(describeDashboardPeriod(1, now)).toBe('Novembre 2026 · 1 abonnement suivi');
  });
});
