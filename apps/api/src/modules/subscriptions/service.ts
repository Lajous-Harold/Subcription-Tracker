import { Types } from 'mongoose';
import {
  todayIso,
  type CreatePaymentBody,
  type CreateSubscriptionBody,
  type Payment,
  type ProviderSummary,
  type ResettableField,
  type Subscription,
  type SubscriptionDetail,
  type SubscriptionStatus,
  type UpdateSubscriptionBody,
  type UpsertCancellationBody,
} from '@subtracker/contracts';
import { badRequest, conflict, notFound } from '../../core/errors';
import { ProviderModel, type ProviderDoc } from '../providers/model';
import { toProviderSummary } from '../providers/service';
import { TransactionModel, type TransactionDoc } from '../transactions/model';
import { CandidateModel } from '../detection/model';
import { PaymentModel, SubscriptionModel, type PaymentDoc, type SubscriptionDoc } from './models';
import { toPaymentDto, toSubscriptionDetailDto, toSubscriptionDto, type PaymentStats } from './mapper';

const MAX_EVENTS = 50;

interface SubscriptionEventInput {
  actor: 'user' | 'system';
  type: string;
  field?: string | null;
  from?: unknown;
  to?: unknown;
}

export function eventsPush(events: SubscriptionEventInput[]) {
  return {
    $push: {
      events: {
        $each: events.map((event) => ({ at: new Date(), field: null, ...event })),
        $slice: -MAX_EVENTS,
      },
    },
  };
}

async function findOwned(userId: string, id: string): Promise<SubscriptionDoc> {
  if (!Types.ObjectId.isValid(id)) throw notFound('Abonnement');
  const doc = await SubscriptionModel.findOne({ _id: id, userId }).lean<SubscriptionDoc>();
  if (!doc) throw notFound('Abonnement');
  return doc;
}

async function providerSummaries(ids: (Types.ObjectId | null | undefined)[]): Promise<Map<string, ProviderSummary>> {
  const unique = [...new Set(ids.filter(Boolean).map((id) => id!.toString()))];
  if (unique.length === 0) return new Map();
  const docs = await ProviderModel.find({ _id: { $in: unique } }, { slug: 1, name: 1, category: 1 }).lean<
    ProviderDoc[]
  >();
  return new Map(docs.map((doc) => [doc._id.toString(), toProviderSummary(doc)]));
}

async function paymentStats(userId: string, subscriptionIds: Types.ObjectId[]): Promise<Map<string, PaymentStats>> {
  if (subscriptionIds.length === 0) return new Map();
  const rows = await PaymentModel.aggregate<{ _id: Types.ObjectId; lastPaymentDate: string }>([
    { $match: { userId: new Types.ObjectId(userId), subscriptionId: { $in: subscriptionIds } } },
    { $group: { _id: '$subscriptionId', lastPaymentDate: { $max: '$date' } } },
  ]);
  return new Map(rows.map((row) => [row._id.toString(), { lastPaymentDate: row.lastPaymentDate }]));
}

export async function toDtos(userId: string, docs: SubscriptionDoc[], today = todayIso()): Promise<Subscription[]> {
  const [providers, stats] = await Promise.all([
    providerSummaries(docs.map((doc) => doc.providerId)),
    paymentStats(
      userId,
      docs.map((doc) => doc._id),
    ),
  ]);
  return docs.map((doc) =>
    toSubscriptionDto(
      doc,
      doc.providerId ? (providers.get(doc.providerId.toString()) ?? null) : null,
      stats.get(doc._id.toString()) ?? { lastPaymentDate: null },
      today,
    ),
  );
}

export async function listSubscriptions(userId: string, status?: SubscriptionStatus): Promise<Subscription[]> {
  const docs = await SubscriptionModel.find({ userId, ...(status ? { status } : {}) })
    .sort({ status: 1, label: 1 })
    .lean<SubscriptionDoc[]>();
  return toDtos(userId, docs);
}

