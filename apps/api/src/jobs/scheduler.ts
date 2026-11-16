import { getConfig } from '../core/context';
import { logger } from '../core/logger';
import { retryPowensCleanups } from '../modules/bank/service';
import { PaymentModel } from '../modules/subscriptions/models';
import { TransactionModel } from '../modules/transactions/model';

/** Rétention (décision D4) : transactions et paiements plus anciens que N ans. */
export async function purgeExpiredData(now = new Date()): Promise<{ transactions: number; payments: number }> {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - getConfig().DATA_RETENTION_YEARS);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const [transactions, payments] = await Promise.all([
    TransactionModel.deleteMany({ date: { $lt: cutoffDate } }),
    PaymentModel.deleteMany({ date: { $lt: cutoffDate } }),
  ]);
  return { transactions: transactions.deletedCount, payments: payments.deletedCount };
}

/**
 * Tâches périodiques en mémoire (une seule instance d'API au MVP) :
 * purge de rétention quotidienne, nouvel essai des suppressions Powens toutes les heures.
 */
export function startJobs(): () => void {
  const run = (name: string, task: () => Promise<unknown>) => () => {
    task()
      .then((result) => logger.info({ job: name, result }, 'Tâche périodique terminée'))
      .catch((error) => logger.error({ err: error, job: name }, 'Tâche périodique en échec'));
  };
  const purge = run('retention', () => purgeExpiredData());
  const cleanup = run('powens-cleanup', async () => (getConfig().powensConfigured ? retryPowensCleanups() : 0));
  const timers = [setInterval(purge, 24 * 3600 * 1000), setInterval(cleanup, 3600 * 1000)];
  setTimeout(purge, 60_000).unref();
  timers.forEach((timer) => timer.unref());
  return () => timers.forEach((timer) => clearInterval(timer));
}
