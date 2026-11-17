import { Types } from 'mongoose';
import {
  todayIso,
  type AcceptCandidateBody,
  type Candidate,
  type CandidateStatus,
  type DetectionRunResponse,
  type SubscriptionDetail,
} from '@subtracker/contracts';
import { detectSubscriptions, type DetectionCandidate, type EngineTransaction } from '@subtracker/detection';
import { conflict, notFound } from '../../core/errors';
import { BankAccountModel, type BankAccountDoc } from '../bank/models';
import { ProviderModel, type ProviderDoc } from '../providers/model';
import { getProviderPatterns, toProviderSummary } from '../providers/service';
import { TransactionModel, type TransactionDoc } from '../transactions/model';
import { SubscriptionModel, type SubscriptionDoc } from '../subscriptions/models';
import { assertProvider, attachTransaction, eventsPush, getSubscription } from '../subscriptions/service';
import { CandidateModel, type CandidateDoc } from './model';

/** Tolère une hausse de prix (25 %, au moins 1 €) sans ouvrir une nouvelle série. */
function isSameAmountSeries(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(0.25 * Math.max(a, b), 100);
}

function toEngineTransaction(tx: TransactionDoc): EngineTransaction {
  return {
    id: tx._id.toString(),
    accountId: tx.accountId.toString(),
    date: tx.date,
    amountCents: tx.amountCents,
    currency: tx.currency,
    label: tx.rawLabel,
    counterpartyLabel: tx.counterpartyLabel ?? null,
    kind: tx.bankType ?? null,
    pending: tx.coming,
    deleted: Boolean(tx.deletedAt),
  };
}

function candidateFields(result: DetectionCandidate) {
  return {
    signature: result.signature,
    merchantKey: result.merchantKey,
    label: result.label,
    providerId: result.providerId ? new Types.ObjectId(result.providerId) : null,
    currency: result.currency,
    transactionIds: result.transactionIds.map((id) => new Types.ObjectId(id)),
    occurrences: result.occurrences,
    amount: result.amount,
    intervalDays: result.intervalDays,
    dayOfMonth: result.dayOfMonth,
    firstDate: result.firstDate,
    lastDate: result.lastDate,
    nextDueDate: result.nextDueDate,
    confidence: result.confidence,
    level: result.level,
    reasons: result.reasons,
    stale: result.stale,
  };
}

/** Rattache les nouveaux paiements de la série ; les champs `declared` de l'abonnement ne sont jamais réécrits. */
async function absorbIntoSubscription(
  userId: string,
  subscription: SubscriptionDoc,
  result: DetectionCandidate,
  transactions: Map<string, TransactionDoc>,
): Promise<number> {
  let attached = 0;
  for (const id of result.transactionIds) {
    const tx = transactions.get(id);
    if (tx && (await attachTransaction(userId, subscription._id, tx, 'system'))) attached += 1;
  }
  const now = new Date();
  const set: Record<string, unknown> = {};
  if (subscription.amount.origin !== 'declared' && subscription.amount.cents !== result.amount.lastCents) {
    set.amount = { cents: result.amount.lastCents, currency: result.currency, origin: 'observed', updatedAt: now };
  }
  if (subscription.billingDay?.origin !== 'declared' && subscription.billingDay?.value !== result.dayOfMonth) {
    set.billingDay = { value: result.dayOfMonth, origin: 'observed', updatedAt: now };
  }
  const events = [];
  if (attached > 0) events.push({ actor: 'system' as const, type: 'bank_payments_attached', to: attached });
  if (set.amount) {
    events.push({
      actor: 'system' as const,
      type: 'updated',
      field: 'amount',
      from: subscription.amount.cents,
      to: result.amount.lastCents,
    });
  }
  if (Object.keys(set).length || events.length) {
    await SubscriptionModel.updateOne(
      { _id: subscription._id, userId },
      { ...(Object.keys(set).length ? { $set: set } : {}), ...(events.length ? eventsPush(events) : {}) },
    );
  }
  return attached;
}

/**
 * Idempotent :
 * - série d'un abonnement suivi → nouveaux paiements rattachés, montant/jour mis à jour sauf champs déclarés ;
 * - candidat rejeté ou écarté → jamais reproposé ;
 * - nouvelle série → candidat `pending`.
 */
