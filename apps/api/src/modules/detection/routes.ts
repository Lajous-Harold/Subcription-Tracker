import {
  AcceptCandidateBodySchema,
  CandidateListQuerySchema,
  CandidateListResponseSchema,
  DetectionRunResponseSchema,
  SubscriptionDetailSchema,
} from '@subtracker/contracts';
import { IdParamsSchema, createModule } from '../../core/http';
import * as service from './service';

export const detectionModule = createModule('/detection', 'Détection');
const { route } = detectionModule;

route({
  method: 'post',
  path: '/run',
  summary: 'Relancer la détection sur les comptes analysés',
  status: 200,
  response: DetectionRunResponseSchema,
  handler: ({ userId }) => service.runDetection(userId),
});

route({
  method: 'get',
  path: '/candidates',
  summary: 'Lister les abonnements détectés à revoir',
  query: CandidateListQuerySchema,
  response: CandidateListResponseSchema,
  handler: async ({ userId, query }) => ({ items: await service.listCandidates(userId, query.status) }),
});

route({
  method: 'post',
  path: '/candidates/:id/accept',
  summary: 'Confirmer un candidat (avec corrections éventuelles)',
  description:
    'Les champs fournis deviennent `declared`. `mergeIntoSubscriptionId` rattache à un abonnement manuel existant.',
  params: IdParamsSchema,
  body: AcceptCandidateBodySchema,
  response: SubscriptionDetailSchema,
  errors: [404, 409],
  handler: ({ userId, params, body }) => service.acceptCandidate(userId, params.id, body),
});

route({
  method: 'post',
  path: '/candidates/:id/reject',
  summary: 'Rejeter un candidat (il ne sera plus proposé)',
  params: IdParamsSchema,
  status: 204,
  errors: [404, 409],
  handler: ({ userId, params }) => service.rejectCandidate(userId, params.id),
});
