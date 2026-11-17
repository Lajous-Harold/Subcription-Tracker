import { Types } from 'mongoose';
import { TransactionListQuerySchema, TransactionListResponseSchema, type Transaction } from '@subtracker/contracts';
import { createModule } from '../../core/http';
import { badRequest } from '../../core/errors';
import { PaymentModel } from '../subscriptions/models';
import { TransactionModel, type TransactionDoc } from './model';

export const transactionsModule = createModule('/transactions', 'Transactions');

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function encodeCursor(tx: Pick<TransactionDoc, 'date' | '_id'>): string {
  return Buffer.from(`${tx.date}|${tx._id.toString()}`).toString('base64url');
}

function decodeCursor(cursor: string): { date: string; id: string } {
  const [date, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  if (!date || !id || !Types.ObjectId.isValid(id)) throw badRequest('invalid_cursor', 'Curseur invalide');
  return { date, id };
}

transactionsModule.route({
  method: 'get',
  path: '/',
  summary: 'Transactions importées (lecture seule)',
  description: 'Débits uniquement. Sert à rattacher manuellement un paiement bancaire à un abonnement.',
  query: TransactionListQuerySchema,
  response: TransactionListResponseSchema,
  handler: async ({ userId, query }) => {
    const filter: Record<string, unknown> = { userId, deletedAt: null };
    if (query.accountId) filter.accountId = query.accountId;
    if (query.from || query.to) {
      filter.date = { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lte: query.to } : {}) };
    }
    if (query.q) filter.rawLabel = { $regex: escapeRegex(query.q), $options: 'i' };
    if (query.cursor) {
      const { date, id } = decodeCursor(query.cursor);
      filter.$or = [{ date: { $lt: date } }, { date, _id: { $lt: new Types.ObjectId(id) } }];
    }
    const docs = await TransactionModel.find(filter)
      .sort({ date: -1, _id: -1 })
      .limit(query.limit + 1)
      .lean<TransactionDoc[]>();
    const page = docs.slice(0, query.limit);
    const linkedPayments = await PaymentModel.find(
      { userId, transactionId: { $in: page.map((tx) => tx._id) } },
      { transactionId: 1, subscriptionId: 1 },
    ).lean();
    const subscriptionIdByTransactionId = new Map(
      linkedPayments.map((payment) => [payment.transactionId?.toString(), payment.subscriptionId.toString()]),
    );
    const last = page[page.length - 1];
    const items: Transaction[] = page.map((tx) => ({
      id: tx._id.toString(),
      accountId: tx.accountId.toString(),
      source: tx.source,
      date: tx.date,
      amountCents: tx.amountCents,
      currency: tx.currency,
      label: tx.rawLabel,
      counterpartyLabel: tx.counterpartyLabel ?? null,
      bankType: tx.bankType ?? null,
      coming: tx.coming,
      subscriptionId: subscriptionIdByTransactionId.get(tx._id.toString()) ?? null,
    }));
    return { items, nextCursor: docs.length > query.limit && last ? encodeCursor(last) : null };
  },
});
