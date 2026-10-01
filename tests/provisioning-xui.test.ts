import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client';
import { FakeXui } from '../dev/fakeXui';
import { XuiClient } from '../src/providers/vpn/xui/client';
import { XuiVpnProvider } from '../src/providers/vpn/xui/provider';
import { setVpnProvider } from '../src/providers/vpn';
import { approvePayment } from '../src/modules/payments/service';
import { retryDueProvisioning, runProvisioning } from '../src/modules/vpn/provisioning';
import { makeOrder, makeProduct, makeUser, resetDb, setup, submit } from './helpers';
import { runXuiCheck } from '../src/scripts/xuiCheck';
import { runPreflight } from '../src/scripts/preflight';

let panel: FakeXui;
let sent: ReturnType<typeof setup>['sent'];
beforeAll(async () => { panel = await new FakeXui().start(); });
afterAll(async () => { await panel.stop(); });
beforeEach(async () => {
  await resetDb();
  ({ sent } = setup());
  panel.inbounds.get(1)!.settings.clients = []; panel.inbounds.get(1)!.traffic = {}; panel.addClientCalls = 0;
  setVpnProvider(new XuiVpnProvider({ client: new XuiClient({ baseUrl: panel.url, username: 'admin', password: 'secret', timeoutMs: 2000 }), publicHost: 'vpn.example.com' }));
});

async function paid() {
  const u = await makeUser(); const p = await makeProduct(); const o = await makeOrder(u.id, p.id);
  const pay = await submit(u.id, o.id, { trackingCode: String(Math.floor(Math.random() * 9e8) + 1e8) });
  return { u, o, pay };
}
const due = (orderId: string) => prisma.provisioningTask.update({ where: { orderId }, data: { nextAttemptAt: new Date() } });

describe('provisioning against the X-UI HTTP adapter: idempotency + timeouts', () => {
  it('happy path persists everything and delivers once', async () => {
    const { o, pay } = await paid();
    await approvePayment(pay.id, { actor: 'a' });
    const svc = await prisma.vpnService.findUniqueOrThrow({ where: { orderId: o.id } });
    expect(svc).toMatchObject({ provisioningStatus: 'SUCCESS', status: 'ACTIVE', clientId: svc.uuid });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe('FULFILLED');
    expect(panel.clientCount()).toBe(1);
    expect(sent.filter((m) => m.text.includes('vless://'))).toHaveLength(1);
  });

  it('response lost AFTER addClient applied → retry adopts; exactly one client, one delivery', async () => {
    const { o, pay } = await paid();
    panel.dropNextAddClientResponse = true;
    await approvePayment(pay.id, { actor: 'a' });
    expect(panel.clientCount()).toBe(1);
    expect((await prisma.provisioningTask.findUniqueOrThrow({ where: { orderId: o.id } })).status).toBe('FAILED');
    expect(sent.some((m) => m.text.includes('vless://'))).toBe(false);
    await due(o.id); await retryDueProvisioning();
    expect(panel.clientCount()).toBe(1);
    expect(panel.addClientCalls).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe('FULFILLED');
    expect(sent.filter((m) => m.text.includes('vless://'))).toHaveLength(1);
  });

  it('panel dies right after addClient (verify step 503s) → no duplicate on retry', async () => {
    const { o, pay } = await paid();
    panel.failAfterAddClient = 1;
    await approvePayment(pay.id, { actor: 'a' });
    expect(panel.clientCount()).toBe(1);
    expect((await prisma.vpnService.findUniqueOrThrow({ where: { orderId: o.id } })).provisioningStatus).toBe('FAILED');
    await due(o.id); await retryDueProvisioning();
    expect(panel.clientCount()).toBe(1);
    expect(panel.addClientCalls).toBe(1);
    expect((await prisma.vpnService.findUniqueOrThrow({ where: { orderId: o.id } })).provisioningStatus).toBe('SUCCESS');
  });

  it('request timeout (slow panel) is retryable and does not duplicate', async () => {
    const { o, pay } = await paid();
    const slow = new XuiVpnProvider({ client: new XuiClient({ baseUrl: panel.url, username: 'admin', password: 'secret', timeoutMs: 1, fetchImpl: () => new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('x'), { name: 'TimeoutError' })), 5)) as any }), publicHost: 'h' });
    setVpnProvider(slow);
    await approvePayment(pay.id, { actor: 'a' });
    expect((await prisma.provisioningTask.findUniqueOrThrow({ where: { orderId: o.id } })).lastError).toContain('timeout');
    setVpnProvider(new XuiVpnProvider({ client: new XuiClient({ baseUrl: panel.url, username: 'admin', password: 'secret' }), publicHost: 'h' }));
    await due(o.id);
    await retryDueProvisioning();
    expect(panel.clientCount()).toBe(1);
  });

  it('concurrent provisioning runs + repeated approvals create one client', async () => {
    const { o, pay } = await paid();
    await Promise.all([approvePayment(pay.id, { actor: 'a' }), approvePayment(pay.id, { actor: 'b' }), runProvisioning(o.id), runProvisioning(o.id, { force: true })]);
    expect(panel.clientCount()).toBe(1);
    expect(panel.addClientCalls).toBe(1);
    expect(await prisma.vpnService.count()).toBe(1);
  });

  it('wrong panel credentials → failed provisioning with no secret in error/audit/notifications', async () => {
    const { o, pay } = await paid();
    setVpnProvider(new XuiVpnProvider({ client: new XuiClient({ baseUrl: panel.url, username: 'admin', password: 'WRONG-pass-123' }), publicHost: 'h' }));
    await approvePayment(pay.id, { actor: 'a' });
    const t = await prisma.provisioningTask.findUniqueOrThrow({ where: { orderId: o.id } });
    expect(t.status).toBe('FAILED');
    const blob = JSON.stringify([t, await prisma.auditLog.findMany(), sent], (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
    expect(blob).not.toContain('WRONG-pass-123');
  });
});

