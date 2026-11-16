import { createApp } from './app';
import { loadConfig } from './core/config';
import { connectDatabase, disconnectDatabase } from './core/db';
import { logger } from './core/logger';
import { startJobs } from './jobs/scheduler';
import { ensureProviderCatalog } from './modules/providers/service';

async function main() {
  const config = loadConfig();
  await connectDatabase(config.MONGODB_URI);
  await ensureProviderCatalog();
  const app = createApp(config);
  const stopJobs = config.ENABLE_JOBS ? startJobs() : () => undefined;

  const server = app.listen(config.PORT, () => {
    logger.info(
      { port: config.PORT, env: config.APP_ENV, powens: config.powensConfigured ? 'configuré' : 'non configuré' },
      'API démarrée',
    );
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Arrêt en cours');
    stopJobs();
    server.close();
    await disconnectDatabase();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error) => {
  logger.fatal({ err: error }, 'Démarrage impossible');
  process.exit(1);
});
