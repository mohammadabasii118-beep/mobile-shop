import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client';
import { FakeXui } from '../dev/fakeXui';
import { resetEnvCache } from '../src/config/env';
import { setVpnProvider } from '../src/providers/vpn';
import { decryptSecret, encryptSecret } from '../src/utils/secrets';
import { ROLE_PERMISSIONS } from '../src/modules/admin/rbac';
import { approvePayment } from '../src/modules/payments/service';
import { adminRenew, deleteService } from '../src/modules/vpn/service';
import { createProduct, createProductsBulk, updateProduct } from '../src/modules/products/service';
import { checkPanels } from '../src/jobs/scheduler';
import { createPanel, deletePanel, listPanelInbounds, listPanels, parsePanelText, setPanelActive, testPanel, updatePanel } from '../src/modules/panels/service';
import { createBot } from '../src/bot';
import { makeOrder, makeProduct, makeUser, resetDb, setup, submit } from './helpers';

let A: FakeXui, B: FakeXui;
let sent: ReturnType<typeof setup>['sent'];
beforeAll(async () => {
  A = await new FakeXui().start(); B = await new FakeXui().start();
  B.inbounds.set(7, { ...structuredClone(B.inbounds.get(1)!), id: 7, remark: 'vmess-b', protocol: 'vmess' });
  B.inbounds.get(7)!.enable = false;
});
afterAll(async () => { await A.stop(); await B.stop(); });
beforeEach(async () => {
  await resetDb();
  ({ sent } = setup());
  process.env.VPN_PROVIDER = 'xui'; delete process.env.XUI_BASE_URL; resetEnvCache();
  setVpnProvider(undefined); // use the real registry, not the mock
  for (const p of [A, B]) { p.inbounds.get(1)!.settings.clients = []; p.inbounds.get(1)!.traffic = {}; p.failNext = 0; }
});
afterAll(() => { process.env.VPN_PROVIDER = 'mock'; resetEnvCache(); });

const creds = (f: FakeXui, over: object = {}) => ({ name: 'Server', baseUrl: f.url, username: 'admin', password: 'secret', ...over });
const wiped = () => setVpnProvider(undefined);

describe('secrets', () => {
  it('AES-GCM round trip, random IV, tamper detection', () => {
    const a = encryptSecret('p@ss'), b = encryptSecret('p@ss');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe('p@ss');
    expect(() => decryptSecret(a.slice(0, -2) + 'AA')).toThrow(/cannot be decrypted/);
  });
  it('only SUPER_ADMIN may manage panels', () => {
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) expect(perms.includes('panels.manage')).toBe(role === 'SUPER_ADMIN');
  });
});

