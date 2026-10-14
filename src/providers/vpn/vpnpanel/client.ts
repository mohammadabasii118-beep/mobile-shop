import { ProviderError } from '../types';

export interface VpnPanelUser {
  id: number; name: string; status: 'active' | 'disabled' | 'expired' | 'quota'; enabled: boolean;
  used_gb: number; quota_gb: number; days_left: number | null; expire_at: string | null;
  protos: string[]; node_ids: number[]; sub_url: string;
}
export interface VpnPanelNode { id: number; name: string; cc: string; address: string; online: boolean; load?: number }
export interface VpnPanelProtocol { id: string; label: string; counted: boolean; uri: boolean }
export interface VpnPanelConfig { node: string; node_id: number; proto: string; label: string; link: string | null; summary?: string; copy?: string; file_ext?: string | null }

export interface VpnPanelClientOptions { baseUrl: string; apiKey: string; timeoutMs?: number; retries?: number; fetchImpl?: typeof fetch }

const CONNECT_ONLY = /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|CONNECT_TIMEOUT|EHOSTUNREACH|ENETUNREACH/;

/**
 * Client for the REST API of the multi-location panel (vpn-panel/panel/API.md): `Authorization: Bearer <PANEL_API_KEY>`.
 * Secrets are never logged or put in error messages. Reads are retried on transient network errors;
 * a write is only re-sent when the error proves it never left the machine.
 */
export class VpnPanelClient {
  private base: string;
  private f: typeof fetch;
  constructor(private o: VpnPanelClientOptions) {
    this.base = o.baseUrl.replace(/\/+$/, '');
    this.f = o.fetchImpl ?? fetch;
  }

  private async send(method: string, path: string, body?: unknown): Promise<{ status: number; text: string; ct: string }> {
    const headers: Record<string, string> = { Accept: 'application/json', Authorization: `Bearer ${this.o.apiKey}` };
    let payload: string | undefined;
    if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const attempts = 1 + (this.o.retries ?? 2);
    let last: ProviderError | undefined;
    for (let n = 0; n < attempts; n++) {
      if (n > 0) await new Promise((r) => setTimeout(r, 300 * 3 ** (n - 1)));
      try {
        const res = await this.f(this.base + path, { method, headers, body: payload, redirect: 'manual', signal: AbortSignal.timeout(this.o.timeoutMs ?? 12_000) });
        return { status: res.status, text: await res.text().catch(() => ''), ct: res.headers.get('content-type') ?? '' };
      } catch (e: any) {
        const code: string = e?.cause?.code ?? e?.code ?? '';
        const detail = `${code} ${e?.cause?.message ?? ''}`;
        if (/HPE_|HTTPParserError|does not match the HTTP/.test(detail) && this.base.startsWith('http://')) throw new ProviderError('the panel answered with non-HTTP data: its port is probably HTTPS — use https:// in the panel address', false);
        if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY|ALTNAME/.test(code)) throw new ProviderError(`the panel TLS certificate is not trusted (${code}); use a valid certificate/domain or accept self-signed for this panel`, false);
        const timeout = e?.name === 'TimeoutError' || /TIMEOUT/.test(code);
        last = new ProviderError(`panel unreachable: ${timeout ? 'timeout' : (code || e?.message || 'network error')}`, true);
        if (method !== 'GET' && !CONNECT_ONLY.test(code)) break; // the write may have been applied
      }
    }
    throw last!;
  }

  private async call<T>(method: string, path: string, body?: unknown, allow404 = false): Promise<T | null> {
    return this.interpret<T>(await this.send(method, path, body), allow404);
  }

  private interpret<T>(r: { status: number; text: string; ct: string }, allow404: boolean): T | null {
    let json: any = null;
    try { json = r.text ? JSON.parse(r.text) : null; } catch { json = null; }
    const detail = typeof json?.detail === 'string' ? json.detail : Array.isArray(json?.detail) ? String(json.detail[0]?.msg ?? '') : '';
    if (r.status === 401 || r.status === 403) throw new ProviderError('the panel rejected the API key (check PANEL_API_KEY in the panel .env)', false);
    if (r.status === 404) { if (allow404) return null; throw new ProviderError(`panel: not found${detail ? ` (${detail.slice(0, 80)})` : ''}`, false); }
    if (r.status >= 500) throw new ProviderError(`panel server error ${r.status}`, true);
    if (r.status >= 400) throw new ProviderError(`panel: ${(detail || `HTTP ${r.status}`).slice(0, 200)}`, false);
    if (json === null) throw new ProviderError(`the panel returned a non-JSON answer (status ${r.status}, ${r.ct || 'no content-type'}) — got «${r.text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)}». Check the panel address`, true);
    return json as T;
  }

  nodes() { return this.call<VpnPanelNode[]>('GET', '/api/nodes') as Promise<VpnPanelNode[]>; }
  protocols() { return this.call<VpnPanelProtocol[]>('GET', '/api/protocols') as Promise<VpnPanelProtocol[]>; }
  userByName(name: string) { return this.call<VpnPanelUser>('GET', `/api/users/by-name/${encodeURIComponent(name)}`, undefined, true); }
  createUser(b: { name: string; quota_gb: number; days: number; protos: string[]; node_ids: number[] }) { return this.call<VpnPanelUser>('POST', '/api/users', b) as Promise<VpnPanelUser>; }
  patchUser(id: number, b: Record<string, unknown>) { return this.call<VpnPanelUser>('PATCH', `/api/users/${id}`, b) as Promise<VpnPanelUser>; }
  deleteUser(id: number) { return this.call('DELETE', `/api/users/${id}`); }
  configs(id: number) { return this.call<VpnPanelConfig[]>('GET', `/api/users/${id}/configs`) as Promise<VpnPanelConfig[]>; }
  /** Optional endpoint (not in the base panel): new subscription token + credentials. Returns null when the panel has none. */
  async rotate(id: number): Promise<VpnPanelUser | null> {
    const r = await this.send('POST', `/api/users/${id}/rotate`);
    if (r.status === 404 || r.status === 405) return null;
    return this.interpret<VpnPanelUser>(r, false);
  }
}
