/**
 * Format neutre, sans notion Powens : transactions réelles et fixtures sont converties vers ce format.
 */
export interface EngineTransaction {
  id: string;
  accountId: string;
  /** AAAA-MM-JJ */
  date: string;
  /** Négatif pour un débit. */
  amountCents: number;
  currency: string;
  label: string;
  counterpartyLabel?: string | null;
  /** Type bancaire (card, order, transfer…) ; null si inconnu. */
  kind: string | null;
  /** Opération pas encore comptabilisée. */
  pending: boolean;
  deleted?: boolean;
}

export interface ProviderPattern {
  id: string;
  slug: string;
  name: string;
  /** Expressions régulières (insensibles à la casse) testées sur le libellé normalisé. */
  patterns: string[];
}

export interface DetectionConfig {
  /** Types retenus avec un poids plein. */
  includedKinds: string[];
  /** Types toujours exclus (loyer, épargne, retraits…). */
  excludedKinds: string[];
  /** Écart de montant toléré dans un groupe : max(relatif, absolu). */
  amountToleranceRatio: number;
  amountToleranceCents: number;
  /** Fenêtre de l'intervalle médian mensuel, en jours. */
  monthlyMedianMin: number;
  monthlyMedianMax: number;
  /** Part minimale d'intervalles compatibles avec un rythme mensuel. */
  minMonthlyRatio: number;
  highThreshold: number;
  mediumThreshold: number;
  lowThreshold: number;
  /** Jours de grâce au-delà de l'échéance attendue avant de considérer la série comme inactive. */
  staleGraceDays: number;
  /** Nombre d'intervalles sans paiement au-delà duquel une série n'est plus proposée du tout. */
  abandonedAfterIntervals: number;
  /**
   * Expressions régulières (insensibles à la casse) désignant un intermédiaire de paiement (PayPal, Lydia…).
   * Une opération passée par un intermédiaire n'est retenue que si elle désigne aussi un fournisseur du catalogue.
   */
  paymentIntermediaryPatterns: string[];
}

export interface DetectionOptions {
  /** AAAA-MM-JJ, injectée pour garder la détection déterministe. */
  today: string;
  config?: Partial<DetectionConfig>;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface DetectionCandidate {
  /** Clé stable : compte + marchand + tranche de montant. */
  signature: string;
  merchantKey: string;
  label: string;
  providerId: string | null;
  accountId: string;
  currency: string;
  transactionIds: string[];
  occurrences: number;
  amount: { medianCents: number; minCents: number; maxCents: number; lastCents: number };
  intervalDays: number;
  dayOfMonth: number;
  firstDate: string;
  lastDate: string;
  nextDueDate: string;
  confidence: number;
  level: ConfidenceLevel;
  reasons: string[];
  stale: boolean;
}