export async function getSubscription(userId: string, id: string): Promise<SubscriptionDetail> {
  const doc = await findOwned(userId, id);
  const [providers, stats] = await Promise.all([providerSummaries([doc.providerId]), paymentStats(userId, [doc._id])]);
  return toSubscriptionDetailDto(
    doc,
    doc.providerId ? (providers.get(doc.providerId.toString()) ?? null) : null,
    stats.get(doc._id.toString()) ?? { lastPaymentDate: null },
  );
}

export async function assertProvider(providerId: string | null | undefined): Promise<void> {
  if (!providerId) return;
  if (!(await ProviderModel.exists({ _id: providerId }))) {
    throw badRequest('UNKNOWN_PROVIDER', 'Fournisseur inconnu');
  }
}

export async function createSubscription(userId: string, body: CreateSubscriptionBody): Promise<SubscriptionDetail> {
  await assertProvider(body.providerId);
  const now = new Date();
  const doc = await SubscriptionModel.create({
    userId,
    origin: 'manual',
    label: body.label,
    providerId: body.providerId ?? null,
    customProviderName: body.providerId ? null : (body.customProviderName ?? null),
    amount: { cents: body.amountCents, currency: body.currency, origin: 'declared', updatedAt: now },
    billingDay: body.billingDay ? { value: body.billingDay, origin: 'declared', updatedAt: now } : null,
    nextDueDateDeclared: body.nextDueDate ? { value: body.nextDueDate, updatedAt: now } : null,
    notes: body.notes ?? null,
    events: [{ at: now, actor: 'user', type: 'created', field: null }],
  });
  return getSubscription(userId, doc._id.toString());
}

/** Toute modification utilisateur passe le champ en `declared`. */
export async function updateSubscription(
  userId: string,
  id: string,
  body: UpdateSubscriptionBody,
): Promise<SubscriptionDetail> {
  const current = await findOwned(userId, id);
  const now = new Date();
  const set: Record<string, unknown> = {};
  const events: SubscriptionEventInput[] = [];
  const recordChange = (field: string, from: unknown, to: unknown) => {
    if (JSON.stringify(from) !== JSON.stringify(to)) events.push({ actor: 'user', type: 'updated', field, from, to });
  };

  if (body.label !== undefined) {
    set.label = body.label;
    recordChange('label', current.label, body.label);
  }
  if (body.providerId !== undefined) {
    await assertProvider(body.providerId);
    set.providerId = body.providerId;
    if (body.providerId) set.customProviderName = null;
    recordChange('provider', current.providerId?.toString() ?? null, body.providerId);
  }
  if (body.customProviderName !== undefined) {
    set.customProviderName = body.customProviderName;
    if (body.customProviderName) set.providerId = null;
    recordChange('customProviderName', current.customProviderName ?? null, body.customProviderName);
  }
  if (body.amountCents !== undefined || body.currency !== undefined) {
    const amount = {
      cents: body.amountCents ?? current.amount.cents,
      currency: body.currency ?? current.amount.currency,
      origin: 'declared',
      updatedAt: now,
    };
    set.amount = amount;
    recordChange(
      'amount',
      { cents: current.amount.cents, currency: current.amount.currency },
      { cents: amount.cents, currency: amount.currency },
    );
  }
  if (body.billingDay !== undefined) {
    set.billingDay = body.billingDay === null ? null : { value: body.billingDay, origin: 'declared', updatedAt: now };
    recordChange('billingDay', current.billingDay?.value ?? null, body.billingDay);
  }
  if (body.nextDueDate !== undefined) {
    set.nextDueDateDeclared = body.nextDueDate === null ? null : { value: body.nextDueDate, updatedAt: now };
    recordChange('nextDueDate', current.nextDueDateDeclared?.value ?? null, body.nextDueDate);
  }
  if (body.status !== undefined) {
    set.status = body.status;
    recordChange('status', current.status, body.status);
  }
  if (body.notes !== undefined) {
    set.notes = body.notes;
    recordChange('notes', current.notes ?? null, body.notes);
  }

  await SubscriptionModel.updateOne(
    { _id: current._id, userId },
    { $set: set, ...(events.length ? eventsPush(events) : {}) },
  );
  return getSubscription(userId, id);
}

