import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeXui } from '../dev/fakeXui';
import { XuiClient } from '../src/providers/vpn/xui/client';
import { XuiVpnProvider } from '../src/providers/vpn/xui/provider';
import { buildLink } from '../src/providers/vpn/xui/link';
import { ProviderError, ServiceRef } from '../src/providers/vpn/types';
import { GB } from '../src/utils/misc';

let panel: FakeXui;
beforeEach(async () => { panel = await new FakeXui().start(); });
afterEach(async () => { await panel.stop(); });

const mk = (o: Partial<ConstructorParameters<typeof XuiClient>[0]> = {}, sub?: string) =>
  new XuiVpnProvider({ client: new XuiClient({ baseUrl: panel.url, username: 'admin', password: 'secret', ...o }), publicHost: 'vpn.example.com', subBaseUrl: sub });
const ref: ServiceRef = { inboundId: 1, email: 'tg_1_vpn-test', credential: '11111111-2222-4333-8444-555555555555', protocol: 'VLESS' };
const req = (over = {}) => ({ ...ref, subId: 'subabc123', telegramId: '42', trafficLimitBytes: 50n * GB, expiresAt: new Date(Date.now() + 30 * 86_400_000), ...over });

describe('X-UI authentication', () => {
  it('logs in with cookie session; wrong credentials fail without leaking the password', async () => {
    expect((await mk().healthCheck()).ok).toBe(true);
    const bad = await mk({ password: 'topsecret-wrong' }).healthCheck();
    expect(bad.ok).toBe(false);
    expect(bad.detail).not.toContain('topsecret-wrong');
  });
  it('supports Bearer API token (no /login call)', async () => {
    panel.apiToken = 'tok-123';
    const p = mk({ username: undefined, password: undefined, apiToken: 'tok-123' });
    expect((await p.healthCheck()).ok).toBe(true);
    expect(panel.logins).toBe(0);
    expect((await mk({ username: undefined, password: undefined, apiToken: 'bad' }).healthCheck()).ok).toBe(false);
  });
  it('re-logins transparently when the session is rejected (panel answers 404)', async () => {
    const p = mk();
    await p.healthCheck();
    const c: any = (p as any).o.client;
    c.cookie = '3x-ui=expired';
    expect((await p.healthCheck()).ok).toBe(true);
    expect(panel.logins).toBe(2);
  });
  it('re-logins when an expired session is answered with HTTP 200 + HTML login page', async () => {
    const p = mk();
    await p.healthCheck();
    const logins = panel.logins;
    (p as any).o.client.cookie = '3x-ui=expired';
    panel.unauthHtml = true;
    expect((await p.healthCheck()).ok).toBe(true);
    expect(panel.logins).toBe(logins + 1);
    panel.unauthHtml = false;
  });
  it('non-JSON answer that persists after re-login is reported with a clear hint', async () => {
    const f = (async () => new Response('<html>nginx</html>', { status: 200 })) as unknown as typeof fetch;
    const c = new XuiClient({ baseUrl: 'http://x', apiToken: 'tok', fetchImpl: f });
    await expect(c.listInbounds()).rejects.toThrow(/non-JSON/);
  });
  it('transient network resets are retried transparently', async () => {
    let n = 0;
    const real = fetch;
    const flaky = (async (u: any, i: any) => { if (n++ < 2) throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }); return real(u, i); }) as unknown as typeof fetch;
    const p = new XuiVpnProvider({ client: new XuiClient({ baseUrl: panel.url, username: 'admin', password: 'secret', fetchImpl: flaky }), publicHost: 'h' });
    expect((await p.healthCheck()).ok).toBe(true);
    expect(n).toBeGreaterThanOrEqual(3);
  });
  it('unreachable panel => retryable ProviderError', async () => {
    const dead = new XuiVpnProvider({ client: new XuiClient({ baseUrl: 'http://127.0.0.1:1', username: 'a', password: 'b', timeoutMs: 500 }), publicHost: 'x' });
    await expect(dead.getInbound(1)).rejects.toMatchObject({ retryable: true });
  });
});

