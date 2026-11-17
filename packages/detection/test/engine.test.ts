import { describe, expect, it } from '@jest/globals';
import {
  FIXTURE_SCENARIOS,
  detectSubscriptions,
  generateFixtureTransactions,
  merchantKeyFromLabel,
  normalizeLabel,
  type EngineTransaction,
  type ProviderPattern,
} from '../src';

const TODAY = '2026-11-16';

const PROVIDERS: ProviderPattern[] = [
  { id: 'p-spotify', slug: 'spotify', name: 'Spotify', patterns: ['\\bSPOTIFY\\b'] },
  { id: 'p-netflix', slug: 'netflix', name: 'Netflix', patterns: ['\\bNETFLIX\\b'] },
  { id: 'p-chatgpt', slug: 'chatgpt', name: 'ChatGPT', patterns: ['\\bCHATGPT\\b', '\\bOPENAI\\b'] },
  { id: 'p-claude', slug: 'claude', name: 'Claude', patterns: ['\\bANTHROPIC\\b', '\\bCLAUDE AI\\b'] },
  { id: 'p-deezer', slug: 'deezer', name: 'Deezer', patterns: ['\\bDEEZER\\b'] },
  { id: 'p-amazon', slug: 'amazon-prime', name: 'Amazon Prime', patterns: ['\\bAMAZON PRIME\\b', '\\bPRIME VIDEO\\b'] },
  { id: 'p-microsoft', slug: 'microsoft-365', name: 'Microsoft 365', patterns: ['\\bMICROSOFT 365\\b'] },
];

describe('normalizeLabel', () => {
  it('retire préfixes, dates, cartes masquées et références', () => {
    expect(normalizeLabel('CB SPOTIFY P3A1B2C3 STOCKHOLM 12/10')).toBe('SPOTIFY STOCKHOLM');
    expect(normalizeLabel('PRLV SEPA ATHLETIC CLUB LYON REF 9384756 MANDAT FR12ZZZ123456')).toBe('ATHLETIC CLUB LYON');
    expect(normalizeLabel('Paiement par carte X1234 Déezer Paris 03/11/2026')).toBe('DEEZER PARIS');
  });

  it('produit une clé marchand stable sur deux mots', () => {
    expect(merchantKeyFromLabel(normalizeLabel('CB CARREFOUR MARKET LYON 03/11'))).toBe('CARREFOUR MARKET');
  });
});

describe('detectSubscriptions — fixtures golden', () => {
  const transactions = generateFixtureTransactions(TODAY);
  const candidates = detectSubscriptions(transactions, PROVIDERS, { today: TODAY });

  const scenarioOf = (ids: string[]) => {
    const scenarios = new Set(ids.map((id) => transactions.find((tx) => tx.id === id)?.scenario).filter(Boolean));
    expect(scenarios.size).toBe(1);
    return [...scenarios][0];
  };

  const byScenario = new Map<string, (typeof candidates)[number][]>();
  for (const candidate of candidates) {
    const scenario = scenarioOf(candidate.transactionIds) as string;
    byScenario.set(scenario, [...(byScenario.get(scenario) ?? []), candidate]);
  }

  for (const scenario of FIXTURE_SCENARIOS) {
    it(`${scenario.id} : ${scenario.description}`, () => {
      const found = byScenario.get(scenario.id) ?? [];
      const expectation = scenario.expect;
      if (!expectation.detected) {
        expect(found).toHaveLength(0);
        return;
      }
      expect(found).toHaveLength(1);
      const candidate = found[0]!;
      const slug = expectation.providerSlug;
      if (slug) {
        const provider = PROVIDERS.find((p) => p.slug === slug);
        expect(candidate.providerId).toBe(provider?.id);
      }
      expect(candidate.stale).toBe(expectation.stale ?? false);
      if (expectation.maxLevel === 'low') expect(candidate.level).toBe('low');
      expect(candidate.reasons.length).toBeGreaterThan(2);
    });
  }

  it('Spotify sort en confiance élevée avec la bonne échéance', () => {
    const spotify = byScenario.get('spotify')?.[0];
    expect(spotify).toBeDefined();
    expect(spotify!.level).toBe('high');
    expect(spotify!.confidence).toBeLessThanOrEqual(0.95);
    expect(spotify!.amount.medianCents).toBe(1099);
    expect(spotify!.nextDueDate >= TODAY).toBe(true);
    expect(spotify!.nextDueDate.slice(8, 10)).toMatch(/0[5-7]/);
  });

  it('la hausse de prix Netflix reste un seul abonnement au dernier prix', () => {
    const netflix = byScenario.get('netflix-price-change')?.[0];
    expect(netflix?.amount.lastCents).toBe(1599);
    expect(netflix?.occurrences).toBeGreaterThanOrEqual(8);
  });

  it('est déterministe', () => {
    const again = detectSubscriptions(generateFixtureTransactions(TODAY), PROVIDERS, { today: TODAY });
    expect(again).toEqual(candidates);
  });
});

