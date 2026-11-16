import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

/**
 * Candidat d'abonnement proposé à l'utilisateur.
 * Identité : (userId, accountId, merchantKey) + montant proche ; `signature` est indicative.
 * Un candidat rejeté ou écarté n'est jamais reproposé.
 */
const candidateSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'BankAccount', required: true },
    signature: { type: String, required: true },
    merchantKey: { type: String, required: true },
    label: { type: String, required: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider', default: null },
    currency: { type: String, required: true },
    transactionIds: { type: [Schema.Types.ObjectId], default: [] },
    occurrences: { type: Number, required: true },
    amount: {
      medianCents: { type: Number, required: true },
      minCents: { type: Number, required: true },
      maxCents: { type: Number, required: true },
      lastCents: { type: Number, required: true },
    },
    intervalDays: { type: Number, required: true },
    dayOfMonth: { type: Number, required: true },
    firstDate: { type: String, required: true },
    lastDate: { type: String, required: true },
    nextDueDate: { type: String, required: true },
    confidence: { type: Number, required: true },
    level: { type: String, enum: ['high', 'medium', 'low'], required: true },
    reasons: { type: [String], default: [] },
    stale: { type: Boolean, default: false },
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'dismissed'], default: 'pending' },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', default: null },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
candidateSchema.index({ userId: 1, status: 1 });
candidateSchema.index({ userId: 1, accountId: 1, merchantKey: 1 });

export type CandidateDoc = Omit<InferSchemaType<typeof candidateSchema>, 'amount'> & {
  amount: { medianCents: number; minCents: number; maxCents: number; lastCents: number };
  _id: Types.ObjectId;
  updatedAt: Date;
};
export const CandidateModel = model('Candidate', candidateSchema);
