import express from 'express';
import { z } from 'zod';
import { getConfig } from '../../core/context';
import { invalidInput, unauthorized } from '../../core/errors';
import { createModule } from '../../core/http';
import { logger } from '../../core/logger';
import { BankLinkModel, WebhookEventModel, type BankLinkDoc } from '../bank/models';
import { refreshAccounts, scheduleSync } from '../bank/sync';
import { verifyWebhookSignature } from '../powens';

export const webhooksModule = createModule('/webhooks', 'Webhooks');

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const HANDLED_EVENTS = [
  'CONNECTION_SYNCED',
  'CONNECTION_DELETED',
  'USER_DELETED',
  'ACCOUNT_DISABLED',
  'ACCOUNT_ENABLED',
] as const;

const PayloadSchema = z
  .object({
    id_webhook_data: z.number().int().optional(),
    id_user: z.number().int().optional(),
    user: z.object({ id: z.number().int() }).partial().optional(),
    connection: z.object({ id: z.number().int(), id_user: z.number().int() }).partial().optional(),
  })
  .passthrough();

function verifySignature(req: express.Request, rawBody: string): void {
  const config = getConfig();
  const secret = config.POWENS_WEBHOOK_SECRET;
  if (!secret) throw unauthorized('Webhooks non configurés');
  const signature = req.header('bi-signature');
  const date = req.header('bi-signature-date');
  if (!signature || !date) throw unauthorized('Signature absente');
  const timestamp = Date.parse(date);
  if (Number.isNaN(timestamp) || Math.abs(Date.now() - timestamp) > MAX_CLOCK_SKEW_MS) {
    throw unauthorized('Signature expirée');
  }
  const path = req.originalUrl.split('?')[0] ?? req.originalUrl;
  // Le format exact de « endpoint » dans la signature est à confirmer sur la sandbox :
  // on accepte le chemin seul ou l'URL publique complète.
  const acceptedEndpoints = [path, `${config.PUBLIC_API_URL.replace(/\/$/, '')}${path}`];
  const valid = acceptedEndpoints.some((endpoint) =>
    verifyWebhookSignature({ secret, method: req.method, endpoint, date, payload: rawBody, signature }),
  );
  if (!valid) throw unauthorized('Signature invalide');
}

async function findLinkForPayload(payload: z.infer<typeof PayloadSchema>): Promise<BankLinkDoc | null> {
  const powensUserId = payload.user?.id ?? payload.connection?.id_user ?? payload.id_user;
  if (powensUserId) {
    const byUser = await BankLinkModel.findOne({ powensUserId }).lean<BankLinkDoc>();
    if (byUser) return byUser;
  }
  if (payload.connection?.id) {
    return BankLinkModel.findOne({ connectionId: payload.connection.id }).lean<BankLinkDoc>();
  }
  return null;
}

webhooksModule.route({
  method: 'post',
  path: '/powens/:event',
  summary: 'Réception des webhooks Powens',
  description:
    'Une URL par événement (ex. `/webhooks/powens/CONNECTION_SYNCED`). Signature HMAC vérifiée (`BI-Signature`, `BI-Signature-Date`), dédoublonnage par `id_webhook_data`. Le contenu sert uniquement à identifier l’utilisateur : les données sont relues par l’API.',
  auth: false,
  status: 200,
  params: z.object({ event: z.string().regex(/^[A-Z_]+$/) }),
  response: z.object({ received: z.boolean() }),
  middlewares: [express.raw({ type: '*/*', limit: '20mb', inflate: true })],
  handler: async ({ req, params }) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    verifySignature(req, rawBody);

    let payload: z.infer<typeof PayloadSchema>;
    try {
      payload = PayloadSchema.parse(JSON.parse(rawBody || '{}'));
    } catch {
      throw invalidInput('Payload invalide');
    }

    if (payload.id_webhook_data !== undefined) {
      try {
        await WebhookEventModel.create({ idWebhookData: payload.id_webhook_data, event: params.event });
      } catch (error) {
        if ((error as { code?: number }).code === 11000) return { received: true };
        throw error;
      }
    }

    if (!(HANDLED_EVENTS as readonly string[]).includes(params.event)) return { received: true };
    const link = await findLinkForPayload(payload);
    if (!link) {
      logger.warn({ event: params.event }, 'Webhook Powens sans utilisateur correspondant');
      return { received: true };
    }
    const userId = link.userId.toString();

    switch (params.event) {
      case 'CONNECTION_SYNCED':
        scheduleSync(userId, { reason: 'webhook' });
        break;
      case 'CONNECTION_DELETED':
      case 'USER_DELETED':
        await BankLinkModel.updateOne({ _id: link._id }, { $set: { status: 'disconnected' } });
        break;
      case 'ACCOUNT_DISABLED':
      case 'ACCOUNT_ENABLED':
        await refreshAccounts(userId).catch((error) =>
          logger.warn({ err: error }, 'Rafraîchissement des comptes impossible'),
        );
        break;
    }
    return { received: true };
  },
});
