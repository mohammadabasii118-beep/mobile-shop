import http from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client';
import { createBot } from '../src/bot';
import { createServer } from '../src/server';
import { FakeXui } from '../dev/fakeXui';
import { XuiClient } from '../src/providers/vpn/xui/client';
import { XuiVpnProvider } from '../src/providers/vpn/xui/provider';
import { setVpnProvider } from '../src/providers/vpn';
import { hmacSha256 } from '../src/utils/misc';
import { makeProduct, resetDb } from './helpers';
import { resetEnvCache } from '../src/config/env';
import { setSetting } from '../src/modules/settings/service';

const USER = 5001, USER2 = 5002, ADMIN = 9000, STRANGER = 5003;
let panel: FakeXui;
let api: { method: string; payload: any }[] = [];
let bot: ReturnType<typeof createBot>;
let web: http.Server;
let webUrl: string;
let uid = 1;

beforeAll(async () => {
  process.env.BANK_WEBHOOK_SECRET = 'whsec';
  resetEnvCache();
  panel = await new FakeXui().start();
  web = createServer().listen(0, '127.0.0.1');
  await new Promise((r) => web.once('listening', r));
  webUrl = `http://127.0.0.1:${(web.address() as AddressInfo).port}`;
});
afterAll(async () => { await panel.stop(); web.close(); });

beforeEach(async () => {
  await resetDb();
  process.env.BANK_WEBHOOK_SECRET = 'whsec'; resetEnvCache();
  panel.inbounds.get(1)!.settings.clients = []; panel.inbounds.get(1)!.traffic = {};
  // REAL XuiVpnProvider talking HTTP to the fake panel (no mock provider in the e2e)
  setVpnProvider(new XuiVpnProvider({ client: new XuiClient({ baseUrl: panel.url, username: 'admin', password: 'secret' }), publicHost: 'vpn.example.com', subBaseUrl: 'https://sub.example.com:2096/sub/' }));
  api = [];
  bot = createBot('123:TEST', { botInfo: { id: 123, is_bot: true, first_name: 'Bot', username: 'bot', can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false, allows_users_to_create_topics: false } as any, fetchFile: async () => Buffer.from(`img-${Math.random()}`) });
  bot.api.config.use(async (_prev, method, payload) => {
    api.push({ method, payload });
    const msg = { message_id: api.length, date: 0, chat: { id: (payload as any).chat_id ?? 1, type: 'private' }, text: (payload as any).text };
    return { ok: true, result: method.startsWith('send') || method.startsWith('edit') ? msg : true } as any;
  });
});

const from = (id: number) => ({ id, is_bot: false, first_name: `U${id}`, username: `u${id}` });
const chat = (id: number) => ({ id, type: 'private' as const });
async function say(id: number, text: string) {
  const entities = text.startsWith('/') ? [{ type: 'bot_command' as const, offset: 0, length: text.split(' ')[0].length }] : undefined;
  await bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, chat: chat(id), from: from(id), text, entities } } as any);
}
async function tap(id: number, data: string) {
  await bot.handleUpdate({ update_id: uid++, callback_query: { id: String(uid), from: from(id), chat_instance: 'x', data, message: { message_id: 1, date: 0, chat: chat(id), text: 'x' } } } as any);
}
async function photo(id: number, caption?: string) {
  await bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, chat: chat(id), from: from(id), photo: [{ file_id: `file-${uid}`, file_unique_id: 'u', width: 1, height: 1 }], caption } } as any);
}
const texts = () => api.filter((c) => c.method === 'sendMessage' || c.method === 'editMessageText').map((c) => String(c.payload.text));
const lastText = () => texts().at(-1) ?? '';
const buttons = () => api.flatMap((c) => (c.payload?.reply_markup?.inline_keyboard ?? []).flat().map((b: any) => b.callback_data)).filter(Boolean) as string[];
async function postBankTx(body: object, secret = 'whsec') {
  const raw = JSON.stringify(body);
  return fetch(`${webUrl}/webhooks/bank-transactions`, { method: 'POST', body: raw, headers: { 'content-type': 'application/json', 'x-signature': hmacSha256(secret, raw) } });
}