describe('xui:check tool', () => {
  const mk = (over = {}) => { const client = new XuiClient({ baseUrl: panel.url, username: 'admin', password: 'secret', ...over }); return { client, provider: new XuiVpnProvider({ client, publicHost: 'vpn.example.com', subBaseUrl: `${panel.url}/sub` }) }; };

  it('all capabilities pass and the test client is cleaned up', async () => {
    const { client, provider } = mk();
    const steps = await runXuiCheck(client, provider, 1);
    expect(steps.filter((s) => !s.ok)).toEqual([]);
    expect(steps.map((s) => s.name)).toEqual(expect.arrayContaining(['authentication + list inbounds', 'inbound lookup', 'create client', 'verify client exists', 'traffic (getClientTraffics)', 'expiry stored', 'renew (update expiry/traffic)', 'cleanup (delete test client)']));
    expect(panel.clientCount()).toBe(0);
  });
  it('reports auth failure and stops', async () => {
    const { client, provider } = mk({ password: 'nope' });
    const steps = await runXuiCheck(client, provider, 1);
    expect(steps).toHaveLength(1);
    expect(steps[0].ok).toBe(false);
  });
  it('reports missing / disabled inbound without creating anything', async () => {
    const { client, provider } = mk();
    expect((await runXuiCheck(client, provider, 42)).at(-1)).toMatchObject({ name: 'inbound lookup', ok: false });
    panel.inbounds.get(1)!.enable = false;
    expect((await runXuiCheck(client, provider, 1)).at(-1)!.detail).toContain('disabled');
    panel.inbounds.get(1)!.enable = true;
    expect(panel.addClientCalls).toBe(0);
  });
  it('cleans up even when a middle step fails', async () => {
    const { client, provider } = mk();
    const orig = provider.getTraffic.bind(provider);
    provider.getTraffic = async () => { throw new Error('traffic endpoint boom'); };
    const steps = await runXuiCheck(client, provider, 1);
    provider.getTraffic = orig;
    expect(steps.find((s) => s.name.startsWith('traffic'))!.ok).toBe(false);
    expect(steps.at(-1)).toMatchObject({ name: 'cleanup (delete test client)', ok: true });
    expect(panel.clientCount()).toBe(0);
  });
});

describe('preflight', () => {
  it('flags missing production env and passes a complete one', async () => {
    const bad = await runPreflight({ DATABASE_URL: 'postgresql://x:CHANGE_ME@h/db', NODE_ENV: 'production', CARD_TO_CARD_ENABLED: 'true' } as any, { network: false });
    const failed = bad.filter((c) => c.level === 'FAIL').map((c) => c.name);
    expect(failed).toEqual(expect.arrayContaining(['BOT_TOKEN', 'ADMIN_TELEGRAM_ID', 'DATABASE_URL', 'XUI_BASE_URL', 'X-UI credentials', 'CARD_NUMBER']));
    const good = await runPreflight({
      DATABASE_URL: 'postgresql://vpn:s3cret@db:5432/vpnbot', NODE_ENV: 'production', BOT_TOKEN: '123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', ADMIN_TELEGRAM_ID: '42',
      XUI_BASE_URL: 'https://panel.example.com:2053/abc', XUI_API_TOKEN: 'tok', CARD_TO_CARD_ENABLED: 'true', CARD_NUMBER: '6037991122334455', CARD_HOLDER: 'A', BANK_NAME: 'B',
      BANK_WEBHOOK_SECRET: 'x'.repeat(32), RECEIPT_DIR: './data/preflight-test',
    } as any, { network: false });
    expect(good.filter((c) => c.level === 'FAIL')).toEqual([]);
  });
});
