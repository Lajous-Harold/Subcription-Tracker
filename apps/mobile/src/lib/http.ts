import {
  CLIENT_PLATFORM_HEADER,
  REFRESH_SUPERSEDED_ERROR_CODE,
  type ApiErrorResponse,
  type AuthResponse,
} from '@subtracker/contracts';
import { API_URL, PLATFORM } from './config';
import { readRefreshToken, writeRefreshToken } from './storage';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly hint?: string,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.hint ? `${error.message} — ${error.hint}` : error.message;
  if (error instanceof TypeError) return 'Serveur injoignable. Vérifiez votre connexion et l’adresse de l’API.';
  return error instanceof Error ? error.message : 'Erreur inattendue';
}

interface Session {
  accessToken: string;
  expiresAt: number;
}

type SessionListener = (response: AuthResponse | null) => void;

const ACCESS_TOKEN_RENEWAL_MARGIN_MS = 30_000;

let session: Session | null = null;
let refreshInFlight: Promise<AuthResponse | null> | null = null;
const listeners = new Set<SessionListener>();

export function onSessionChange(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function parseError(response: Response): Promise<ApiError> {
  let error: Partial<ApiErrorResponse['error']> = {};
  try {
    error = ((await response.json()) as Partial<ApiErrorResponse>).error ?? {};
  } catch {
    // corps vide ou non JSON
  }
  const fieldErrors = Object.fromEntries((error.fields ?? []).map((field) => [field.path, field.message]));
  return new ApiError(
    response.status,
    error.code ?? 'HTTP_ERROR',
    error.message ?? `Erreur ${response.status}`,
    error.hint,
    fieldErrors,
  );
}

function baseHeaders(): Record<string, string> {
  return { Accept: 'application/json', [CLIENT_PLATFORM_HEADER]: PLATFORM };
}

/** Appels d'authentification : cookie inclus sur le web pour le refresh token. */
export async function authRequest(path: string, body: unknown): Promise<AuthResponse | null> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { ...baseHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    credentials: PLATFORM === 'web' ? 'include' : 'omit',
  });
  if (response.status === 204) return null;
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as AuthResponse;
}

export async function applyAuthResponse(response: AuthResponse | null): Promise<void> {
  if (response) {
    session = { accessToken: response.accessToken, expiresAt: Date.parse(response.accessTokenExpiresAt) };
    if (response.refreshToken) await writeRefreshToken(response.refreshToken);
  } else {
    session = null;
    await writeRefreshToken(null);
  }
  listeners.forEach((listener) => listener(response));
}

async function requestRefresh(): Promise<AuthResponse | null> {
  const refreshToken = await readRefreshToken();
  if (PLATFORM === 'native' && !refreshToken) return null;
  return authRequest('/auth/refresh', PLATFORM === 'native' ? { refreshToken } : {});
}

const isRefreshSuperseded = (error: unknown) =>
  error instanceof ApiError && error.code === REFRESH_SUPERSEDED_ERROR_CODE;

// Un seul renouvellement à la fois, partagé par les requêtes concurrentes : le refresh token est rotatif,
// et présenter deux fois le même révoquerait la session. Sur le web, un autre onglet peut l'avoir déjà tourné :
// le cookie porte alors le nouveau jeton, d'où un unique réessai.
export function refreshSession(): Promise<AuthResponse | null> {
  refreshInFlight ??= (async () => {
    try {
      const response = await requestRefresh().catch((error: unknown) => {
        if (isRefreshSuperseded(error)) return requestRefresh();
        throw error;
      });
      await applyAuthResponse(response);
      return response;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await applyAuthResponse(null);
        return null;
      }
      throw error;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function logoutSession(): Promise<void> {
  const refreshToken = await readRefreshToken();
  try {
    await authRequest('/auth/logout', PLATFORM === 'native' ? { refreshToken } : {});
  } finally {
    await applyAuthResponse(null);
  }
}

async function validAccessToken(): Promise<string | null> {
  if (session && session.expiresAt - Date.now() > ACCESS_TOKEN_RENEWAL_MARGIN_MS) return session.accessToken;
  const refreshed = await refreshSession();
  return refreshed?.accessToken ?? null;
}

export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const sendWithToken = async (token: string | null) =>
    fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...baseHeaders(),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let response = await sendWithToken(await validAccessToken());
  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (!refreshed) throw new ApiError(401, 'UNAUTHORIZED', 'Session expirée, reconnectez-vous');
    response = await sendWithToken(refreshed.accessToken);
  }
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