async function buyUntilInstructions(userId: number, productId: string) {
  await say(userId, '/start');
  await tap(userId, 'menu:buy');
  await tap(userId, `buy:${productId}`);
  api = [];
  await tap(userId, `bo:${productId}`);
  const order = await prisma.order.findFirstOrThrow({ where: { user: { telegramId: BigInt(userId) } }, orderBy: { createdAt: 'desc' } });
  return order;
}

describe('E2E: Telegram → order → card-to-card → verification → X-UI → delivery', () => {
  it('full automatic flow with a verified bank transaction (admin offline)', async () => {
    const product = await makeProduct({ name: 'پلن ۵۰ گیگ' });
    const order = await buyUntilInstructions(USER, product.id);
    expect(lastText()).toContain('6037991122334455');
    expect(lastText()).toContain('۲۵۰٬۰۰۰'.replace('٬', ',')); // exact amount shown
    expect(buttons()).toContain(`rc:${order.id}`);

    // real money arrives at the bank → signed webhook feeds the ledger
    const r = await postBankTx({ trackingCode: '556677889', amount: 2_500_000, unit: 'IRR', destination: '6037991122334455', occurredAt: new Date().toISOString() });
    expect(r.status).toBe(200);

    await tap(USER, `rc:${order.id}`);
    await photo(USER, 'کد پیگیری: 556677889');

    // verified + low risk => auto approved, client created in X-UI, link delivered
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.status).toBe('FULFILLED');
    const pay = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(pay).toMatchObject({ status: 'APPROVED', autoApproved: true, verificationStatus: 'VERIFIED', riskLevel: 'LOW' });

    expect(panel.clientCount()).toBe(1);
    const client = panel.inbounds.get(1)!.settings.clients[0];
    const svc = await prisma.vpnService.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(client).toMatchObject({ id: svc.uuid, email: svc.externalId, totalGB: 50 * 1024 ** 3, enable: true, tgId: String(USER) });
    expect(Math.abs(client.expiryTime - svc.expiresAt.getTime())).toBeLessThan(1000);
    expect(svc.config).toContain(`vless://${svc.uuid}@vpn.example.com:443`);
    expect(svc.config).toContain('pbk=PUBKEY123');
    expect(svc.subscriptionUrl).toBe(`https://sub.example.com:2096/sub/${svc.subId}`);

    const delivery = api.find((c) => c.method === 'sendMessage' && c.payload.chat_id === USER && String(c.payload.text).includes('پرداخت شما تأیید شد') && String(c.payload.text).includes('vless://'));
    expect(delivery).toBeTruthy();
    expect(String(delivery!.payload.text)).toContain(svc.config!);
    expect(JSON.stringify(delivery!.payload.reply_markup)).toContain('sv:qr:');

    // QR for the real config, my services, link
    api = [];
    await tap(USER, `sv:qr:${svc.id}`);
    expect(api.some((c) => c.method === 'sendPhoto')).toBe(true);
    await tap(USER, 'menu:services');
    expect(buttons()).toContain(`sv:v:${svc.id}`);
    await tap(USER, `sv:v:${svc.id}`);
    expect(lastText()).toContain('مصرف‌شده');
    expect(await prisma.auditLog.count({ where: { action: 'payment.auto_approve' } })).toBe(1);
  });

  it('no verification => queued for admin; admin approves from the bot; double tap creates ONE client', async () => {
    const product = await makeProduct();
    const order = await buyUntilInstructions(USER, product.id);
    await tap(USER, `rc:${order.id}`);
    await photo(USER); // no caption → asks for tracking code
    expect(lastText()).toContain('کد پیگیری');
    await say(USER, '۱۲۳۴۵۶۷۸۹۰'); // Persian digits
    const pay = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(pay.status).toBe('NEEDS_REVIEW');
    expect(pay.trackingCode).toBe('1234567890');
    expect(panel.clientCount()).toBe(0);
    expect(api.some((c) => c.payload.chat_id === ADMIN && String(c.payload.text).includes('نیازمند بررسی'))).toBe(true);

    api = [];
    await tap(ADMIN, `ap:v:${pay.id}`);
    expect(lastText()).toContain('ریسک');
    await tap(ADMIN, `ap:ok2:${pay.id}`);
    await tap(ADMIN, `ap:ok2:${pay.id}`); // replayed callback
    await tap(ADMIN, `ap:ok2:${pay.id}`);
    expect(panel.clientCount()).toBe(1);
    expect(await prisma.vpnService.count()).toBe(1);
    expect(texts().some((t) => t.includes('قبلاً پردازش شده'))).toBe(true);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('FULFILLED');
  });

  it('admin can reject with a reason; user is told and can resubmit', async () => {
    const product = await makeProduct();
    const order = await buyUntilInstructions(USER, product.id);
    await tap(USER, `rc:${order.id}`);
    await say(USER, 'tracking 98765432');
    const pay = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    await tap(ADMIN, `ap:no:${pay.id}`);
    await say(ADMIN, 'مبلغ اشتباه');
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } })).status).toBe('REJECTED');
    expect(api.some((c) => c.payload.chat_id === USER && String(c.payload.text).includes('مبلغ اشتباه'))).toBe(true);
    expect(panel.clientCount()).toBe(0);
  });

  it('X-UI down after approval: user gets nothing fake, admin gets alert, auto-retry delivers once', async () => {
    const product = await makeProduct();
    const order = await buyUntilInstructions(USER, product.id);
    await tap(USER, `rc:${order.id}`);
    await say(USER, 'ref 55555555');
    const pay = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    panel.failNext = 100;
    await tap(ADMIN, `ap:ok2:${pay.id}`);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PROVISIONING');
    expect(api.some((c) => c.payload.chat_id === ADMIN && String(c.payload.text).includes('VPN provisioning failed'))).toBe(true);
    expect(api.some((c) => c.payload.chat_id === USER && String(c.payload.text).includes('vless://'))).toBe(false);
    panel.failNext = 0;
    await tap(ADMIN, `av:retry:${order.id}`);
    expect(panel.clientCount()).toBe(1);
    expect(api.some((c) => c.payload.chat_id === USER && String(c.payload.text).includes('vless://'))).toBe(true);
  });

  it('timeout after panel created the client => retry adopts it (no 2nd client)', async () => {
    const product = await makeProduct();
    const order = await buyUntilInstructions(USER, product.id);
    await tap(USER, `rc:${order.id}`);
    await say(USER, 'ref 66666666');
    const pay = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    panel.dropNextAddClientResponse = true;
    await tap(ADMIN, `ap:ok2:${pay.id}`);
    expect(panel.clientCount()).toBe(1); // panel applied it, response lost
    await tap(ADMIN, `av:retry:${order.id}`);
    expect(panel.clientCount()).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('FULFILLED');
  });

  it('renewal via bot reuses the same X-UI client', async () => {
    const product = await makeProduct();
    const order = await buyUntilInstructions(USER, product.id);
    await tap(USER, `rc:${order.id}`); await say(USER, 'ref 77777777');
    await tap(ADMIN, `ap:ok2:${(await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } })).id}`);
    const svc = await prisma.vpnService.findFirstOrThrow();
    await tap(USER, `sv:renew:${svc.id}`);
    expect(buttons()).toContain(`rn:${svc.id}:${product.id}`);
    await tap(USER, `rn:${svc.id}:${product.id}`);
    const ro = await prisma.order.findFirstOrThrow({ where: { renewalOfServiceId: svc.id } });
    await tap(USER, `rc:${ro.id}`); await say(USER, 'ref 88888888');
    await tap(ADMIN, `ap:ok2:${(await prisma.payment.findFirstOrThrow({ where: { orderId: ro.id } })).id}`);
    expect(panel.clientCount()).toBe(1);
    expect(panel.inbounds.get(1)!.settings.clients[0].totalGB).toBe(100 * 1024 ** 3);
    expect((await prisma.vpnService.findUniqueOrThrow({ where: { id: svc.id } })).expiresAt.getTime() - svc.expiresAt.getTime()).toBe(30 * 86_400_000);
  });
});

