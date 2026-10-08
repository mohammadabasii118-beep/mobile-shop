import { Protocol } from '@prisma/client';
import { CreateServiceRequest, InboundInfo, ProviderError, RenewServiceRequest, ServiceConfig, ServiceRef, ServiceStatus, VpnProvider } from '../types';
import { XuiClient } from './client';
import { RawInbound, buildLink, parseSettings } from './link';

export interface XuiProviderOptions {
  client: XuiClient;
  publicHost: string; // host to place in generated links when inbound has no domain
  subBaseUrl?: string; // e.g. https://sub.example.com:2096/sub/
}

const PROTO: Record<Protocol, string> = { VLESS: 'vless', VMESS: 'vmess', TROJAN: 'trojan', SHADOWSOCKS: 'shadowsocks' };

/** The key 3x-ui uses to address a client inside an inbound (updateClient/delClient). */
export const clientKey = (protocol: Protocol, credential: string, email: string) =>
  protocol === 'TROJAN' ? credential : protocol === 'SHADOWSOCKS' ? email : credential;

/** The credential the PANEL really has for this client (the DB copy can lag behind after a link rotation). */
const panelCredential = (protocol: Protocol, c: Record<string, any>): string => String((protocol === 'TROJAN' || protocol === 'SHADOWSOCKS' ? c.password : c.id) ?? '');

export class XuiVpnProvider implements VpnProvider {
  readonly name = 'xui';
  constructor(private o: XuiProviderOptions) {}

  private async inboundOrThrow(id: number, protocol?: Protocol): Promise<RawInbound> {
    const ib = await this.o.client.getInbound(id);
    if (!ib) throw new ProviderError(`inbound ${id} not found`, false);
    if (!ib.enable) throw new ProviderError(`inbound ${id} is disabled`, false);
    if (protocol && ib.protocol !== PROTO[protocol]) throw new ProviderError(`inbound ${id} protocol is ${ib.protocol}, expected ${PROTO[protocol]}`, false);
    return ib;
  }

  private findClient(ib: RawInbound, email: string): Record<string, any> | undefined {
    const clients: Record<string, any>[] = parseSettings(ib).clients ?? [];
    return clients.find((c) => c.email === email);
  }

  private toStatus(c: Record<string, any> | undefined, t: { up: number; down: number; total: number; expiryTime: number; enable: boolean } | null): ServiceStatus {
    if (!c && !t) return { exists: false, enabled: false, expiresAt: null, trafficLimit: 0n, up: 0n, down: 0n, used: 0n };
    const up = BigInt(Math.round(t?.up ?? 0));
    const down = BigInt(Math.round(t?.down ?? 0));
    const expiry = t?.expiryTime ?? c?.expiryTime ?? 0;
    return {
      exists: true,
      enabled: t?.enable ?? c?.enable ?? true,
      expiresAt: expiry > 0 ? new Date(expiry) : null,
      trafficLimit: BigInt(Math.round(t?.total ?? c?.totalGB ?? 0)),
      up, down, used: up + down,
    };
  }

  async getInbound(id: number): Promise<InboundInfo | null> {
    const ib = await this.o.client.getInbound(id);
    return ib ? { id: ib.id, enable: ib.enable, protocol: ib.protocol, port: ib.port, remark: ib.remark } : null;
  }

  async listInbounds(): Promise<InboundInfo[]> {
    const list = await this.o.client.listInbounds();
    return (list ?? []).map((ib) => ({ id: ib.id, enable: ib.enable, protocol: ib.protocol, port: ib.port, remark: ib.remark })).sort((a, b) => a.id - b.id);
  }

  async createService(req: CreateServiceRequest) {
    const ib = await this.inboundOrThrow(req.inboundId, req.protocol);
    const existing = this.findClient(ib, req.email);
    if (existing) {
      const cred = req.protocol === 'TROJAN' || req.protocol === 'SHADOWSOCKS' ? existing.password : existing.id;
      if (cred !== req.credential) throw new ProviderError(`a different client already uses email ${req.email}`, false);
      return { status: await this.status(req), adopted: true };
    }
    const client: Record<string, unknown> = {
      email: req.email,
      limitIp: 0,
      totalGB: Number(req.trafficLimitBytes), // 3x-ui stores BYTES in "totalGB"
      expiryTime: req.expiresAt.getTime(), // epoch ms
      enable: true,
      tgId: req.telegramId,
      subId: req.subId,
      comment: (req.comment ?? 'telegram-vpn-bot').slice(0, 120),
      reset: 0,
    };
    if (req.protocol === 'VLESS' || req.protocol === 'VMESS') client.id = req.credential;
    else client.password = req.credential;
    if (req.protocol === 'VLESS') {
      const f = (parseSettings(ib).clients?.[0]?.flow as string | undefined) ?? '';
      if (f) client.flow = f; // inherit the inbound's flow (e.g. xtls-rprx-vision) so Reality works
    }
    if (req.protocol === 'SHADOWSOCKS') client.method = '';
    await this.o.client.addClient(req.inboundId, client);

    // verify it really exists
    const after = await this.inboundOrThrow(req.inboundId, req.protocol);
    if (!this.findClient(after, req.email)) throw new ProviderError('client not found after creation', true);
    return { status: await this.status(req), adopted: false };
  }