export async function runDetection(userId: string, today = todayIso()): Promise<DetectionRunResponse> {
  const accounts = await BankAccountModel.find({ userId, analyzed: true }, { _id: 1 }).lean<BankAccountDoc[]>();
  const accountIds = accounts.map((account) => account._id);
  const txDocs = await TransactionModel.find({ userId, accountId: { $in: accountIds }, deletedAt: null }).lean<
    TransactionDoc[]
  >();
  const transactions = new Map(txDocs.map((tx) => [tx._id.toString(), tx]));
  const results = detectSubscriptions(txDocs.map(toEngineTransaction), await getProviderPatterns(), { today });

  const [candidates, subscriptions] = await Promise.all([
    CandidateModel.find({ userId }).lean<CandidateDoc[]>(),
    SubscriptionModel.find({ userId, detection: { $ne: null }, status: { $ne: 'archived' } }).lean<SubscriptionDoc[]>(),
  ]);

  let created = 0;
  let updated = 0;
  let attachedPayments = 0;

  for (const result of results) {
    const subscription = subscriptions.find(
      (sub) =>
        sub.detection?.accountId.toString() === result.accountId &&
        sub.detection.merchantKey === result.merchantKey &&
        (isSameAmountSeries(sub.amount.cents, result.amount.lastCents) ||
          isSameAmountSeries(sub.amount.cents, result.amount.medianCents)),
    );
    if (subscription) {
      attachedPayments += await absorbIntoSubscription(userId, subscription, result, transactions);
      if (subscription.detection?.candidateId) {
        await CandidateModel.updateOne(
          { _id: subscription.detection.candidateId, userId },
          { $set: candidateFields(result) },
        );
      }
      continue;
    }

    const existing = candidates.find(
      (candidate) =>
        candidate.accountId.toString() === result.accountId &&
        candidate.merchantKey === result.merchantKey &&
        isSameAmountSeries(candidate.amount.medianCents, result.amount.medianCents),
    );
    if (existing) {
      if (existing.status === 'pending') {
        await CandidateModel.updateOne({ _id: existing._id, userId }, { $set: candidateFields(result) });
        updated += 1;
      }
      continue;
    }

    const doc = await CandidateModel.create({
      userId,
      accountId: new Types.ObjectId(result.accountId),
      ...candidateFields(result),
    });
    candidates.push(doc.toObject() as CandidateDoc);
    created += 1;
  }

  const pending = await CandidateModel.countDocuments({ userId, status: 'pending' });
  return { analyzedTransactions: txDocs.length, created, updated, attachedPayments, pending };
}

async function toCandidateDtos(userId: string, docs: CandidateDoc[]): Promise<Candidate[]> {
  const providerIds = [...new Set(docs.map((doc) => doc.providerId?.toString()).filter(Boolean))] as string[];
  const [providers, manualSubscriptions] = await Promise.all([
    ProviderModel.find({ _id: { $in: providerIds } }, { slug: 1, name: 1, category: 1 }).lean<ProviderDoc[]>(),
    providerIds.length
      ? SubscriptionModel.find(
          {
            userId,
            detection: null,
            providerId: { $in: providerIds },
            status: { $in: ['active', 'cancellation_pending'] },
          },
          { providerId: 1 },
        ).lean<SubscriptionDoc[]>()
      : Promise.resolve([] as SubscriptionDoc[]),
  ]);
  const providerById = new Map(providers.map((doc) => [doc._id.toString(), toProviderSummary(doc)]));
  return docs.map((doc) => {
    const providerId = doc.providerId?.toString() ?? null;
    const mergeSuggestion =
      doc.status === 'pending' && providerId
        ? manualSubscriptions.find((sub) => sub.providerId?.toString() === providerId)
        : undefined;
    return {
      id: doc._id.toString(),
      label: doc.label,
      merchantKey: doc.merchantKey,
      provider: providerId ? (providerById.get(providerId) ?? null) : null,
      accountId: doc.accountId.toString(),
      currency: doc.currency,
      occurrences: doc.occurrences,
      amount: doc.amount,
      intervalDays: doc.intervalDays,
      dayOfMonth: doc.dayOfMonth,
      firstDate: doc.firstDate,
      lastDate: doc.lastDate,
      nextDueDate: doc.nextDueDate,
      confidence: doc.confidence,
      level: doc.level,
      reasons: doc.reasons,
      stale: doc.stale,
      status: doc.status,
      transactionIds: doc.transactionIds.map((id) => id.toString()),
      subscriptionId: doc.subscriptionId?.toString() ?? null,
      suggestedSubscriptionId: mergeSuggestion?._id.toString() ?? null,
      updatedAt: doc.updatedAt.toISOString(),
    };
  });
}

