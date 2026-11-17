import { getConfig } from '../core/context';
import { logger } from '../core/logger';
import { retryPowensCleanups } from '../modules/bank/service';
import { retentionCutoff } from '../modules/bank/sync';
import { PaymentModel } from '../modules/subscriptions/models';
import { TransactionModel } from '../modules/transactions/model';

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;
const FIRST_PURGE_DELAY_MS = 60_000;

/** Rétention : décision D4. */
export async function purgeExpiredData(now = new Date()): Promise<{ transactions: number; payments: number }> {
  const cutoffDate = retentionCutoff(now);
  const [transactions, payments] = await Promise.all([
    TransactionModel.deleteMany({ date: { $lt: cutoffDate } }),
    PaymentModel.deleteMany({ date: { $lt: cutoffDate } }),
  ]);
  return { transactions: transactions.deletedCount, payments: payments.deletedCount };
}

/** Minuteries en mémoire : suffisant tant que l'API tourne en une seule instance (MVP). */
export function startJobs(): () => void {
  const loggedJob = (name: string, task: () => Promise<unknown>) => () => {
    task()
      .then((result) => logger.info({ job: name, result }, 'Tâche périodique terminée'))
      .catch((error) => logger.error({ err: error, job: name }, 'Tâche périodique en échec'));
  };
  const purge = loggedJob('retention', () => purgeExpiredData());
  const cleanup = loggedJob('powens-cleanup', async () => (getConfig().powensConfigured ? retryPowensCleanups() : 0));
  const timers = [setInterval(purge, DAY_MS), setInterval(cleanup, HOUR_MS)];
  setTimeout(purge, FIRST_PURGE_DELAY_MS).unref();
  timers.forEach((timer) => timer.unref());
  return () => timers.forEach((timer) => clearInterval(timer));
}
