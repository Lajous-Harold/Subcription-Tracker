import { z } from 'zod';
import { DetectionRunResponseSchema, todayIso } from '@subtracker/contracts';
import { generateFixtureTransactions } from '@subtracker/detection';
import { createModule } from '../../core/http';
import { BankAccountModel } from '../bank/models';
import { runDetection } from '../detection/service';
import { CandidateModel } from '../detection/model';
import { PaymentModel } from '../subscriptions/models';
import { TransactionModel } from '../transactions/model';

/**
 * Routes de développement : chargent un jeu de transactions fictives pour démontrer
 * la détection sans banque. Absentes en production (ENABLE_DEV_ROUTES).
 */
export const devModule = createModule('/dev', 'Développement');

const FIXTURE_ACCOUNT_ID = 'demo';

devModule.route({
  method: 'post',
  path: '/fixtures',
  summary: 'Charger des transactions de démonstration et lancer la détection',
  description:
    'Crée un « Compte de démonstration » et importe les débits fictifs (idempotent). Désactivé en production.',
  status: 200,
  response: z.object({ imported: z.number().int(), detection: DetectionRunResponseSchema }),
  handler: async ({ userId }) => {
    const account = await BankAccountModel.findOneAndUpdate(
      { userId, source: 'fixture', externalId: FIXTURE_ACCOUNT_ID },
      {
        $setOnInsert: {
          name: 'Compte de démonstration',
          type: 'checking',
          currency: 'EUR',
          analyzed: true,
          sharedWithApp: true,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    const debits = generateFixtureTransactions(todayIso(), account._id.toString()).filter((tx) => tx.amountCents < 0);
    await TransactionModel.bulkWrite(
      debits.map((tx) => ({
        updateOne: {
          filter: { userId, source: 'fixture', externalId: tx.id },
          update: {
            $set: {
              accountId: account._id,
              date: tx.date,
              amountCents: tx.amountCents,
              currency: tx.currency,
              rawLabel: tx.label,
              bankType: tx.kind,
              coming: tx.pending,
              deletedAt: null,
            },
          },
          upsert: true,
        },
      })),
    );
    return { imported: debits.length, detection: await runDetection(userId) };
  },
});

devModule.route({
  method: 'delete',
  path: '/fixtures',
  summary: 'Retirer les données de démonstration',
  status: 204,
  handler: async ({ userId }) => {
    const account = await BankAccountModel.findOne({
      userId,
      source: 'fixture',
      externalId: FIXTURE_ACCOUNT_ID,
    }).lean();
    if (!account) return;
    const txIds = (await TransactionModel.find({ userId, accountId: account._id }, { _id: 1 }).lean()).map(
      (tx) => tx._id,
    );
    await PaymentModel.updateMany({ userId, transactionId: { $in: txIds } }, { $set: { transactionId: null } });
    await TransactionModel.deleteMany({ userId, accountId: account._id });
    await CandidateModel.deleteMany({
      userId,
      accountId: account._id,
      status: { $in: ['pending', 'rejected', 'dismissed'] },
    });
    await BankAccountModel.deleteOne({ _id: account._id });
  },
});
