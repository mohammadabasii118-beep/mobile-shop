import { createHash } from 'crypto';
import { CreateServiceRequest, InboundInfo, ProviderError, RenewServiceRequest, ServiceConfig, ServiceRef, ServiceStatus, VpnProvider } from '../types';
import { VpnPanelClient, VpnPanelUser } from './client';

const GB = 1024 ** 3;
const DAY = 86_400_000;

/** What a plan's customers get on this panel. A product's "inbound id" is the profile id. */
export interface PanelProfile { id: number; name: string; protos: string[]; nodeIds: number[] }
export const DEFAULT_PROFILES: PanelProfile[] = [{ id: 1, name: 'پیش‌فرض (VLESS Reality، همه‌ی لوکیشن‌ها)', protos: ['vless'], nodeIds: [] }];

/**
 * The panel's user name must match ^[A-Za-z0-9_.-]{2,32}$ but our client email (tg_<id>_<order>_<custom name>) can be longer
 * and contain other characters. This derives a deterministic, collision-safe name from it (so every later call finds the same user).
 */
export function panelUserName(email: string): string {
  const h = createHash('sha1').update(email).digest('hex').slice(0, 8);
  const base = email.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 22) || 'u';
  return `${base}_${h}`;
}

export interface VpnPanelProviderOptions { client: VpnPanelClient; profiles: PanelProfile[] }

export class VpnPanelProvider implements VpnProvider {
  readonly name = 'vpnpanel';
  constructor(private o: VpnPanelProviderOptions) {}

  private profile(id: number): PanelProfile {
    const p = this.o.profiles.find((x) => x.id === id);
    if (!p) throw new ProviderError(`profile ${id} does not exist on this panel (it was removed?)`, false);
    return p;
  }

  private toStatus(u: VpnPanelUser | null): ServiceStatus {
    if (!u) return { exists: false, enabled: false, expiresAt: null, trafficLimit: 0n, up: 0n, down: 0n, used: 0n };
    const used = BigInt(Math.round(u.used_gb * GB));
    return { exists: true, enabled: u.enabled, expiresAt: u.expire_at ? new Date(u.expire_at) : null, trafficLimit: BigInt(Math.round(u.quota_gb * GB)), up: 0n, down: used, used };
  }

  private async user(ref: Pick<ServiceRef, 'email'>): Promise<VpnPanelUser | null> {
    return this.o.client.userByName(panelUserName(ref.email));
  }
  private async mustUser(ref: Pick<ServiceRef, 'email'>): Promise<VpnPanelUser> {
    const u = await this.user(ref);
    if (!u) throw new ProviderError('the user does not exist on the panel', false);
    return u;
  }

  async getInbound(id: number): Promise<InboundInfo | null> {
    const p = this.o.profiles.find((x) => x.id === id);
    return p ? { id: p.id, enable: true, protocol: 'profile', port: 0, remark: `${p.name} [${p.protos.join('+')}]` } : null;
  }
  async listInbounds(): Promise<InboundInfo[]> {
    return this.o.profiles.map((p) => ({ id: p.id, enable: true, protocol: 'profile', port: 0, remark: `${p.name} [${p.protos.join('+')}]` }));
  }

  /** Idempotent by name: an existing user is adopted, never duplicated. */
  async createService(req: CreateServiceRequest): Promise<{ status: ServiceStatus; adopted: boolean }> {
    const prof = this.profile(req.inboundId);
    const existing = await this.user(req);
    if (existing) return { status: this.toStatus(existing), adopted: true };
    const days = Math.max(1, Math.round((req.expiresAt.getTime() - Date.now()) / DAY));
    const u = await this.o.client.createUser({ name: panelUserName(req.email), quota_gb: Number(req.trafficLimitBytes) / GB, days, protos: prof.protos, node_ids: prof.nodeIds });
    return { status: this.toStatus(u), adopted: false };
  }

  /** Absolute targets: quota and "days from now" are set outright (the panel keeps the usage, like the 3x-ui path). */
  async renewService(req: RenewServiceRequest): Promise<ServiceStatus> {
    const u = await this.mustUser(req);
    const days = Math.max(1, Math.round((req.expiresAt.getTime() - Date.now()) / DAY));
    const after = await this.o.client.patchUser(u.id, { quota_gb: Number(req.trafficLimitBytes) / GB, days, enabled: true });
    const st = this.toStatus(after);
    const wantLimit = Number(req.trafficLimitBytes);
    if (Math.abs(Number(st.trafficLimit) - wantLimit) > 0.02 * GB || !st.expiresAt || Math.abs(st.expiresAt.getTime() - req.expiresAt.getTime()) > 36 * 3_600_000) throw new ProviderError('renewal not reflected on the panel', true);
    return st;
  }

  async suspendService(ref: ServiceRef): Promise<void> { await this.o.client.patchUser((await this.mustUser(ref)).id, { enabled: false }); }
  async resumeService(ref: ServiceRef): Promise<void> { await this.o.client.patchUser((await this.mustUser(ref)).id, { enabled: true }); }

  async deleteService(ref: ServiceRef): Promise<void> {
    const u = await this.user(ref);
    if (u) await this.o.client.deleteUser(u.id); // already gone = done
  }

  async getServiceStatus(ref: ServiceRef): Promise<ServiceStatus | null> {
    const u = await this.user(ref);
    return u ? this.toStatus(u) : null;
  }

  async getTraffic(ref: ServiceRef) {
    const u = await this.user(ref);
    if (!u) return null;
    const s = this.toStatus(u);
    return { up: s.up, down: s.down, used: s.used, total: s.trafficLimit };
  }

  /** `subscriptionUrl` is the panel's single link (all locations/protocols); `config` is the first direct link when the panel has one. */
  async getConfig(ref: ServiceRef & { subId: string; remark?: string }): Promise<ServiceConfig> {
    const u = await this.mustUser(ref);
    const entries = await this.o.client.configs(u.id).catch(() => []);
    const link = entries.find((e) => !!e.link)?.link;
    return { config: link ?? u.sub_url, subscriptionUrl: u.sub_url };
  }

  /** The base panel has no endpoint for this; with `POST /api/users/{id}/rotate` (see docs) it works, otherwise a clear error. */
  async rotateLink(ref: ServiceRef): Promise<void> {
    const u = await this.mustUser(ref);
    if (!(await this.o.client.rotate(u.id))) throw new ProviderError('این پنل تغییر لینک را پشتیبانی نمی‌کند (endpoint «rotate» روی پنل نصب نیست)', false);
  }

  async healthCheck() {
    try {
      const nodes = await this.o.client.nodes();
      const online = nodes.filter((n) => n.online).length;
      return { ok: true, detail: `connected, ${nodes.length} node(s), ${online} online${nodes.length && !online ? ' — no node is online yet' : ''}` };
    } catch (e: any) {
      return { ok: false, detail: String(e?.message ?? e) };
    }
  }
}
