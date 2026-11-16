import type { AppConfig } from './config';

let current: AppConfig | null = null;

/** Configuration chargée au démarrage (ou par les tests). */
export function setConfig(config: AppConfig): void {
  current = config;
}

export function getConfig(): AppConfig {
  if (!current) throw new Error('Configuration non initialisée : appeler setConfig() au démarrage');
  return current;
}
