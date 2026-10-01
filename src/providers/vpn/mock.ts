import { CreateServiceRequest, ProviderError, RenewServiceRequest, ServiceConfig, ServiceRef, ServiceStatus, VpnProvider } from './types';

interface MockClient extends CreateServiceRequest { enabled: boolean; up: bigint; down: bigint }

/** TEST/DEMO ONLY. Refused in production by loadEnv(). Config links are clearly marked as mock. */
export class MockVpnProvider implements VpnProvider {
  readonly name = 'mock';
  clients = new Map<string, MockClient>();
  failNext = 0;
  createCalls = 0;
  inbounds = new Map<number, { enable: boolean; protocol: string }>([[1, { enable: true, protocol: 'vless' }]]);

  private maybeFail() {
    if (this.failNext > 0) { this.failNext--; throw new ProviderError('mock: panel unavailable', true); }
  }
  private st(c: MockClient): ServiceStatus {
    return { exists: true, enabled: c.enabled, expiresAt: c.expiresAt, trafficLimit: c.trafficLimitBytes, up: c.up, down: c.down, used: c.up + c.down };
  }
  async getInbound(id: number) {
    const i = this.inbounds.get(id);
    return i ? { id, enable: i.enable, protocol: i.protocol, port: 443 } : null;
  }
  async createService(req: CreateServiceRequest) {
    this.maybeFail();
    const ib = this.inbounds.get(req.inboundId);
    if (!ib || !ib.enable) throw new ProviderError('inbound missing/disabled', false);
    const ex = this.clients.get(req.email);
    if (ex) return { status: this.st(ex), adopted: true };
    this.createCalls++;
    const c: MockClient = { ...req, enabled: true, up: 0n, down: 0n };
    this.clients.set(req.email, c);
    return { status: this.st(c), adopted: false };
  }
  async renewService(req: RenewServiceRequest) {
    this.maybeFail();
    const c = this.clients.get(req.email);
    if (!c) throw new ProviderError('missing client', false);
    c.trafficLimitBytes = req.trafficLimitBytes; c.expiresAt = req.expiresAt; c.enabled = true;
    return this.st(c);
  }
  async suspendService(ref: ServiceRef) { this.maybeFail(); const c = this.clients.get(ref.email); if (c) c.enabled = false; }
  async resumeService(ref: ServiceRef) { this.maybeFail(); const c = this.clients.get(ref.email); if (c) c.enabled = true; }
  async deleteService(ref: ServiceRef) { this.clients.delete(ref.email); }
  async getServiceStatus(ref: ServiceRef) { const c = this.clients.get(ref.email); return c ? this.st(c) : null; }
  async getTraffic(ref: ServiceRef) { const c = this.clients.get(ref.email); return c ? { up: c.up, down: c.down, used: c.up + c.down, total: c.trafficLimitBytes } : null; }
  async getConfig(ref: ServiceRef & { subId: string; remark?: string }): Promise<ServiceConfig> {
    const c = this.clients.get(ref.email);
    if (!c) throw new ProviderError('missing client', false);
    return { config: `vless://${c.credential}@mock.invalid:443?type=tcp&security=none#${encodeURIComponent(ref.remark ?? ref.email)}`, subscriptionUrl: process.env.MOCK_SUB_BASE ? `${process.env.MOCK_SUB_BASE}/${ref.subId}` : undefined };
  }
  async healthCheck() { return { ok: true, detail: 'mock provider (non-production)' }; }
}
