import { getConfig } from '../../core/context';
import { AppError } from '../../core/errors';
import { PowensClient } from './client';

let override: PowensClient | null = null;

/** Permet aux tests d'injecter un client (les appels HTTP restent simulés par nock). */
export function setPowensClient(client: PowensClient | null): void {
  override = client;
}

export function getPowensClient(): PowensClient {
  if (override) return override;
  const config = getConfig();
  if (!config.powensConfigured) {
    throw new AppError(
      503,
      'powens_not_configured',
      'Connexion bancaire indisponible',
      'Les identifiants Powens ne sont pas configurés sur le serveur.',
    );
  }
  return new PowensClient({
    domain: config.POWENS_DOMAIN!,
    clientId: config.POWENS_CLIENT_ID!,
    clientSecret: config.POWENS_CLIENT_SECRET!,
    webviewBaseUrl: config.POWENS_WEBVIEW_BASE_URL,
    lang: config.POWENS_WEBVIEW_LANG,
  });
}

export { PowensClient, PowensError, verifyWebhookSignature } from './client';