describe('panel CRUD', () => {
  it('tests the connection before saving; wrong password is not stored; password stored encrypted and never listed', async () => {
    await expect(createPanel('t', creds(A, { password: 'WRONG' }))).rejects.toThrow(/اتصال به پنل برقرار نشد/);
    expect(await prisma.panel.count()).toBe(0);
    const p = await createPanel('t', creds(A, { name: 'Germany 1' }));
    expect(p.code).toBe('germany-1');
    const row = await prisma.panel.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.passwordEnc).toMatch(/^enc1:/);
    expect(JSON.stringify(row)).not.toContain('secret');
    expect(JSON.stringify(await listPanels())).not.toMatch(/secret|passwordEnc|enc1/);
    const log = JSON.stringify(await prisma.auditLog.findMany());
    expect(log).not.toContain('secret');
  });
  it('rejects duplicates, the reserved "default" code and unusable urls', async () => {
    await createPanel('t', creds(A));
    await expect(createPanel('t', creds(A, { name: 'again' }))).rejects.toThrow(/قبلاً اضافه/);
    await expect(createPanel('t', creds(B, { code: 'default' }))).rejects.toThrow(/رزرو/);
    await expect(createPanel('t', creds(B, { baseUrl: 'ftp://x' }))).rejects.toThrow();
    await expect(createPanel('t', { name: 'x', baseUrl: B.url })).rejects.toThrow(/توکن/);
  });
  it('edit: keeps the old password when omitted, re-tests on connection changes, refuses bad ones', async () => {
    const p = await createPanel('t', creds(A));
    await updatePanel('t', p.id, { name: 'Renamed' });
    expect((await testPanel(p.code)).ok).toBe(true);
    await expect(updatePanel('t', p.id, { password: 'nope' })).rejects.toThrow(/تغییری ذخیره نشد/);
    expect((await testPanel(p.code)).ok).toBe(true); // unchanged
    await updatePanel('t', p.id, { baseUrl: B.url });
    expect((await prisma.panel.findUniqueOrThrow({ where: { id: p.id } })).baseUrl).toBe(B.url);
  });
  it('lists inbounds of the right panel', async () => {
    const a = await createPanel('t', creds(A, { name: 'A' })), b = await createPanel('t', creds(B, { name: 'B' }));
    expect((await listPanelInbounds(a.code)).map((i) => i.id)).toEqual([1]);
    expect((await listPanelInbounds(b.code)).map((i) => i.id)).toEqual([1, 7]);
  });
  it('delete is refused while products exist; disabled panels cannot receive new products', async () => {
    const a = await createPanel('t', creds(A, { name: 'A' }));
    const prod = await createProduct('t', { name: 'p', durationDays: 30, trafficGB: 10, price: 1000, xuiInboundId: 1, xuiProviderId: a.code });
    await expect(deletePanel('t', a.id)).rejects.toThrow(/محصول/);
    await setPanelActive('t', a.id, false);
    await expect(createProduct('t', { name: 'q', durationDays: 30, trafficGB: 10, price: 1000, xuiInboundId: 1, xuiProviderId: a.code })).rejects.toThrow(/غیرفعال/);
    await prisma.product.delete({ where: { id: prod.id } });
    await deletePanel('t', a.id);
    expect(await prisma.panel.count()).toBe(0);
  });
  it('parses the key: value admin message (persian + english keys, - clears)', () => {
    expect(parsePanelText('نام: آلمان\nآدرس: https://1.2.3.4:2053/x\nکاربر: admin\nرمز: p:w\nساب: -\ntls: نامعتبر')).toEqual({ name: 'آلمان', baseUrl: 'https://1.2.3.4:2053/x', username: 'admin', password: 'p:w', subBaseUrl: '', tlsInsecure: true });
    expect(() => parsePanelText('foo: 1')).toThrow(/شناخته نشد/);
    expect(() => parsePanelText('بدون دونقطه')).toThrow(/فرمت/);
  });
});

describe('products are bound to a panel + inbound', () => {
  it('validates the inbound against THAT panel; unknown panel rejected; bulk panel= directive', async () => {
    const a = await createPanel('t', creds(A, { name: 'A' })), b = await createPanel('t', creds(B, { name: 'B' }));
    const base = { name: 'p', durationDays: 30, trafficGB: 10, price: 1000 };
    await expect(createProduct('t', { ...base, xuiInboundId: 7, xuiProviderId: a.code })).rejects.toThrow(/پیدا نشد/); // 7 only exists on B
    await expect(createProduct('t', { ...base, xuiInboundId: 7, xuiProviderId: b.code })).rejects.toThrow(/غیرفعال/);
    await expect(createProduct('t', { ...base, xuiInboundId: 1, xuiProviderId: 'nope' })).rejects.toThrow(/وجود ندارد/);
    const made = await createProductsBulk('t', `panel=${b.code}\ninbound=1\nB-plan | 30 | 20 | 50000`);
    expect(made[0]).toMatchObject({ xuiProviderId: b.code, xuiInboundId: 1 });
    const moved = await updateProduct('t', made[0].id, { xuiProviderId: a.code });
    expect(moved.xuiProviderId).toBe(a.code);
    await expect(createProductsBulk('t', 'panel=ghost\ninbound=1\nx | 1 | 1 | 1')).rejects.toThrow(/وجود ندارد/);
  });
});

