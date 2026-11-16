import { CLIENT_PLATFORM_HEADER, type AuthResponse, type Problem } from '@subtracker/contracts';
import { API_URL, PLATFORM } from './config';
import { readRefreshToken, writeRefreshToken } from './storage';

/** Erreur d'API au format problem+json. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly detail?: string,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.detail ? `${error.message} — ${error.detail}` : error.message;
  if (error instanceof TypeError) return 'Serveur injoignable. Vérifiez votre connexion et l’adresse de l’API.';
  return error instanceof Error ? error.message : 'Erreur inattendue';
}

interface Session {
  accessToken: string;
  expiresAt: number;
}

type SessionListener = (response: AuthResponse | null) => void;

let session: Session | null = null;
let refreshing: Promise<AuthResponse | null> | null = null;
const listeners = new Set<SessionListener>();

export function onSessionChange(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function parseError(response: Response): Promise<ApiError> {
  let problem: Partial<Problem> = {};
  try {
    problem = (await response.json()) as Problem;
  } catch {
    // corps vide ou non JSON
  }
  const fieldErrors = Object.fromEntries((problem.errors ?? []).map((error) => [error.path, error.message]));
  return new ApiError(
    response.status,
    problem.code ?? 'http_error',
    problem.title ?? `Erreur ${response.status}`,
    problem.detail,
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

/** Renouvelle la session (un seul appel à la fois, les requêtes concurrentes attendent). */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= (async () => {
    try {
      const refreshToken = await readRefreshToken();
      if (PLATFORM === 'native' && !refreshToken) return null;
      const response = await authRequest('/auth/refresh', PLATFORM === 'native' ? { refreshToken } : {});
      await applyAuthResponse(response);
      return response;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await applyAuthResponse(null);
        return null;
      }
      throw error;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
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
  if (session && session.expiresAt - Date.now() > 30_000) return session.accessToken;
  const refreshed = await refreshSession();
  return refreshed?.accessToken ?? null;
}

/** Requête authentifiée : renouvelle l'access token si besoin, une nouvelle tentative sur 401. */
export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const send = async (token: string | null) =>
    fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...baseHeaders(),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let response = await send(await validAccessToken());
  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (!refreshed) throw new ApiError(401, 'unauthorized', 'Session expirée, reconnectez-vous');
    response = await send(refreshed.accessToken);
  }
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