describe('X-UI inbound + client lifecycle', () => {
  it('inbound lookup; missing and disabled inbounds are rejected', async () => {
    const p = mk();
    expect(await p.getInbound(1)).toMatchObject({ id: 1, protocol: 'vless', enable: true });
    expect(await p.getInbound(99)).toBeNull();
    await expect(p.createService(req({ inboundId: 99 }))).rejects.toThrow(/not found/);
    panel.inbounds.get(1)!.enable = false;
    await expect(p.createService(req())).rejects.toThrow(/disabled/);
    expect(panel.clientCount()).toBe(0);
  });
  it('protocol mismatch is rejected', async () => {
    await expect(mk().createService(req({ protocol: 'TROJAN' }))).rejects.toThrow(/protocol/);
  });
  it('creates a client with bytes, epoch-ms expiry, tgId, subId and verifies it', async () => {
    const r = req();
    const { status, adopted } = await mk().createService(r);
    expect(adopted).toBe(false);
    const c = panel.inbounds.get(1)!.settings.clients[0];
    expect(c).toMatchObject({ id: ref.credential, email: ref.email, totalGB: 50 * 1024 ** 3, expiryTime: r.expiresAt.getTime(), enable: true, tgId: '42', subId: 'subabc123' });
    expect(status.exists && status.enabled).toBe(true);
    expect(status.trafficLimit).toBe(50n * GB);
    expect(status.expiresAt!.getTime()).toBe(r.expiresAt.getTime());
  });
  it('response lost after panel applied addClient => retry adopts, no duplicate client', async () => {
    const p = mk();
    panel.dropNextAddClientResponse = true;
    await expect(p.createService(req())).rejects.toBeInstanceOf(ProviderError);
    expect(panel.clientCount()).toBe(1);
    const again = await p.createService(req());
    expect(again.adopted).toBe(true);
    expect(panel.clientCount()).toBe(1);
  });
  it('same email with different uuid is refused (no silent hijack)', async () => {
    const p = mk();
    await p.createService(req());
    await expect(p.createService(req({ credential: '99999999-2222-4333-8444-555555555555' }))).rejects.toThrow(/different client/);
  });
  it('traffic + status come from the panel', async () => {
    const p = mk();
    await p.createService(req());
    panel.addUsage(ref.email, 1_000_000, 2_000_000);
    expect(await p.getTraffic(ref)).toMatchObject({ used: 3_000_000n, total: 50n * GB });
    expect((await p.getServiceStatus(ref))!.used).toBe(3_000_000n);
    expect(await p.getTraffic({ ...ref, email: 'nobody' })).toBeNull();
    expect(await p.getServiceStatus({ ...ref, email: 'nobody' })).toBeNull();
  });
  it('renew updates expiry/traffic on the existing client and re-enables it', async () => {
    const p = mk();
    await p.createService(req());
    await p.suspendService(ref);
    expect(panel.inbounds.get(1)!.settings.clients[0].enable).toBe(false);
    const exp = new Date(Date.now() + 60 * 86_400_000);
    const s = await p.renewService({ ...ref, trafficLimitBytes: 100n * GB, expiresAt: exp });
    expect(panel.clientCount()).toBe(1);
    expect(s.expiresAt!.getTime()).toBe(exp.getTime());
    expect(s.trafficLimit).toBe(100n * GB);
    expect(s.enabled).toBe(true);
    await p.resumeService(ref);
  });
  it('delete removes the client; deleting twice is harmless', async () => {
    const p = mk();
    await p.createService(req());
    await p.deleteService(ref); await p.deleteService(ref);
    expect(panel.clientCount()).toBe(0);
  });
  it('trojan clients are addressed by password', async () => {
    panel.inbounds.set(2, { id: 2, enable: true, protocol: 'trojan', port: 8443, remark: 't', listen: '', settings: { clients: [] }, streamSettings: { network: 'tcp', security: 'tls', tlsSettings: { serverName: 'tj.example.com', alpn: ['h2', 'http/1.1'] } }, traffic: {} });
    const p = mk();
    const t: ServiceRef = { inboundId: 2, email: 'tg_2_t', credential: 'pw_abcDEF123', protocol: 'TROJAN' };
    await p.createService({ ...req(), ...t });
    expect(panel.inbounds.get(2)!.settings.clients[0].password).toBe('pw_abcDEF123');
    await p.renewService({ ...t, trafficLimitBytes: 1n * GB, expiresAt: new Date(Date.now() + 86_400_000) });
    const cfg = await p.getConfig({ ...t, subId: 'subabc123' });
    expect(cfg.config).toBe('trojan://pw_abcDEF123@vpn.example.com:8443?type=tcp&security=tls&sni=tj.example.com&alpn=h2%2Chttp%2F1.1#tg_2_t');
    await p.deleteService(t);
    expect(panel.inbounds.get(2)!.settings.clients).toHaveLength(0);
  });
});