/** La donnée observée ou estimée reprend la main sur la valeur déclarée. */
export async function resetField(userId: string, id: string, field: ResettableField): Promise<SubscriptionDetail> {
  const current = await findOwned(userId, id);
  const now = new Date();
  const set: Record<string, unknown> = {};
  const bankPayments = await PaymentModel.find({ userId, subscriptionId: current._id, source: 'bank' })
    .sort({ date: -1 })
    .lean<PaymentDoc[]>();

  if (field === 'amount') {
    const last = bankPayments[0];
    if (!last) throw conflict('NO_OBSERVED_DATA', 'Aucun paiement bancaire observé pour ce montant');
    set.amount = { cents: last.amountCents, currency: last.currency, origin: 'observed', updatedAt: now };
  } else if (field === 'billingDay') {
    if (bankPayments.length === 0) {
      set.billingDay = null;
    } else {
      const days = bankPayments.map((payment) => Number(payment.date.slice(8, 10))).sort((a, b) => a - b);
      const medianDay = days[Math.floor(days.length / 2)] ?? 1;
      set.billingDay = { value: medianDay, origin: 'observed', updatedAt: now };
    }
  } else {
    set.nextDueDateDeclared = null;
  }

  await SubscriptionModel.updateOne(
    { _id: current._id, userId },
    { $set: set, ...eventsPush([{ actor: 'user', type: 'field_reset', field }]) },
  );
  return getSubscription(userId, id);
}

/** Supprimer = ne plus suivre dans l'application. Ne résilie aucun contrat externe. */
export async function deleteSubscription(userId: string, id: string): Promise<void> {
  const current = await findOwned(userId, id);
  await PaymentModel.deleteMany({ userId, subscriptionId: current._id });
  if (current.detection?.candidateId) {
    await CandidateModel.updateOne(
      { _id: current.detection.candidateId, userId },
      { $set: { status: 'dismissed', subscriptionId: null } },
    );
  }
  await SubscriptionModel.deleteOne({ _id: current._id, userId });
}

export async function listPayments(userId: string, id: string): Promise<Payment[]> {
  const current = await findOwned(userId, id);
  const docs = await PaymentModel.find({ userId, subscriptionId: current._id }).sort({ date: -1 }).lean<PaymentDoc[]>();
  return docs.map(toPaymentDto);
}

export async function addManualPayment(userId: string, id: string, body: CreatePaymentBody): Promise<Payment> {
  const current = await findOwned(userId, id);
  const doc = await PaymentModel.create({
    userId,
    subscriptionId: current._id,
    source: 'manual',
    date: body.date,
    amountCents: body.amountCents,
    currency: body.currency,
    note: body.note ?? null,
  });
  await SubscriptionModel.updateOne(
    { _id: current._id, userId },
    eventsPush([{ actor: 'user', type: 'payment_added', to: { date: body.date, cents: body.amountCents } }]),
  );
  return toPaymentDto(doc.toObject() as PaymentDoc);
}

const DUPLICATE_WINDOW_DAYS = 3;

/** Paiement manuel de même montant à quelques jours près : signalé comme doublon possible, jamais fusionné d'office. */
async function findManualDuplicate(
  userId: string,
  subscriptionId: Types.ObjectId,
  date: string,
  amountCents: number,
): Promise<Types.ObjectId | null> {
  const windowMs = DUPLICATE_WINDOW_DAYS * 86_400_000;
  const center = new Date(`${date}T00:00:00Z`).getTime();
  const from = new Date(center - windowMs).toISOString().slice(0, 10);
  const to = new Date(center + windowMs).toISOString().slice(0, 10);
  const match = await PaymentModel.findOne(
    { userId, subscriptionId, source: 'manual', amountCents, date: { $gte: from, $lte: to } },
    { _id: 1 },
  ).lean<{ _id: Types.ObjectId }>();
  return match?._id ?? null;
}

