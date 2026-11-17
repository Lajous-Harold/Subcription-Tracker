import type { AppConfig } from './config';

let currentConfig: AppConfig | null = null;

export function setConfig(config: AppConfig): void {
  currentConfig = config;
}

export function getConfig(): AppConfig {
  if (!currentConfig) throw new Error('Configuration non initialisée : appeler setConfig() au démarrage');
  return currentConfig;
}