export async function listCandidates(userId: string, status: CandidateStatus): Promise<Candidate[]> {
  const docs = await CandidateModel.find({ userId, status }).sort({ confidence: -1, label: 1 }).lean<CandidateDoc[]>();
  return toCandidateDtos(userId, docs);
}

async function findPendingCandidate(userId: string, id: string): Promise<CandidateDoc> {
  if (!Types.ObjectId.isValid(id)) throw notFound('Candidat');
  const doc = await CandidateModel.findOne({ _id: id, userId }).lean<CandidateDoc>();
  if (!doc) throw notFound('Candidat');
  if (doc.status !== 'pending') throw conflict('candidate_already_decided', 'Ce candidat a déjà été traité');
  return doc;
}

export async function acceptCandidate(
  userId: string,
  id: string,
  body: AcceptCandidateBody,
): Promise<SubscriptionDetail> {
  const candidate = await findPendingCandidate(userId, id);
  const now = new Date();
  const detection = { accountId: candidate.accountId, merchantKey: candidate.merchantKey, candidateId: candidate._id };
  let subscriptionId: Types.ObjectId;

  if (body.mergeIntoSubscriptionId) {
    const target = await SubscriptionModel.findOne({
      _id: body.mergeIntoSubscriptionId,
      userId,
    }).lean<SubscriptionDoc>();
    if (!target) throw notFound('Abonnement');
    if (target.detection) throw conflict('already_bank_linked', 'Cet abonnement est déjà lié à une détection bancaire');
    const set: Record<string, unknown> = { detection };
    if (target.amount.origin !== 'declared') {
      set.amount = {
        cents: candidate.amount.lastCents,
        currency: candidate.currency,
        origin: 'observed',
        updatedAt: now,
      };
    }
    if (!target.billingDay || target.billingDay.origin !== 'declared') {
      set.billingDay = { value: candidate.dayOfMonth, origin: 'observed', updatedAt: now };
    }
    await SubscriptionModel.updateOne(
      { _id: target._id, userId },
      { $set: set, ...eventsPush([{ actor: 'user', type: 'bank_detection_merged', to: candidate.label }]) },
    );
    subscriptionId = target._id;
  } else {
    await assertProvider(body.providerId);
    const providerId = body.providerId !== undefined ? body.providerId : candidate.providerId;
    const created = await SubscriptionModel.create({
      userId,
      origin: 'detected',
      label: body.label ?? candidate.label,
      providerId: providerId ?? null,
      customProviderName: providerId ? null : (body.customProviderName ?? null),
      amount: {
        cents: body.amountCents ?? candidate.amount.lastCents,
        currency: candidate.currency,
        origin: body.amountCents !== undefined ? 'declared' : 'observed',
        updatedAt: now,
      },
      billingDay: {
        value: body.billingDay ?? candidate.dayOfMonth,
        origin: body.billingDay !== undefined ? 'declared' : 'observed',
        updatedAt: now,
      },
      detection,
      events: [{ at: now, actor: 'user', type: 'created_from_detection', field: null, to: candidate.label }],
    });
    subscriptionId = created._id;
  }

  const txs = await TransactionModel.find({ userId, _id: { $in: candidate.transactionIds }, deletedAt: null }).lean<
    TransactionDoc[]
  >();
  for (const tx of txs) await attachTransaction(userId, subscriptionId, tx, 'system');

  await CandidateModel.updateOne(
    { _id: candidate._id, userId },
    { $set: { status: 'accepted', subscriptionId, decidedAt: now } },
  );
  return getSubscription(userId, subscriptionId.toString());
}

export async function rejectCandidate(userId: string, id: string): Promise<void> {
  const candidate = await findPendingCandidate(userId, id);
  await CandidateModel.updateOne(
    { _id: candidate._id, userId },
    { $set: { status: 'rejected', decidedAt: new Date() } },
  );
}
