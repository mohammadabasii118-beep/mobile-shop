import { ProviderError } from '../types';
import { RawInbound } from './link';

export interface XuiClientOptions {
  baseUrl: string;
  username?: string;
  password?: string;
  apiToken?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface Envelope<T = any> { success: boolean; msg?: string; obj?: T }

/**
 * Thin HTTP client for the 3x-ui panel API (MHSanaei/3x-ui, targeted at v2.9.x).
 * Auth: Bearer API token when configured, otherwise cookie session via POST /login (auto re-login).
 * Secrets are never logged or included in error messages.
 */
export class XuiClient {
  private cookie?: string;
  private loginPromise?: Promise<void>;
  private base: string;
  private f: typeof fetch;

  constructor(private o: XuiClientOptions) {
    this.base = o.baseUrl.replace(/\/+$/, '');
    this.f = o.fetchImpl ?? fetch;
  }

  private async raw(method: 'GET' | 'POST', path: string, form?: Record<string, string>, auth = true): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.o.apiToken && auth) headers.Authorization = `Bearer ${this.o.apiToken}`;
    else if (this.cookie && auth) headers.Cookie = this.cookie;
    let body: string | undefined;
    if (form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(form).toString();
    }
    try {
      return await this.f(this.base + path, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(this.o.timeoutMs ?? 15_000) });
    } catch (e: any) {
      throw new ProviderError(`X-UI unreachable: ${e?.name === 'TimeoutError' ? 'timeout' : (e?.cause?.code ?? e?.message ?? 'network error')}`, true);
    }
  }

  async login(): Promise<void> {
    if (this.o.apiToken) return;
    if (!this.o.username || !this.o.password) throw new ProviderError('X-UI credentials are not configured', false);
    this.loginPromise ??= (async () => {
      const res = await this.raw('POST', '/login', { username: this.o.username!, password: this.o.password! }, false);
      const json = (await res.json().catch(() => null)) as Envelope | null;
      if (!json?.success) throw new ProviderError('X-UI login failed (check XUI_BASE_URL, username/password)', false);
      const set = typeof (res.headers as any).getSetCookie === 'function' ? (res.headers as any).getSetCookie() : [res.headers.get('set-cookie') ?? ''];
      const c = set.map((s: string) => s.split(';')[0]).filter(Boolean).join('; ');
      if (!c) throw new ProviderError('X-UI login returned no session cookie', false);
      this.cookie = c;
    })().finally(() => { this.loginPromise = undefined; });
    await this.loginPromise;
  }

  async call<T = any>(method: 'GET' | 'POST', path: string, form?: Record<string, string>): Promise<T> {
    if (!this.o.apiToken && !this.cookie) await this.login();
    let res = await this.raw(method, path, form);
    // 3x-ui hides API endpoints from unauthenticated callers behind 404/redirect: re-login once.
    if (!this.o.apiToken && (res.status === 404 || res.status === 401 || res.status === 302 || res.status === 307)) {
      this.cookie = undefined;
      await this.login();
      res = await this.raw(method, path, form);
    }
    if (res.status === 401 || res.status === 403) throw new ProviderError('X-UI rejected credentials/token', false);
    if (res.status >= 500) throw new ProviderError(`X-UI server error ${res.status}`, true);
    const json = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (!json) throw new ProviderError(`X-UI returned non-JSON response (status ${res.status}); wrong path/version?`, false);
    if (!json.success) throw new ProviderError(`X-UI error: ${String(json.msg ?? 'unknown').slice(0, 200)}`, false);
    return json.obj as T;
  }

  listInbounds() { return this.call<RawInbound[]>('GET', '/panel/api/inbounds/list'); }
  async getInbound(id: number): Promise<RawInbound | null> {
    try { return (await this.call<RawInbound>('GET', `/panel/api/inbounds/get/${id}`)) ?? null; }
    catch (e: any) { if (e instanceof ProviderError && !e.retryable) return null; throw e; }
  }
  addClient(inboundId: number, client: Record<string, unknown>) {
    return this.call('POST', '/panel/api/inbounds/addClient', { id: String(inboundId), settings: JSON.stringify({ clients: [client] }) });
  }
  updateClient(inboundId: number, clientKey: string, client: Record<string, unknown>) {
    return this.call('POST', `/panel/api/inbounds/updateClient/${encodeURIComponent(clientKey)}`, { id: String(inboundId), settings: JSON.stringify({ clients: [client] }) });
  }
  delClient(inboundId: number, clientKey: string) {
    return this.call('POST', `/panel/api/inbounds/${inboundId}/delClient/${encodeURIComponent(clientKey)}`);
  }
  resetClientTraffic(inboundId: number, email: string) {
    return this.call('POST', `/panel/api/inbounds/${inboundId}/resetClientTraffic/${encodeURIComponent(email)}`);
  }
  async clientTraffic(email: string): Promise<{ up: number; down: number; total: number; expiryTime: number; enable: boolean } | null> {
    const r = await this.call<any>('GET', `/panel/api/inbounds/getClientTraffics/${encodeURIComponent(email)}`);
    return r ?? null;
  }
}