  private async status(ref: ServiceRef): Promise<ServiceStatus> {
    const ib = await this.o.client.getInbound(ref.inboundId);
    const c = ib ? this.findClient(ib, ref.email) : undefined;
    const t = await this.o.client.clientTraffic(ref.email).catch(() => null);
    return this.toStatus(c, t ?? ib?.clientStats?.find((s) => s.email === ref.email) ?? null);
  }

  async renewService(req: RenewServiceRequest): Promise<ServiceStatus> {
    const ib = await this.inboundOrThrow(req.inboundId, req.protocol);
    const c = this.findClient(ib, req.email);
    if (!c) throw new ProviderError('client to renew does not exist in panel', false);
    const updated = { ...c, totalGB: Number(req.trafficLimitBytes), expiryTime: req.expiresAt.getTime(), enable: true };
    await this.o.client.updateClient(req.inboundId, clientKey(req.protocol, panelCredential(req.protocol, c) || req.credential, req.email), updated);
    const s = await this.status(req);
    if (!s.exists || s.expiresAt?.getTime() !== req.expiresAt.getTime()) throw new ProviderError('renewal not reflected in panel', true);
    return s;
  }

  private async setEnabled(ref: ServiceRef, enable: boolean) {
    const ib = await this.inboundOrThrow(ref.inboundId);
    const c = this.findClient(ib, ref.email);
    if (!c) throw new ProviderError('client does not exist in panel', false);
    await this.o.client.updateClient(ref.inboundId, clientKey(ref.protocol, panelCredential(ref.protocol, c) || ref.credential, ref.email), { ...c, enable });
  }
  suspendService(ref: ServiceRef) { return this.setEnabled(ref, false); }
  resumeService(ref: ServiceRef) { return this.setEnabled(ref, true); }

  async deleteService(ref: ServiceRef) {
    const ib = await this.o.client.getInbound(ref.inboundId);
    const c = ib ? this.findClient(ib, ref.email) : undefined;
    if (!c) return; // already gone
    await this.o.client.delClient(ref.inboundId, clientKey(ref.protocol, panelCredential(ref.protocol, c) || ref.credential, ref.email));
  }

  async rotateLink(ref: ServiceRef, next: { credential: string; subId: string }) {
    const ib = await this.inboundOrThrow(ref.inboundId, ref.protocol);
    const c = this.findClient(ib, ref.email);
    if (!c) throw new ProviderError('client does not exist in panel', false);
    const credField = ref.protocol === 'TROJAN' || ref.protocol === 'SHADOWSOCKS' ? 'password' : 'id';
    if (c[credField] === next.credential && c.subId === next.subId) return; // a previous attempt already applied it
    await this.o.client.updateClient(ref.inboundId, clientKey(ref.protocol, panelCredential(ref.protocol, c) || ref.credential, ref.email), { ...c, [credField]: next.credential, subId: next.subId });
    const after = this.findClient(await this.inboundOrThrow(ref.inboundId, ref.protocol), ref.email);
    if (!after || after[credField] !== next.credential || after.subId !== next.subId) throw new ProviderError('link change not reflected in panel', true);
  }

  async getServiceStatus(ref: ServiceRef) {
    const s = await this.status(ref);
    return s.exists ? s : null;
  }

  async getTraffic(ref: ServiceRef) {
    const t = await this.o.client.clientTraffic(ref.email);
    if (!t) return null;
    const up = BigInt(Math.round(t.up)), down = BigInt(Math.round(t.down));
    return { up, down, used: up + down, total: BigInt(Math.round(t.total)) };
  }

  async getConfig(ref: ServiceRef & { subId: string; remark?: string }): Promise<ServiceConfig> {
    const ib = await this.inboundOrThrow(ref.inboundId);
    const client = this.findClient(ib, ref.email);
    if (!client) throw new ProviderError('client does not exist in panel', false);
    const config = buildLink({ inbound: ib, client, host: this.o.publicHost, remark: ref.remark ?? ref.email });
    const subscriptionUrl = this.o.subBaseUrl && (client.subId ?? ref.subId) ? `${this.o.subBaseUrl.replace(/\/+$/, '')}/${client.subId ?? ref.subId}` : undefined;
    return { config, subscriptionUrl };
  }

  async healthCheck() {
    try {
      const list = await this.o.client.listInbounds();
      return { ok: true, detail: `connected, ${list.length} inbound(s)` };
    } catch (e: any) {
      return { ok: false, detail: String(e?.message ?? e) };
    }
  }
}