describe('multi-panel provisioning', () => {
  it('each order is created on, renewed on and deleted from ITS OWN panel', async () => {
    const a = await createPanel('t', creds(A, { name: 'A' })), b = await createPanel('t', creds(B, { name: 'B' }));
    const base = { durationDays: 30, trafficGB: 10, price: 1000, xuiInboundId: 1 };
    const pa = await createProduct('t', { ...base, name: 'plan-a', xuiProviderId: a.code });
    const pb = await createProduct('t', { ...base, name: 'plan-b', xuiProviderId: b.code });
    const buy = async (productId: string) => {
      const u = await makeUser(); const o = await makeOrder(u.id, productId);
      const pay = await submit(u.id, o.id, { trackingCode: String(Math.floor(Math.random() * 9e8) + 1e8) });
      await approvePayment(pay.id, { actor: 'admin' });
      return prisma.vpnService.findUniqueOrThrow({ where: { orderId: o.id } });
    };
    const sa = await buy(pa.id), sb = await buy(pb.id);
    expect([A.clientCount(), B.clientCount()]).toEqual([1, 1]);
    expect(sa.provider).toBe(a.code); expect(sb.provider).toBe(b.code);
    expect(sa.provisioningStatus).toBe('SUCCESS'); expect(sb.provisioningStatus).toBe('SUCCESS');
    // renew on B must touch only B
    const before = JSON.stringify(A.inbounds.get(1)!.settings.clients);
    await adminRenew(sb.id, pb.id, 'admin');
    expect(JSON.stringify(A.inbounds.get(1)!.settings.clients)).toBe(before);
    // delete on A removes only A's client
    await deleteService(sa.id, 'admin');
    expect([A.clientCount(), B.clientCount()]).toEqual([0, 1]);
  });
  it('a failing panel does not affect orders on the other panel', async () => {
    const a = await createPanel('t', creds(A, { name: 'A' })), b = await createPanel('t', creds(B, { name: 'B' }));
    const base = { durationDays: 30, trafficGB: 10, price: 1000, xuiInboundId: 1 };
    const pa = await createProduct('t', { ...base, name: 'plan-a', xuiProviderId: a.code });
    const pb = await createProduct('t', { ...base, name: 'plan-b', xuiProviderId: b.code });
    A.failNext = 99;
    const u = await makeUser();
    const oa = await makeOrder(u.id, pa.id), ob = await makeOrder(u.id, pb.id);
    for (const o of [oa, ob]) await approvePayment((await submit(u.id, o.id, { trackingCode: String(Math.floor(Math.random() * 9e8) + 1e8) })).id, { actor: 'admin' });
    expect((await prisma.vpnService.findUniqueOrThrow({ where: { orderId: ob.id } })).provisioningStatus).toBe('SUCCESS');
    expect((await prisma.vpnService.findUnique({ where: { orderId: oa.id } }))?.provisioningStatus).not.toBe('SUCCESS');
    expect(B.clientCount()).toBe(1);
  });
});

describe('health alerts', () => {
  it('one failed probe is silent; the second alerts once; recovery is announced', async () => {
    await prisma.admin.create({ data: { telegramId: 9100n, role: 'VPN_ADMIN' } });
    await createPanel('t', creds(A, { name: 'A' }));
    const count = () => sent.filter((m) => /در دسترس نیست/.test(m.text)).length;
    A.failNext = 2; await checkPanels();
    expect(count()).toBe(0);
    A.failNext = 2; await checkPanels();
    const n = count();
    expect(n).toBeGreaterThan(0); // one alert, delivered to each admin
    A.failNext = 2; await checkPanels();
    expect(count()).toBe(n); // no repeat spam
    A.failNext = 0; await checkPanels();
    expect(sent.some((m) => /دوباره متصل شد/.test(m.text))).toBe(true);
    wiped();
  });
});