describe('real config / subscription generation', () => {
  it('VLESS+Reality link is built from the real inbound settings', async () => {
    const p = mk({}, 'https://sub.example.com:2096/sub/');
    await p.createService(req());
    const cfg = await p.getConfig({ ...ref, subId: 'subabc123' });
    expect(cfg.config).toBe(`vless://${ref.credential}@vpn.example.com:443?type=tcp&security=reality&sni=www.example.com&fp=chrome&pbk=PUBKEY123&sid=ab12cd34&spx=%2F&encryption=none#tg_1_vpn-test`);
    expect(cfg.subscriptionUrl).toBe('https://sub.example.com:2096/sub/subabc123');
  });
  it('no subscription URL unless a subscription base is configured', async () => {
    const p = mk();
    await p.createService(req());
    expect((await p.getConfig({ ...ref, subId: 'subabc123' })).subscriptionUrl).toBeUndefined();
  });
  it('VLESS ws+tls and VMess builders', () => {
    const ib: any = { id: 5, enable: true, protocol: 'vless', port: 2053, listen: '', settings: { clients: [] }, streamSettings: { network: 'ws', security: 'tls', wsSettings: { path: '/ws', headers: { Host: 'cdn.example.com' } }, tlsSettings: { serverName: 'cdn.example.com', alpn: ['h2'], settings: { fingerprint: 'firefox' } } } };
    const l = buildLink({ inbound: ib, client: { id: 'u1' }, host: 'h.example.com', remark: 'r1' });
    expect(l).toBe('vless://u1@h.example.com:2053?type=ws&path=%2Fws&host=cdn.example.com&security=tls&sni=cdn.example.com&fp=firefox&alpn=h2&encryption=none#r1');
    const vm = buildLink({ inbound: { ...ib, protocol: 'vmess' }, client: { id: 'u2' }, host: 'h.example.com', remark: 'r2' });
    const j = JSON.parse(Buffer.from(vm.slice('vmess://'.length), 'base64').toString());
    expect(j).toMatchObject({ v: '2', add: 'h.example.com', port: '2053', id: 'u2', net: 'ws', path: '/ws', host: 'cdn.example.com', tls: 'tls', sni: 'cdn.example.com', ps: 'r2' });
  });
  it('externalProxy overrides host/port; unsupported data fails instead of faking', () => {
    const ib: any = { id: 1, enable: true, protocol: 'vless', port: 443, settings: {}, streamSettings: { network: 'tcp', security: 'none', externalProxy: [{ dest: 'edge.example.com', port: 8443 }] } };
    expect(buildLink({ inbound: ib, client: { id: 'u' }, host: 'h', remark: 'r' })).toContain('@edge.example.com:8443');
    expect(() => buildLink({ inbound: ib, client: {}, host: 'h', remark: 'r' })).toThrow(/no id/);
  });
});
