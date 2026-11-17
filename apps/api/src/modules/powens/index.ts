import type { AppConfig } from '../../core/config';
import { getConfig } from '../../core/context';
import { AppError } from '../../core/errors';
import { PowensClient } from './client';

let injectedClient: PowensClient | null = null;

/** Permet aux tests d'injecter un client (les appels HTTP restent simulés par nock). */
export function setPowensClient(client: PowensClient | null): void {
  injectedClient = client;
}

/** À n'appeler que si `config.powensConfigured`. */
export function createPowensClient(config: AppConfig): PowensClient {
  return new PowensClient({
    domain: config.POWENS_DOMAIN!,
    clientId: config.POWENS_CLIENT_ID!,
    clientSecret: config.POWENS_CLIENT_SECRET!,
    webviewBaseUrl: config.POWENS_WEBVIEW_BASE_URL,
    lang: config.POWENS_WEBVIEW_LANG,
  });
}

export function getPowensClient(): PowensClient {
  if (injectedClient) return injectedClient;
  const config = getConfig();
  if (!config.powensConfigured) {
    throw new AppError(
      503,
      'powens_not_configured',
      'Connexion bancaire indisponible',
      'Les identifiants Powens ne sont pas configurés sur le serveur.',
    );
  }
  return createPowensClient(config);
}

export { PowensError, verifyWebhookSignature } from './client';
