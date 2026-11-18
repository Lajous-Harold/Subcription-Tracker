import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { BankLink, ConnectFlow } from '@subtracker/contracts';
import { api } from './api';
import { PLATFORM } from './config';
import { ApiError } from './http';

export interface CallbackParams {
  state?: string;
  connection_id?: string;
  error?: string;
  error_description?: string;
}

const CONNECTION_FAILED = 'La connexion à votre banque n’a pas abouti. Relancez-la depuis l’écran Banque.';

/** Textes affichés selon le code renvoyé par l'API (`WEBVIEW_*` reprend l'erreur transmise par la Webview Powens). */
const USER_MESSAGES_BY_CODE: Record<string, string> = {
  INVALID_STATE: 'Ce lien de connexion a expiré ou a déjà servi. Relancez la connexion depuis l’écran Banque.',
  WEBVIEW_ACCESS_DENIED: 'Vous avez interrompu la connexion à votre banque. Relancez-la depuis l’écran Banque.',
  WEBVIEW_TOS_DECLINED:
    'La connexion n’a pas été établie, faute d’accepter les conditions de Powens. Relancez-la depuis l’écran Banque.',
  WEBVIEW_SERVER_ERROR: 'Powens rencontre un problème. Réessayez dans quelques minutes depuis l’écran Banque.',
};

const MISSING_STATE = 'MISSING_STATE';

/**
 * Échec de la finalisation, avec un texte destiné à l'utilisateur. La cause technique (code de l'API, explication
 * de Powens) reste dans `reason` et `cause` pour le diagnostic, sans être affichée.
 */
export class PowensConnectError extends Error {
  constructor(
    public readonly reason: string,
    options?: { cause?: unknown },
  ) {
    super(USER_MESSAGES_BY_CODE[reason] ?? CONNECTION_FAILED, options);
    this.name = 'PowensConnectError';
  }
}

/**
 * Seuls les refus de l'API sur le parcours (4xx) sont reformulés : une panne réseau ou une session expirée
 * garde le message générique de `errorMessage`, qui dit déjà quoi faire.
 */
function toUserFacingError(error: unknown): unknown {
  const isConnectRefusal =
    error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 401;
  return isConnectRefusal ? new PowensConnectError(error.code, { cause: error }) : error;
}

/**
 * Une même redirection peut arriver deux fois sur Android (retour de l'onglet + lien profond).
 * Le `state` étant à usage unique côté API, on partage la promesse de finalisation par `state`.
 * Un échec (réseau, par exemple) n'est pas mémorisé, pour qu'un nouveau retour puisse réessayer.
 */
const completionsByState = new Map<string, Promise<BankLink>>();

export function completeConnectCallback(params: CallbackParams): Promise<BankLink> {
  const { state } = params;
  if (!state) return Promise.reject(new PowensConnectError(MISSING_STATE));
  const existing = completionsByState.get(state);
  if (existing) return existing;
  const completion = api
    .completeConnectSession({
      state,
      connectionId: params.connection_id,
      error: params.error,
      errorDescription: params.error_description,
    })
    .catch((error: unknown) => {
      throw toUserFacingError(error);
    });
  completionsByState.set(state, completion);
  completion.catch(() => completionsByState.delete(state));
  return completion;
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