describe('detectSubscriptions — cas limites', () => {
  const base = (overrides: Partial<EngineTransaction>): EngineTransaction => ({
    id: Math.random().toString(36).slice(2),
    accountId: 'a1',
    date: '2026-01-05',
    amountCents: -999,
    currency: 'EUR',
    label: 'CB SERVICE TEST',
    kind: 'card',
    pending: false,
    ...overrides,
  });

  it('ignore les opérations à venir, supprimées et les crédits', () => {
    const txs = ['2026-07-05', '2026-08-05', '2026-09-05', '2026-10-05'].flatMap((date) => [
      base({ date, pending: true }),
      base({ date, deleted: true, label: 'CB AUTRE SERVICE' }),
      base({ date, amountCents: 999, label: 'CB REMBOURSEMENT' }),
    ]);
    expect(detectSubscriptions(txs, [], { today: '2026-10-20' })).toEqual([]);
  });

  it('sépare deux abonnements de montants différents chez un même marchand', () => {
    const txs = ['2026-07-05', '2026-08-05', '2026-09-05', '2026-10-05'].flatMap((date) => [
      base({ date, label: 'CB APPLE.COM BILL', amountCents: -99 }),
      base({ date, label: 'CB APPLE.COM BILL', amountCents: -1099 }),
    ]);
    const result = detectSubscriptions(txs, [], { today: '2026-10-20' });
    expect(result).toHaveLength(2);
    expect(new Set(result.map((c) => c.signature)).size).toBe(2);
  });

  it('tolère un mois sans paiement', () => {
    const txs = ['2026-05-05', '2026-06-05', '2026-08-05', '2026-09-05', '2026-10-05'].map((date) => base({ date }));
    const [candidate] = detectSubscriptions(txs, [], { today: '2026-10-20' });
    expect(candidate).toBeDefined();
    expect(candidate?.reasons.join(' ')).toContain('Certains mois sans paiement');
  });

  it('borne le jour au dernier jour du mois pour une échéance au 31', () => {
    const txs = ['2026-07-31', '2026-08-31', '2026-09-30', '2026-10-31'].map((date) => base({ date }));
    const [candidate] = detectSubscriptions(txs, [], { today: '2026-11-02' });
    expect(candidate?.nextDueDate).toBe('2026-11-30');
  });

  it('accepte une configuration de types personnalisée', () => {
    const txs = ['2026-07-05', '2026-08-05', '2026-09-05'].map((date) => base({ date, kind: 'transfer' }));
    expect(detectSubscriptions(txs, [], { today: '2026-09-20' })).toHaveLength(0);
    expect(
      detectSubscriptions(txs, [], {
        today: '2026-09-20',
        config: { excludedKinds: [], includedKinds: ['transfer'] },
      }),
    ).toHaveLength(1);
  });
});