describe('Telegram: panels and inbounds management', () => {
  const ADMIN = 9000;
  let api: { method: string; payload: any }[] = [];
  let bot: ReturnType<typeof createBot>;
  let uid = 1;
  beforeEach(() => {
    api = [];
    bot = createBot('123:TEST', { botInfo: { id: 123, is_bot: true, first_name: 'B', username: 'b', can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false, allows_users_to_create_topics: false } as any, fetchFile: async () => Buffer.from('x') });
    bot.api.config.use(async (_p, method, payload: any) => { api.push({ method, payload }); return { ok: true, result: method.startsWith('send') || method.startsWith('edit') ? { message_id: api.length, date: 0, chat: { id: payload.chat_id ?? 1, type: 'private' }, text: payload.text } : true } as any; });
  });
  const who = (id: number) => ({ from: { id, is_bot: false, first_name: 'T' }, chat: { id, type: 'private' as const } });
  const say = (id: number, text: string) => bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, ...who(id), text, entities: text.startsWith('/') ? [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }] : undefined } } as any);
  const tap = (id: number, data: string) => bot.handleUpdate({ update_id: uid++, callback_query: { id: String(uid), from: who(id).from, chat_instance: 'x', data, message: { message_id: 1, date: 0, chat: who(id).chat, text: 'x' } } } as any);
  const last = () => api.filter((c) => ['sendMessage', 'editMessageText'].includes(c.method)).at(-1)!;
  const cbs = () => (last().payload.reply_markup?.inline_keyboard ?? []).flat().map((b: any) => b.callback_data) as string[];

  it('menu entry is super-admin only; a product admin cannot reach it by crafted callbacks', async () => {
    await say(ADMIN, '/admin');
    expect(cbs()).toContain('pn:l');
    await prisma.admin.create({ data: { telegramId: 9200n, role: 'PRODUCT_ADMIN' } });
    await say(9200, '/admin');
    expect(cbs()).not.toContain('pn:l');
    await tap(9200, 'pn:l');
    expect(last().payload.text).toContain('دسترسی');
    await tap(9200, 'pn:new');
    expect(last().payload.text).toContain('دسترسی');
  });

  it('add a panel by message (password message deleted, bad creds keep the step), browse inbounds, create products on the chosen inbound, move a product with the picker', async () => {
    await tap(ADMIN, 'pn:new');
    expect(last().payload.text).toContain('افزودن پنل');
    await say(ADMIN, `نام: Berlin\nآدرس: ${A.url}\nکاربر: admin\nرمز: WRONG`);
    expect(last().payload.text).toContain('اتصال به پنل برقرار نشد');
    expect(api.some((c) => c.method === 'deleteMessage')).toBe(true);
    expect(await prisma.panel.count()).toBe(0);
    await say(ADMIN, `نام: Berlin\nآدرس: ${A.url}\nکاربر: admin\nرمز: secret`);
    expect(last().payload.text).toContain('اضافه شد');
    const code = (await prisma.panel.findFirstOrThrow()).code;
    expect(code).toBe('berlin');

    await tap(ADMIN, 'pn:l'); expect(cbs()).toContain('pn:v:berlin');
    await tap(ADMIN, 'pn:t:berlin'); // test button
    expect(api.some((c) => c.method === 'sendMessage' && /اتصال برقرار است/.test(c.payload.text))).toBe(true);
    await tap(ADMIN, 'pn:i:berlin'); expect(cbs()).toContain('pn:ib:berlin:1');
    await tap(ADMIN, 'pn:ib:berlin:1'); expect(cbs()).toContain('pn:np:berlin:1');
    await tap(ADMIN, 'pn:np:berlin:1');
    await say(ADMIN, 'Eco | 30 | 50 | 250000');
    expect(await prisma.product.findFirstOrThrow()).toMatchObject({ name: 'Eco', xuiProviderId: 'berlin', xuiInboundId: 1, protocol: 'VLESS' });

    // move another product between panels with the picker (panel list → inbound list → pick)
    await createPanel('t', creds(B, { name: 'Paris' }));
    const prod = await makeProduct({ name: 'Other' });
    await tap(ADMIN, `pr:pi:${prod.id}`);
    const idx = cbs().findIndex((c) => c?.startsWith(`pr:pj:${prod.id}:`) && c.endsWith(':1')); // Paris is the 2nd active panel
    expect(idx).toBeGreaterThanOrEqual(0);
    await tap(ADMIN, cbs()[idx]);
    expect(cbs()).toContain(`pr:pk:${prod.id}:1`);
    expect(cbs()).not.toContain(`pr:pk:${prod.id}:7`); // disabled inbound is not offered
    await tap(ADMIN, `pr:pk:${prod.id}:1`);
    expect(await prisma.product.findUniqueOrThrow({ where: { id: prod.id } })).toMatchObject({ xuiProviderId: 'paris', xuiInboundId: 1 });
    // delete is refused while products use the panel
    const row = await prisma.panel.findFirstOrThrow({ where: { code: 'berlin' } });
    await tap(ADMIN, 'pn:d2:berlin');
    expect(last().payload.text).toContain('محصول');
    expect(await prisma.panel.count({ where: { id: row.id } })).toBe(1);
  });
});
