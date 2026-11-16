import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

const ORIGINS = ['observed', 'declared', 'estimated'] as const;

const eventSchema = new Schema(
  {
    at: { type: Date, required: true },
    actor: { type: String, enum: ['user', 'system'], required: true },
    type: { type: String, required: true },
    field: { type: String, default: null },
    from: { type: Schema.Types.Mixed },
    to: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const cancellationSchema = new Schema(
  {
    status: { type: String, enum: ['started', 'requested', 'confirmed', 'abandoned'], required: true },
    method: { type: String, default: null },
    startedAt: { type: Date, required: true },
    requestedAt: { type: String, default: null },
    effectiveDate: { type: String, default: null },
    reference: { type: String, default: null },
    notes: { type: String, default: null },
  },
  { _id: false },
);

const subscriptionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    origin: { type: String, enum: ['detected', 'manual'], required: true },
    label: { type: String, required: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider', default: null },
    customProviderName: { type: String, default: null },
    /** Montant avec sa provenance : `declared` n'est jamais réécrit par le système. */
    amount: {
      cents: { type: Number, required: true },
      currency: { type: String, required: true },
      origin: { type: String, enum: ORIGINS, required: true },
      updatedAt: { type: Date, required: true },
    },
    cadence: { type: String, enum: ['monthly'], default: 'monthly' },
    billingDay: {
      type: new Schema(
        {
          value: { type: Number, required: true },
          origin: { type: String, enum: ORIGINS, required: true },
          updatedAt: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    /** Échéance fixée par l'utilisateur (sinon calculée à la lecture). */
    nextDueDateDeclared: {
      type: new Schema(
        { value: { type: String, required: true }, updatedAt: { type: Date, required: true } },
        { _id: false },
      ),
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'cancellation_pending', 'cancelled', 'archived'],
      default: 'active',
    },
    cancellation: { type: cancellationSchema, default: null },
    notes: { type: String, default: null },
    /** Lien avec la détection bancaire. */
    detection: {
      type: new Schema(
        {
          accountId: { type: Schema.Types.ObjectId, required: true },
          merchantKey: { type: String, required: true },
          candidateId: { type: Schema.Types.ObjectId, default: null },
        },
        { _id: false },
      ),
      default: null,
    },
    events: { type: [eventSchema], default: [] },
  },
  { timestamps: true },
);
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ userId: 1, 'detection.accountId': 1, 'detection.merchantKey': 1 });

export type SubscriptionDoc = Omit<InferSchemaType<typeof subscriptionSchema>, 'amount'> & {
  amount: { cents: number; currency: string; origin: (typeof ORIGINS)[number]; updatedAt: Date };
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export const SubscriptionModel = model('Subscription', subscriptionSchema);

const paymentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true },
    source: { type: String, enum: ['bank', 'manual'], required: true },
    transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', default: null },
    date: { type: String, required: true },
    amountCents: { type: Number, required: true },
    currency: { type: String, required: true },
    note: { type: String, default: null },
    possibleDuplicateOfId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);
paymentSchema.index({ subscriptionId: 1, date: -1 });
// Une transaction bancaire n'est rattachée qu'à un seul abonnement.
paymentSchema.index(
  { userId: 1, transactionId: 1 },
  { unique: true, partialFilterExpression: { transactionId: { $type: 'objectId' } } },
);
paymentSchema.index({ userId: 1, date: 1 });

export type PaymentDoc = InferSchemaType<typeof paymentSchema> & { _id: Types.ObjectId; createdAt: Date };
export const PaymentModel = model('Payment', paymentSchema);
