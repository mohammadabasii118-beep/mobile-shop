import { ProviderError } from '../types';
import { RawInbound } from './link';

export interface XuiClientOptions {
  baseUrl: string;
  username?: string;
  password?: string;
  apiToken?: string;
  timeoutMs?: number;
  /** extra attempts for transient network errors (reset/timeout/refused). */
  retries?: number;
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
    const attempts = 1 + (this.o.retries ?? 2);
    let last: ProviderError | undefined;
    for (let n = 0; n < attempts; n++) {
      if (n > 0) await new Promise((r) => setTimeout(r, 300 * 3 ** (n - 1)));
      try {
        return await this.f(this.base + path, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(this.o.timeoutMs ?? 12_000) });
      } catch (e: any) {
        const code: string = e?.cause?.code ?? e?.code ?? '';
        const detail = `${code} ${e?.cause?.name ?? ''} ${e?.cause?.message ?? ''}`;
        if (/HPE_|HTTPParserError|does not match the HTTP/.test(detail) && this.base.startsWith('http://')) {
          throw new ProviderError('X-UI answered with non-HTTP data: the panel port is probably HTTPS. Use https:// in the panel address', false);
        }
        if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY|ALTNAME/.test(code)) {
          throw new ProviderError(`X-UI TLS certificate is not trusted (${code}). Use a valid certificate/domain, or enable "accept self-signed certificate" for this panel`, false);
        }
        const timeout = e?.name === 'TimeoutError' || /TIMEOUT/.test(code);
        last = new ProviderError(`X-UI unreachable: ${timeout ? 'timeout' : (code || e?.message || 'network error')}`, true);
        // A timed-out write may have been applied: only reads are re-sent after a timeout.
        if (timeout && method !== 'GET' && auth) break; // (login is safe to repeat)
      }
    }
    throw last!;
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

  private async exchange(method: 'GET' | 'POST', path: string, form?: Record<string, string>) {
    const res = await this.raw(method, path, form);
    const text = res.status === 404 || res.status === 401 || res.status === 302 || res.status === 307 ? '' : await res.text().catch(() => '');
    let json: Envelope | null = null;
    try { json = text ? (JSON.parse(text) as Envelope) : null; } catch { json = null; }
    return { res, json, text };
  }

  async call<T = any>(method: 'GET' | 'POST', path: string, form?: Record<string, string>): Promise<T> {
    if (!this.o.apiToken && !this.cookie) await this.login();
    let { res, json, text } = await this.exchange(method, path, form);
    // An expired session shows up as 404/401/redirect (3x-ui hides the API) or as HTTP 200 with the HTML login page:
    // log in again once and repeat the call.
    const sessionLost = res.status === 404 || res.status === 401 || res.status === 302 || res.status === 307 || (res.status < 500 && !json);
    if (!this.o.apiToken && sessionLost) {
      this.cookie = undefined;
      await this.login();
      ({ res, json, text } = await this.exchange(method, path, form));
    }
    if (res.status === 401 || res.status === 403) throw new ProviderError('X-UI rejected credentials/token', false);
    if (res.status >= 500) throw new ProviderError(`X-UI server error ${res.status}`, true);
    if (!json) throw new ProviderError(`X-UI returned a non-JSON response (status ${res.status}, ${res.headers.get('content-type') ?? 'no content-type'}, GET ${path}) even after re-login — got: «${text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90)}». Check the panel address/base path, or a proxy/CDN in front of it`, this.o.apiToken ? false : true);
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
