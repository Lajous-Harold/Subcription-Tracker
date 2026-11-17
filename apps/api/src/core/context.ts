import type { AppConfig } from './config';
import { logger } from './logger';

let currentConfig: AppConfig | null = null;

export function setConfig(config: AppConfig): void {
  currentConfig = config;
  logger.level = config.LOG_LEVEL;
}

export function getConfig(): AppConfig {
  if (!currentConfig) throw new Error('Configuration non initialisée : appeler setConfig() au démarrage');
  return currentConfig;
}