describe('E2E security', () => {
  it('non-admins cannot open admin panel or fire admin callbacks (even with valid ids)', async () => {
    const product = await makeProduct();
    const order = await buyUntilInstructions(USER, product.id);
    await tap(USER, `rc:${order.id}`); await say(USER, 'ref 11112222');
    const pay = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    api = [];
    await say(STRANGER, '/admin');
    expect(lastText()).toContain('دسترسی غیرمجاز');
    await tap(USER, `ap:ok2:${pay.id}`); // the buyer tries to approve their own payment
    await tap(STRANGER, `ap:ok2:${pay.id}`);
    await tap(STRANGER, 'adm:settings');
    await tap(STRANGER, `av:del:${pay.id}`);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } })).status).toBe('NEEDS_REVIEW');
    expect(panel.clientCount()).toBe(0);
    expect(texts().filter((t) => t.includes('دسترسی غیرمجاز')).length).toBeGreaterThanOrEqual(4);
  });

  it('limited admin roles: SUPPORT_ADMIN cannot approve payments or delete services', async () => {
    await prisma.admin.create({ data: { telegramId: 7001n, role: 'SUPPORT_ADMIN' } });
    const product = await makeProduct();
    const order = await buyUntilInstructions(USER, product.id);
    await tap(USER, `rc:${order.id}`); await say(USER, 'ref 33334444');
    const pay = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    await tap(7001, `ap:ok2:${pay.id}`);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } })).status).toBe('NEEDS_REVIEW');
    await say(7001, '/admin');
    expect(buttons()).not.toContain('adm:settings');
    expect(buttons()).toContain('adm:tickets');
  });

  it("user cannot access another user's service, order, receipt flow or ticket via crafted callbacks", async () => {
    const product = await makeProduct();
    const order = await buyUntilInstructions(USER, product.id);
    await tap(USER, `rc:${order.id}`); await say(USER, 'ref 99990000');
    await tap(ADMIN, `ap:ok2:${(await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } })).id}`);
    const svc = await prisma.vpnService.findFirstOrThrow();
    await say(USER2, '/start');
    api = [];
    await tap(USER2, `sv:link:${svc.id}`);
    await tap(USER2, `sv:qr:${svc.id}`);
    await tap(USER2, `ov:${order.id}`);
    await tap(USER2, `oc:${order.id}`);
    expect(api.some((c) => c.method === 'sendPhoto')).toBe(false);
    expect(texts().join('\n')).not.toContain('vless://');
    expect(texts().filter((t) => t.includes('دسترسی غیرمجاز')).length).toBe(4);
  });

  it('callback replay: tapping "pay/submit" twice does not double-submit', async () => {
    const product = await makeProduct();
    const order = await buyUntilInstructions(USER, product.id);
    await tap(USER, `rc:${order.id}`);
    await say(USER, 'ref 12121212');
    await tap(USER, `rc:${order.id}`); // stale button
    expect(lastText()).toContain('رسیدی قابل ثبت نیست');
    expect(await prisma.payment.count()).toBe(1);
  });

  it('bank webhook requires a valid HMAC signature and is idempotent', async () => {
    const body = { trackingCode: '13131313', amount: 1000, occurredAt: new Date().toISOString() };
    expect((await postBankTx(body, 'wrong')).status).toBe(401);
    expect((await fetch(`${webUrl}/webhooks/bank-transactions`, { method: 'POST', body: '{}' })).status).toBe(401);
    expect((await postBankTx(body)).status).toBe(200);
    expect(await (await postBankTx(body)).json()).toMatchObject({ created: false });
    expect(await prisma.bankTransaction.count()).toBe(1);
    expect((await postBankTx({ amount: -5 })).status).toBe(400);
    const h = (await (await fetch(`${webUrl}/health`)).json()) as { ok: boolean };
    expect(h.ok).toBe(true);
  });

  it('crypto is not offered while no verifier is configured', async () => {
    await setSetting('crypto.enabled', 'true');
    const product = await makeProduct();
    const { createOrder } = await import('../src/modules/orders/service');
    const u = await prisma.user.create({ data: { telegramId: 4040n } });
    await expect(createOrder({ userId: u.id, productId: product.id, paymentMethod: 'CRYPTO' })).rejects.toThrow(/فعال نیست/);
  });
});
