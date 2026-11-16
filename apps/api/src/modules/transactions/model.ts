import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

/**
 * Transaction bancaire normalisée (débits uniquement, décision D2).
 * Déduplication : index unique (userId, source, externalId) + upsert.
 */
const transactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'BankAccount', required: true },
    source: { type: String, enum: ['powens', 'fixture'], required: true },
    externalId: { type: String, required: true },
    date: { type: String, required: true },
    amountCents: { type: Number, required: true },
    currency: { type: String, required: true },
    rawLabel: { type: String, required: true },
    simplifiedLabel: { type: String, default: null },
    counterpartyLabel: { type: String, default: null },
    bankType: { type: String, default: null },
    coming: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    remoteUpdatedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
transactionSchema.index({ userId: 1, source: 1, externalId: 1 }, { unique: true });
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ accountId: 1, date: -1 });

export type TransactionDoc = InferSchemaType<typeof transactionSchema> & { _id: Types.ObjectId };
export const TransactionModel = model('Transaction', transactionSchema);
