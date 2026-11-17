import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { BankLink, ConnectFlow } from '@subtracker/contracts';
import { api } from './api';
import { PLATFORM } from './config';

export interface CallbackParams {
  state?: string;
  connection_id?: string;
  error?: string;
  error_description?: string;
}

/**
 * Une même redirection peut arriver deux fois sur Android (retour de l'onglet + lien profond).
 * Le `state` étant à usage unique côté API, on partage la promesse de finalisation par `state`.
 */
const completionsByState = new Map<string, Promise<BankLink>>();

export function completeConnectCallback(params: CallbackParams): Promise<BankLink> {
  if (!params.state) return Promise.reject(new Error('Retour de connexion incomplet (state manquant)'));
  const existing = completionsByState.get(params.state);
  if (existing) return existing;
  const promise = api.completeConnectSession({
    state: params.state,
    connectionId: params.connection_id,
    error: params.error,
    errorDescription: params.error_description,
  });
  completionsByState.set(params.state, promise);
  return promise;
}

type ConnectOutcome = { kind: 'completed'; link: BankLink } | { kind: 'cancelled' } | { kind: 'redirected' };

/**
 * Ouvre le parcours officiel Powens :
 * - natif : navigateur système (Custom Tabs / ASWebAuthenticationSession), jamais une WebView ;
 * - web : redirection pleine page, le retour arrive sur la route /powens/callback.
 */
export async function openPowensFlow(flow: ConnectFlow): Promise<ConnectOutcome> {
  const session = await api.createConnectSession({ flow, platform: PLATFORM });
  if (PLATFORM === 'web') {
    window.location.assign(session.url);
    return { kind: 'redirected' };
  }
  const result = await WebBrowser.openAuthSessionAsync(session.url, session.redirectUri);
  if (result.type !== 'success') return { kind: 'cancelled' };
  const { queryParams } = Linking.parse(result.url);
  const params = Object.fromEntries(
    Object.entries(queryParams ?? {}).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  ) as CallbackParams;
  return { kind: 'completed', link: await completeConnectCallback(params) };
}
