export { detectSubscriptions, DEFAULT_CONFIG } from './engine';
export { normalizeLabel, merchantKeyFromLabel, displayLabel } from './normalize';
export { generateFixtureTransactions, FIXTURE_SCENARIOS } from './fixtures';
export type {
  DetectionCandidate,
  DetectionConfig,
  DetectionOptions,
  EngineTransaction,
  ProviderPattern,
  ConfidenceLevel,
} from './types';
export type { FixtureScenario, FixtureTransaction } from './fixtures';