/** Renvoie `null` si la transaction est déjà rattachée (index unique). */
export async function attachTransaction(
  userId: string,
  subscriptionId: Types.ObjectId,
  tx: Pick<TransactionDoc, '_id' | 'date' | 'amountCents' | 'currency'>,
  actor: 'user' | 'system',
): Promise<Payment | null> {
  const amountCents = Math.abs(tx.amountCents);
  try {
    const doc = await PaymentModel.create({
      userId,
      subscriptionId,
      source: 'bank',
      transactionId: tx._id,
      date: tx.date,
      amountCents,
      currency: tx.currency,
      possibleDuplicateOfId: await findManualDuplicate(userId, subscriptionId, tx.date, amountCents),
    });
    if (actor === 'user') {
      await SubscriptionModel.updateOne(
        { _id: subscriptionId, userId },
        eventsPush([{ actor, type: 'payment_linked', to: { date: tx.date, cents: amountCents } }]),
      );
    }
    return toPaymentDto(doc.toObject() as PaymentDoc);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return null;
    throw error;
  }
}

export async function linkTransaction(userId: string, id: string, transactionId: string): Promise<Payment> {
  const current = await findOwned(userId, id);
  const tx = await TransactionModel.findOne({ _id: transactionId, userId, deletedAt: null }).lean<TransactionDoc>();
  if (!tx) throw notFound('Transaction');
  const payment = await attachTransaction(userId, current._id, tx, 'user');
  if (!payment) throw conflict('TRANSACTION_ALREADY_LINKED', 'Cette transaction est déjà rattachée à un abonnement');
  return payment;
}

export async function deletePayment(userId: string, id: string, paymentId: string): Promise<void> {
  const current = await findOwned(userId, id);
  if (!Types.ObjectId.isValid(paymentId)) throw notFound('Paiement');
  const payment = await PaymentModel.findOneAndDelete({
    _id: paymentId,
    userId,
    subscriptionId: current._id,
  }).lean<PaymentDoc>();
  if (!payment) throw notFound('Paiement');
  await PaymentModel.updateMany(
    { userId, possibleDuplicateOfId: payment._id },
    { $set: { possibleDuplicateOfId: null } },
  );
  await SubscriptionModel.updateOne(
    { _id: current._id, userId },
    eventsPush([
      {
        actor: 'user',
        type: payment.source === 'bank' ? 'payment_unlinked' : 'payment_removed',
        from: { date: payment.date, cents: payment.amountCents },
      },
    ]),
  );
}

const STATUS_BY_CANCELLATION = {
  started: 'cancellation_pending',
  requested: 'cancellation_pending',
  confirmed: 'cancelled',
  abandoned: 'active',
} as const;

/** Suivi manuel de résiliation. Aucune action n'est envoyée au fournisseur. */
export async function upsertCancellation(
  userId: string,
  id: string,
  body: UpsertCancellationBody,
): Promise<SubscriptionDetail> {
  const current = await findOwned(userId, id);
  const previous = current.cancellation;
  const cancellation = {
    status: body.status,
    method: body.method !== undefined ? body.method : (previous?.method ?? null),
    startedAt: previous?.startedAt ?? new Date(),
    requestedAt:
      body.requestedAt !== undefined
        ? body.requestedAt
        : (previous?.requestedAt ?? (body.status === 'requested' ? todayIso() : null)),
    effectiveDate: body.effectiveDate !== undefined ? body.effectiveDate : (previous?.effectiveDate ?? null),
    reference: body.reference !== undefined ? body.reference : (previous?.reference ?? null),
    notes: body.notes !== undefined ? body.notes : (previous?.notes ?? null),
  };
  const status = STATUS_BY_CANCELLATION[body.status];
  await SubscriptionModel.updateOne(
    { _id: current._id, userId },
    {
      $set: { cancellation, status },
      ...eventsPush([
        {
          actor: 'user',
          type: 'cancellation_updated',
          field: 'cancellation',
          from: previous?.status ?? null,
          to: body.status,
        },
      ]),
    },
  );
  return getSubscription(userId, id);
}

export async function clearCancellation(userId: string, id: string): Promise<SubscriptionDetail> {
  const current = await findOwned(userId, id);
  await SubscriptionModel.updateOne(
    { _id: current._id, userId },
    {
      $set: { cancellation: null, status: 'active' },
      ...eventsPush([
        {
          actor: 'user',
          type: 'cancellation_cleared',
          field: 'cancellation',
          from: current.cancellation?.status ?? null,
        },
      ]),
    },
  );
  return getSubscription(userId, id);
}
