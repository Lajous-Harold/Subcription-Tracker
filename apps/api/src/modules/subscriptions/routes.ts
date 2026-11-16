import { z } from 'zod';
import {
  CreatePaymentBodySchema,
  CreateSubscriptionBodySchema,
  LinkPaymentBodySchema,
  PaymentListResponseSchema,
  PaymentSchema,
  ResettableFieldSchema,
  SubscriptionDetailSchema,
  SubscriptionListQuerySchema,
  SubscriptionListResponseSchema,
  UpdateSubscriptionBodySchema,
  UpsertCancellationBodySchema,
} from '@subtracker/contracts';
import { IdParamsSchema, createModule } from '../../core/http';
import * as service from './service';

export const subscriptionsModule = createModule('/subscriptions', 'Abonnements');
const { route } = subscriptionsModule;

route({
  method: 'get',
  path: '/',
  summary: 'Lister les abonnements',
  query: SubscriptionListQuerySchema,
  response: SubscriptionListResponseSchema,
  handler: async ({ userId, query }) => ({ items: await service.listSubscriptions(userId, query.status) }),
});

route({
  method: 'post',
  path: '/',
  summary: 'Déclarer un abonnement manuellement',
  description: 'Toutes les valeurs fournies sont marquées `declared`.',
  body: CreateSubscriptionBodySchema,
  response: SubscriptionDetailSchema,
  handler: ({ userId, body }) => service.createSubscription(userId, body),
});

route({
  method: 'get',
  path: '/:id',
  summary: 'Détail d’un abonnement (avec historique)',
  params: IdParamsSchema,
  response: SubscriptionDetailSchema,
  errors: [404],
  handler: ({ userId, params }) => service.getSubscription(userId, params.id),
});

route({
  method: 'patch',
  path: '/:id',
  summary: 'Corriger un abonnement',
  description: 'Chaque champ modifié devient `declared` et n’est plus réécrit par la détection.',
  params: IdParamsSchema,
  body: UpdateSubscriptionBodySchema,
  response: SubscriptionDetailSchema,
  errors: [404],
  handler: ({ userId, params, body }) => service.updateSubscription(userId, params.id, body),
});

route({
  method: 'delete',
  path: '/:id',
  summary: 'Ne plus suivre un abonnement',
  description: 'Supprime l’abonnement et ses paiements dans l’application. Ne résilie pas le contrat externe.',
  params: IdParamsSchema,
  status: 204,
  errors: [404],
  handler: ({ userId, params }) => service.deleteSubscription(userId, params.id),
});

route({
  method: 'post',
  path: '/:id/fields/:field/reset',
  summary: 'Remettre un champ en automatique',
  params: IdParamsSchema.extend({ field: ResettableFieldSchema }),
  status: 200,
  response: SubscriptionDetailSchema,
  errors: [404, 409],
  handler: ({ userId, params }) => service.resetField(userId, params.id, params.field),
});

route({
  method: 'get',
  path: '/:id/payments',
  summary: 'Historique des paiements (bancaires et manuels)',
  params: IdParamsSchema,
  response: PaymentListResponseSchema,
  errors: [404],
  handler: async ({ userId, params }) => ({ items: await service.listPayments(userId, params.id) }),
});

route({
  method: 'post',
  path: '/:id/payments',
  summary: 'Ajouter un paiement manuel',
  params: IdParamsSchema,
  body: CreatePaymentBodySchema,
  response: PaymentSchema,
  errors: [404],
  handler: ({ userId, params, body }) => service.addManualPayment(userId, params.id, body),
});

route({
  method: 'post',
  path: '/:id/payments/link',
  summary: 'Rattacher une transaction bancaire',
  params: IdParamsSchema,
  body: LinkPaymentBodySchema,
  response: PaymentSchema,
  errors: [404, 409],
  handler: ({ userId, params, body }) => service.linkTransaction(userId, params.id, body.transactionId),
});

route({
  method: 'delete',
  path: '/:id/payments/:paymentId',
  summary: 'Supprimer ou détacher un paiement',
  params: IdParamsSchema.extend({ paymentId: z.string() }),
  status: 204,
  errors: [404],
  handler: ({ userId, params }) => service.deletePayment(userId, params.id, params.paymentId),
});

route({
  method: 'put',
  path: '/:id/cancellation',
  summary: 'Suivre une résiliation (manuel)',
  description:
    'started/requested → cancellation_pending ; confirmed → cancelled ; abandoned → active. Aucune action n’est envoyée au fournisseur.',
  params: IdParamsSchema,
  body: UpsertCancellationBodySchema,
  response: SubscriptionDetailSchema,
  errors: [404],
  handler: ({ userId, params, body }) => service.upsertCancellation(userId, params.id, body),
});

route({
  method: 'delete',
  path: '/:id/cancellation',
  summary: 'Effacer le suivi de résiliation',
  params: IdParamsSchema,
  status: 200,
  response: SubscriptionDetailSchema,
  errors: [404],
  handler: ({ userId, params }) => service.clearCancellation(userId, params.id),
});
