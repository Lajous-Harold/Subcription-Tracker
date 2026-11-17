import {
  BankAccountListResponseSchema,
  BankAccountSchema,
  BankLinkResponseSchema,
  BankLinkSchema,
  CompleteConnectSessionBodySchema,
  ConnectSessionResponseSchema,
  CreateConnectSessionBodySchema,
  UpdateBankAccountBodySchema,
} from '@subtracker/contracts';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { getConfig } from '../../core/context';
import { tooManyRequests } from '../../core/errors';
import { IdParamsSchema, createModule } from '../../core/http';
import { BankLinkModel, type BankLinkDoc } from './models';
import * as service from './service';
import { nudgePendingSync, requestBankRefresh } from './sync';

export const bankModule = createModule('/bank', 'Banque');
const { route } = bankModule;

const connectLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => getConfig().APP_ENV === 'test',
  keyGenerator: (req) => req.auth?.userId ?? ipKeyGenerator(req.ip ?? '0.0.0.0'),
  handler: (_req, _res, next) => next(tooManyRequests('Trop de demandes de connexion, réessayez plus tard')),
});

route({
  method: 'get',
  path: '/link',
  summary: 'État de la connexion bancaire',
  response: BankLinkResponseSchema,
  handler: async ({ userId }) => {
    const link = await BankLinkModel.findOne({ userId }).lean<BankLinkDoc>();
    if (link) await nudgePendingSync(link);
    return { link: link ? service.toBankLinkDto(link) : null };
  },
});

route({
  method: 'post',
  path: '/connect-sessions',
  summary: 'Ouvrir un parcours Powens (connect, reconnect, manage)',
  description:
    'Renvoie l’URL de la Webview Powens à ouvrir dans le navigateur système (natif) ou en pleine page (web). Les secrets Powens restent côté serveur.',
  body: CreateConnectSessionBodySchema,
  response: ConnectSessionResponseSchema,
  errors: [409, 429, 503],
  middlewares: [connectLimiter],
  handler: ({ userId, body }) => service.createConnectSession(userId, body),
});

route({
  method: 'post',
  path: '/connect-sessions/complete',
  summary: 'Finaliser le retour de la Webview',
  description: 'Transmettre `state` et `connection_id` (ou `error`) reçus sur l’URL de redirection.',
  status: 200,
  body: CompleteConnectSessionBodySchema,
  response: BankLinkSchema,
  errors: [404, 503],
  handler: ({ userId, body }) => service.completeConnectSession(userId, body),
});

route({
  method: 'post',
  path: '/sync',
  summary: 'Actualiser maintenant',
  description:
    'Demande une synchronisation à la banque (une SCA peut être requise) puis importe les nouvelles transactions.',
  status: 202,
  response: BankLinkSchema,
  errors: [404, 503],
  handler: ({ userId }) => requestBankRefresh(userId),
});

route({
  method: 'get',
  path: '/accounts',
  summary: 'Comptes bancaires',
  response: BankAccountListResponseSchema,
  handler: async ({ userId }) => ({ items: await service.listAccounts(userId) }),
});

route({
  method: 'patch',
  path: '/accounts/:id',
  summary: 'Inclure ou exclure un compte de l’analyse',
  description: 'Choix local. Pour changer les comptes partagés avec l’application, utiliser le parcours `manage`.',
  params: IdParamsSchema,
  body: UpdateBankAccountBodySchema,
  response: BankAccountSchema,
  errors: [404],
  handler: ({ userId, params, body }) => service.updateAccount(userId, params.id, body.analyzed),
});

route({
  method: 'delete',
  path: '/link',
  summary: 'Déconnecter la banque',
  description:
    'Supprime la connexion et l’utilisateur chez Powens, puis les comptes et transactions locaux. Les abonnements suivis sont conservés.',
  status: 204,
  errors: [404],
  handler: ({ userId }) => service.unlinkBank(userId),
});
