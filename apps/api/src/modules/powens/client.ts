import { createHmac } from 'node:crypto';
import { safeEqual } from '../../core/crypto';

/**
 * Adaptateur HTTP vers l'API Powens 2.0 : aucune règle métier, aucun accès base, seul détenteur des secrets.
 * Endpoints utilisés (documentation officielle) :
 *   POST /auth/init, GET /auth/token/code,
 *   GET|PUT|DELETE /users/me/connections/{id}, GET /users/me/accounts, GET /users/me/transactions,
 *   DELETE /users/me
 */

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_TRANSACTION_PAGES = 500;

interface PowensConfig {
  /** Sous-domaine ou domaine complet (ex. `monprojet-sandbox` ou `monprojet-sandbox.biapi.pro`). */
  domain: string;
  clientId: string;
  clientSecret: string;
  webviewBaseUrl: string;
  lang: string;
}

export interface PowensConnection {
  id: number;
  id_user?: number;
  state: string | null;
  error_message?: string | null;
  last_update?: string | null;
  created?: string | null;
  active?: boolean;
  expire?: string | null;
  connector?: { name?: string | null } | null;
}

interface PowensAccount {
  id: number;
  id_connection?: number | null;
  name?: string | null;
  original_name?: string | null;
  type?: string | null;
  number?: string | null;
  iban?: string | null;
  balance?: number | null;
  currency?: { id?: string } | null;
  disabled?: string | null;
  deleted?: string | null;
  last_update?: string | null;
}

export interface PowensTransaction {
  id: number;
  id_account: number;
  date: string;
  value: number | null;
  original_wording?: string | null;
  simplified_wording?: string | null;
  wording?: string | null;
  type?: string | null;
  coming?: boolean;
  deleted?: string | null;
  last_update?: string | null;
  counterparty?: { label?: string | null } | null;
}

export class PowensError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | null,
    message: string,
  ) {
    super(message);
  }
}

type WebviewFlow = 'connect' | 'reconnect' | 'manage';

export class PowensClient {
  readonly host: string;
  private readonly baseUrl: string;

  constructor(private readonly config: PowensConfig) {
    this.host = config.domain.endsWith('.biapi.pro') ? config.domain : `${config.domain}.biapi.pro`;
    this.baseUrl = `https://${this.host}/2.0`;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    pathOrUrl: string,
    options: { token?: string; body?: Record<string, unknown>; query?: string } = {},
  ): Promise<T> {
    const url = pathOrUrl.startsWith('http')
      ? pathOrUrl
      : `${this.baseUrl}${pathOrUrl}${options.query ? `?${options.query}` : ''}`;
    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    if (!response.ok) {
      const code = typeof data.code === 'string' ? data.code : null;
      const message = typeof data.message === 'string' ? data.message : (code ?? `HTTP ${response.status}`);
      throw new PowensError(response.status, code, message);
    }
    return data as T;
  }

  /** Crée un utilisateur Powens permanent (appel serveur uniquement). */
  async createUser(): Promise<{ token: string; powensUserId: number | null }> {
    const data = await this.request<{ auth_token: string; id_user?: number }>('POST', '/auth/init', {
      body: { client_id: this.config.clientId, client_secret: this.config.clientSecret },
    });
    return { token: data.auth_token, powensUserId: data.id_user ?? null };
  }

  /** Code temporaire (30 min) à transmettre à la Webview. */
  async getTemporaryCode(token: string): Promise<string> {
    const data = await this.request<{ code: string }>('GET', '/auth/token/code', { token });
    return data.code;
  }

  buildWebviewUrl(params: {
    flow: WebviewFlow;
    code: string;
    state: string;
    redirectUri: string;
    connectionId?: number | null;
  }): string {
    const query = new URLSearchParams({
      domain: this.host,
      client_id: this.config.clientId,
      redirect_uri: params.redirectUri,
      code: params.code,
      state: params.state,
    });
    if (params.flow === 'connect') {
      query.set('connector_capabilities', 'bank');
      query.set('max_connections', '1');
    }
    if (params.flow === 'manage') query.set('connector_capabilities', 'bank');
    if (params.connectionId && params.flow !== 'connect') query.set('connection_id', String(params.connectionId));
    return `${this.config.webviewBaseUrl}/${this.config.lang}/${params.flow}?${query.toString()}`;
  }

  getConnection(token: string, connectionId: number): Promise<PowensConnection> {
    return this.request('GET', `/users/me/connections/${connectionId}`, { token, query: 'expand=connector' });
  }

  async listAccounts(token: string): Promise<PowensAccount[]> {
    const data = await this.request<{ accounts?: PowensAccount[] }>('GET', '/users/me/accounts', {
      token,
      query: 'all',
    });
    return data.accounts ?? [];
  }

  /**
   * Parcourt les transactions modifiées depuis `lastUpdate` (suppressions incluses via `all`),
   * en suivant la pagination `_links.next`.
   */
  async *iterateTransactions(token: string, lastUpdate: string | null): AsyncGenerator<PowensTransaction[]> {
    const params = new URLSearchParams({ limit: '1000' });
    if (lastUpdate) params.set('last_update', lastUpdate);
    let next: string | null = `/users/me/transactions`;
    let query: string | undefined = `${params.toString()}&all`;
    for (let page = 0; next && page < MAX_TRANSACTION_PAGES; page += 1) {
      const data: { transactions?: PowensTransaction[]; _links?: { next?: { href?: string } | null } } =
        await this.request('GET', next, { token, query });
      yield data.transactions ?? [];
      const href = data._links?.next?.href ?? null;
      if (!href) break;
      if (href.startsWith('http')) {
        next = href;
        query = undefined;
      } else {
        const [path = '', search] = href.replace(/^\/?2\.0/, '').split('?');
        next = path.startsWith('/') ? path : `/${path}`;
        query = search;
      }
    }
  }

  /** Demande une synchronisation à la banque (peut déclencher une SCA si l'utilisateur est présent). */
  syncConnection(token: string, connectionId: number): Promise<PowensConnection> {
    return this.request('PUT', `/users/me/connections/${connectionId}`, { token });
  }

  deleteConnection(token: string, connectionId: number): Promise<void> {
    return this.request('DELETE', `/users/me/connections/${connectionId}`, { token });
  }

  deleteUser(token: string): Promise<void> {
    return this.request('DELETE', '/users/me', { token });
  }
}

interface WebhookSignatureInput {
  secret: string;
  method: string;
  endpoint: string;
  date: string;
  payload: string;
}

/** Format Powens : BI-Signature = base64(HMAC-SHA256(secret, `${METHOD}.${endpoint}.${date}.${payload}`)). */
export function computeWebhookSignature(params: WebhookSignatureInput): string {
  return createHmac('sha256', params.secret)
    .update(`${params.method.toUpperCase()}.${params.endpoint}.${params.date}.${params.payload}`)
    .digest('base64');
}

export function verifyWebhookSignature(params: WebhookSignatureInput & { signature: string }): boolean {
  return safeEqual(computeWebhookSignature(params), params.signature);
}
