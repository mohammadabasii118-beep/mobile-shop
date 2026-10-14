import http from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client';
import { FakeVpnPanel } from '../dev/fakeVpnPanel';
import { createBot } from '../src/bot';
import { createServer } from '../src/server';
import { createLoginToken } from '../src/admin-web/auth';
import { resetPanelRateLimits } from '../src/admin-web/http';
import { resetEnvCache } from '../src/config/env';
import { setVpnProvider } from '../src/providers/vpn';
import { VpnPanelClient } from '../src/providers/vpn/vpnpanel/client';
import { VpnPanelProvider, panelUserName } from '../src/providers/vpn/vpnpanel/provider';
import { ProviderError } from '../src/providers/vpn/types';
import { createPanel, listPanelInbounds, listPanels, parsePanelText, probePanel, testPanel, updatePanel } from '../src/modules/panels/service';
import { createProduct } from '../src/modules/products/service';
import { approvePayment } from '../src/modules/payments/service';
import { adminRenew, deleteServiceByUser, resumeService, rotateServiceLink, suspendService, syncService } from '../src/modules/vpn/service';
import { makeOrder, makeUser, resetDb, setup, submit } from './helpers';

const GB = 1024 ** 3;
let fake: FakeVpnPanel;
let sent: ReturnType<typeof setup>['sent'];
beforeAll(async () => { fake = await new FakeVpnPanel().start(); });
afterAll(async () => { await fake.stop(); process.env.VPN_PROVIDER = 'mock'; resetEnvCache(); });
beforeEach(async () => {
  await resetDb(); ({ sent } = setup());
  process.env.VPN_PROVIDER = 'xui'; delete process.env.XUI_BASE_URL; resetEnvCache(); setVpnProvider(undefined);
  fake.users.clear(); fake.rotateSupported = false; fake.failNext = 0; fake.requests = [];
});
const cred = (over: object = {}) => ({ name: 'Own panel', kind: 'vpnpanel' as const, baseUrl: fake.url, apiToken: fake.apiKey, ...over });
const providerOf = (key = fake.apiKey, profiles = [{ id: 1, name: 'main', protos: ['vless'], nodeIds: [] as number[] }]) => new VpnPanelProvider({ client: new VpnPanelClient({ baseUrl: fake.url, apiKey: key, retries: 0, timeoutMs: 2000 }), profiles });
const ref = (email = 'tg_1_x') => ({ inboundId: 1, email, credential: 'c', protocol: 'VLESS' as const });
const req = (email = 'tg_1_x', over: object = {}) => ({ ...ref(email), subId: 's', telegramId: '1', trafficLimitBytes: BigInt(50 * GB), expiresAt: new Date(Date.now() + 30 * 86_400_000), ...over });

describe('provider ↔ panel API', () => {
  it('derives a valid, stable, collision-safe panel user name from any client email', () => {
    const long = 'tg_1785191642_VPN-261002-79F0AF_نام-خیلی-بلند-مشتری';
    const n = panelUserName(long);
    expect(n).toMatch(/^[A-Za-z0-9_.-]{2,32}$/); expect(panelUserName(long)).toBe(n);
    expect(panelUserName(long + 'x')).not.toBe(n); // different emails never share a name
    expect(panelUserName('تست')).toMatch(/^[A-Za-z0-9_.-]{2,32}$/);
  });

  it('create is idempotent by name; quota/days/protocols/locations come from the profile', async () => {
    const p = providerOf(fake.apiKey, [{ id: 2, name: 'x', protos: ['vless', 'l2tp'], nodeIds: [1] }]);
    const a = await p.createService(req('tg_1_x', { inboundId: 2 }));
    expect(a.adopted).toBe(false);
    const u = fake.byName(panelUserName('tg_1_x'))!;
    expect(u).toMatchObject({ protos: ['vless', 'l2tp'], node_ids: [1], quota_bytes: 50 * GB });
    expect(Math.round((u.expire_at!.getTime() - Date.now()) / 86_400_000)).toBe(30);
    expect((await p.createService(req('tg_1_x', { inboundId: 2 }))).adopted).toBe(true);
    expect(fake.users.size).toBe(1);
    await expect(p.createService(req('tg_1_x', { inboundId: 9 }))).rejects.toMatchObject({ retryable: false }); // unknown profile
  });

  it('status/traffic mirror the panel; subscription link + first direct link come back as config', async () => {
    const p = providerOf();
    await p.createService(req());
    fake.addUsage(panelUserName('tg_1_x'), 5 * GB);
    const s = (await p.getServiceStatus(ref()))!;
    expect(s).toMatchObject({ exists: true, enabled: true, trafficLimit: BigInt(50 * GB), used: BigInt(5 * GB) });
    expect(s.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    expect(await p.getTraffic(ref())).toMatchObject({ used: BigInt(5 * GB), total: BigInt(50 * GB) });
    const cfg = await p.getConfig({ ...ref(), subId: 's' });
    expect(cfg.subscriptionUrl).toBe(`${fake.url}/sub/${fake.byName(panelUserName('tg_1_x'))!.sub_token}`);
    expect(cfg.config).toMatch(/^vless:\/\//);
    expect(await p.getServiceStatus(ref('nobody'))).toBeNull();
  });

  it('renewal sets absolute targets and keeps the usage; suspend/resume/delete work and are idempotent', async () => {
    const p = providerOf();
    await p.createService(req());
    fake.addUsage(panelUserName('tg_1_x'), 7 * GB);
    const st = await p.renewService({ ...ref(), trafficLimitBytes: BigInt(100 * GB), expiresAt: new Date(Date.now() + 60 * 86_400_000) });
    expect(st).toMatchObject({ trafficLimit: BigInt(100 * GB), used: BigInt(7 * GB) });
    expect(Math.round((st.expiresAt!.getTime() - Date.now()) / 86_400_000)).toBe(60);
    await p.suspendService(ref()); expect((await p.getServiceStatus(ref()))!.enabled).toBe(false);
    await p.resumeService(ref()); expect((await p.getServiceStatus(ref()))!.enabled).toBe(true);
    await p.deleteService(ref()); expect(fake.users.size).toBe(0);
    await p.deleteService(ref()); // already gone: fine
    await expect(p.suspendService(ref())).rejects.toMatchObject({ retryable: false });
    await expect(p.renewService({ ...ref(), trafficLimitBytes: 1n, expiresAt: new Date() })).rejects.toMatchObject({ retryable: false });
  });

  it('errors: bad key (permanent, clear), server error (retryable), unreachable (retryable), health reports node counts', async () => {
    await expect(providerOf('wrong-wrong-wrong-wrong-wrong').getServiceStatus(ref())).rejects.toThrow(/rejected the API key/);
    fake.failNext = 1; await expect(providerOf().createService(req())).rejects.toMatchObject({ retryable: true });
    const dead = new VpnPanelProvider({ client: new VpnPanelClient({ baseUrl: 'http://127.0.0.1:1', apiKey: 'k'.repeat(30), retries: 0, timeoutMs: 500 }), profiles: [] });
    await expect(dead.getServiceStatus(ref())).rejects.toMatchObject({ retryable: true });
    expect(await providerOf().healthCheck()).toMatchObject({ ok: true, detail: 'connected, 2 node(s), 1 online' });
    expect((await providerOf('wrong-wrong-wrong-wrong-wrong').healthCheck()).ok).toBe(false);
    expect(fake.users.size).toBe(0);
  });

  it('a write is never re-sent after a broken connection', async () => {
    let posts = 0;
    const f = (async (_u: any, init: any) => { if (init.method === 'POST') posts++; throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }); }) as unknown as typeof fetch;
    const p = new VpnPanelProvider({ client: new VpnPanelClient({ baseUrl: 'http://x', apiKey: 'k'.repeat(30), retries: 2, fetchImpl: f }), profiles: [{ id: 1, name: 'm', protos: ['vless'], nodeIds: [] }] });
    await expect(p.createService(req())).rejects.toBeInstanceOf(ProviderError);
    expect(posts).toBeLessThanOrEqual(1);
  });

  it('link rotation: clear error on a panel without the endpoint, works when the panel has it', async () => {
    const p = providerOf(); await p.createService(req());
    await expect(p.rotateLink(ref())).rejects.toMatchObject({ retryable: false, message: expect.stringContaining('پشتیبانی نمی‌کند') });
    fake.rotateSupported = true;
    const before = (await p.getConfig({ ...ref(), subId: 's' })).subscriptionUrl;
    await p.rotateLink(ref());
    expect((await p.getConfig({ ...ref(), subId: 's' })).subscriptionUrl).not.toBe(before);
  });
});

describe('panel management (service)', () => {
  it('creates a vpnpanel with an encrypted token and a default profile; secrets never listed', async () => {
    const row = await createPanel('t', cred());
    expect(row).toMatchObject({ kind: 'vpnpanel', username: null, passwordEnc: null });
    expect(row.apiTokenEnc).toMatch(/^enc1:/);
    const v = (await listPanels()).find((p) => p.code === row.code)!;
    expect(v).toMatchObject({ kind: 'vpnpanel', auth: 'token', profiles: [expect.objectContaining({ id: 1, protos: ['vless'] })] });
    expect(JSON.stringify(await listPanels())).not.toContain(fake.apiKey);
    expect((await testPanel(row.code)).ok).toBe(true);
    expect((await listPanelInbounds(row.code)).map((i) => [i.id, i.protocol])).toEqual([[1, 'profile']]);
  });

  it('refuses a wrong key, a missing key, unknown protocols/locations and protocols that do not count traffic', async () => {
    await expect(createPanel('t', cred({ apiToken: 'wrong-wrong-wrong-wrong' }))).rejects.toThrow(/اتصال به پنل برقرار نشد/);
    await expect(createPanel('t', { name: 'x', kind: 'vpnpanel', baseUrl: fake.url })).rejects.toThrow(/توکن/);
    const prof = (protos: string[], nodeIds: number[] = []) => [{ id: 1, name: 'p', protos, nodeIds }];
    await expect(createPanel('t', cred({ profiles: prof(['nope']) }))).rejects.toThrow(/وجود ندارد/);
    await expect(createPanel('t', cred({ profiles: prof(['hy2']) }))).rejects.toThrow(/حجم مصرفی را نمی‌شمارد/);
    await expect(createPanel('t', cred({ profiles: prof(['vless'], [99]) }))).rejects.toThrow(/لوکیشن شماره‌ی 99/);
    await expect(createPanel('t', cred({ profiles: [...prof(['vless']), ...prof(['trojan'])] }))).rejects.toThrow(/یکتا/);
    expect(await prisma.panel.count()).toBe(0);
    const ok = await createPanel('t', cred());
    await expect(createPanel('t', cred({ name: 'again' }))).rejects.toThrow(/قبلاً اضافه/);
    expect(ok.code).toBe('own-panel');
  });

  it('edit profiles: validated live, and a profile that products still use cannot be removed', async () => {
    const p = await createPanel('t', cred({ profiles: [{ id: 1, name: 'a', protos: ['vless'], nodeIds: [] }, { id: 2, name: 'b', protos: ['trojan'], nodeIds: [1] }] }));
    await createProduct('t', { name: 'plan', durationDays: 30, trafficGB: 10, price: 1000, xuiInboundId: 2, xuiProviderId: p.code });
    await expect(updatePanel('t', p.id, { profiles: [{ id: 1, name: 'a', protos: ['vless'], nodeIds: [] }] })).rejects.toThrow(/هنوز روی 1 محصول/);
    await updatePanel('t', p.id, { profiles: [{ id: 1, name: 'a2', protos: ['vless', 'l2tp'], nodeIds: [] }, { id: 2, name: 'b', protos: ['trojan'], nodeIds: [1] }] });
    expect((await listPanels()).find((x) => x.id === p.id)!.profiles[0]).toMatchObject({ name: 'a2', protos: ['vless', 'l2tp'] });
    await expect(updatePanel('t', p.id, { kind: 'xui' })).rejects.toThrow(/نوع پنل/);
    await expect(updatePanel('t', p.id, { profiles: [{ id: 1, name: 'a', protos: ['hy2'], nodeIds: [] }, { id: 2, name: 'b', protos: ['trojan'], nodeIds: [] }] })).rejects.toThrow(/نمی‌شمارد/);
  });

  it('products bind to a profile; a missing profile is rejected', async () => {
    const p = await createPanel('t', cred());
    const base = { name: 'p', durationDays: 30, trafficGB: 10, price: 1000, xuiProviderId: p.code };
    expect((await createProduct('t', { ...base, xuiInboundId: 1 })).xuiInboundId).toBe(1);
    await expect(createProduct('t', { ...base, xuiInboundId: 5 })).rejects.toThrow(/پیدا نشد/);
  });

  it('probe lists the panel\'s protocols and locations for the admin forms', async () => {
    const r = await probePanel({ baseUrl: fake.url, apiToken: fake.apiKey });
    expect(r.nodes.map((n) => n.id)).toEqual([1, 2]); expect(r.protocols.find((x) => x.id === 'hy2')!.counted).toBe(false);
    await expect(probePanel({ baseUrl: fake.url, apiToken: 'wrong-wrong-wrong-wrong' })).rejects.toThrow(/اتصال/);
  });

  it('parses the admin message: type, token and profile lines', () => {
    const r = parsePanelText('نام: پنل ما\nنوع: panel\nآدرس: https://panel.sibdata1.cfd\nتوکن: abc\nپروفایل: 1 | اصلی | vless | همه\nپروفایل: ۲ | آلمان | vless, trojan | 1،2');
    expect(r).toMatchObject({ kind: 'vpnpanel', baseUrl: 'https://panel.sibdata1.cfd', apiToken: 'abc' });
    expect(r.profiles).toEqual([{ id: 1, name: 'اصلی', protos: ['vless'], nodeIds: [] }, { id: 2, name: 'آلمان', protos: ['vless', 'trojan'], nodeIds: [1, 2] }]);
    expect(() => parsePanelText('نوع: چیز')).toThrow(/نوع پنل/);
    expect(() => parsePanelText('پروفایل: فقط یک بخش')).toThrow(/شکل باشد/);
    expect(() => parsePanelText('پروفایل: x | n | vless | همه')).toThrow(/عدد نیست/);
  });
});

describe('purchase → panel user → renewal → delete (end to end)', () => {
  async function bought() {
    const panel = await createPanel('t', cred());
    const prod = await createProduct('t', { name: '50GB', durationDays: 30, trafficGB: 50, price: 250000, xuiInboundId: 1, xuiProviderId: panel.code });
    const u = await makeUser(); const o = await makeOrder(u.id, prod.id);
    const pay = await submit(u.id, o.id, { trackingCode: String(Math.floor(Math.random() * 9e8) + 1e8) });
    await approvePayment(pay.id, { actor: 'admin' });
    return { panel, prod, u, o, svc: await prisma.vpnService.findUniqueOrThrow({ where: { orderId: o.id } }) };
  }
  it('provisions on the panel and delivers the subscription link', async () => {
    const { svc, o } = await bought();
    expect(svc).toMatchObject({ provisioningStatus: 'SUCCESS', status: 'ACTIVE', inboundId: 1 });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe('FULFILLED');
    const pu = fake.byName(panelUserName(svc.externalId))!;
    expect(pu).toMatchObject({ quota_bytes: 50 * GB, protos: ['vless'], enabled: true });
    expect(svc.subscriptionUrl).toBe(`${fake.url}/sub/${pu.sub_token}`);
    expect(sent.some((m) => m.text.includes(`${fake.url}/sub/${pu.sub_token}`))).toBe(true);
    expect(fake.users.size).toBe(1);
  });
  it('sync pulls real usage; suspend/resume; admin renewal adds quota and time and keeps the link', async () => {
    const { svc, prod } = await bought();
    const name = panelUserName(svc.externalId);
    fake.addUsage(name, 12 * GB);
    expect((await syncService(svc.id))!.trafficUsed).toBe(BigInt(12 * GB));
    await suspendService(svc.id, 'a'); expect(fake.byName(name)!.enabled).toBe(false);
    await resumeService(svc.id, 'a'); expect(fake.byName(name)!.enabled).toBe(true);
    const before = fake.byName(name)!.sub_token;
    await adminRenew(svc.id, prod.id, 'a');
    expect(fake.byName(name)).toMatchObject({ quota_bytes: 100 * GB, used_bytes: 12 * GB, sub_token: before });
    expect(Math.round((fake.byName(name)!.expire_at!.getTime() - Date.now()) / 86_400_000)).toBeGreaterThanOrEqual(59);
  });
  it('customer delete removes the panel user; "change link" says plainly when the panel cannot do it, and works when it can', async () => {
    const { svc, u } = await bought();
    await expect(rotateServiceLink(u.id, svc.id)).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringContaining('پشتیبانی نمی‌کند') });
    fake.rotateSupported = true;
    const before = svc.subscriptionUrl;
    const n = await rotateServiceLink(u.id, svc.id);
    expect(n.subscriptionUrl).not.toBe(before);
    await deleteServiceByUser(u.id, svc.id);
    expect(fake.users.size).toBe(0);
  });
  it('a panel outage during provisioning retries and finally succeeds without duplicates', async () => {
    const panel = await createPanel('t', cred());
    const prod = await createProduct('t', { name: 'p', durationDays: 30, trafficGB: 10, price: 1000, xuiInboundId: 1, xuiProviderId: panel.code });
    const u = await makeUser(); const o = await makeOrder(u.id, prod.id);
    const pay = await submit(u.id, o.id, { trackingCode: '123123123' });
    fake.failNext = 99;
    await approvePayment(pay.id, { actor: 'admin' });
    expect((await prisma.provisioningTask.findUniqueOrThrow({ where: { orderId: o.id } })).status).toBe('FAILED');
    fake.failNext = 0;
    await prisma.provisioningTask.update({ where: { orderId: o.id }, data: { nextAttemptAt: new Date() } });
    const { retryDueProvisioning } = await import('../src/modules/vpn/provisioning');
    await retryDueProvisioning();
    expect(fake.users.size).toBe(1);
    expect((await prisma.vpnService.findUniqueOrThrow({ where: { orderId: o.id } })).provisioningStatus).toBe('SUCCESS');
  });
});

describe('Telegram + web admin', () => {
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

  it('bot: add the panel by message, see its profiles, create a product on a profile', async () => {
    await tap(ADMIN, 'pn:new');
    expect(last().payload.text).toContain('نوع: panel');
    await say(ADMIN, `نام: Own\nنوع: panel\nآدرس: ${fake.url}\nتوکن: wrong-wrong-wrong-wrong\nپروفایل: 1 | اصلی | vless | همه`);
    expect(last().payload.text).toContain('اتصال به پنل برقرار نشد'); expect(await prisma.panel.count()).toBe(0);
    await say(ADMIN, `نام: Own\nنوع: panel\nآدرس: ${fake.url}\nتوکن: ${fake.apiKey}\nپروفایل: 1 | اصلی | vless | همه\nپروفایل: 2 | آلمان | vless,trojan | 1`);
    expect(last().payload.text).toContain('اضافه شد');
    const code = (await prisma.panel.findFirstOrThrow()).code;
    await tap(ADMIN, `pn:v:${code}`);
    expect(last().payload.text).toContain('پنل اختصاصی'); expect(last().payload.text).toContain('2. آلمان — vless+trojan — لوکیشن 1');
    expect(last().payload.reply_markup.inline_keyboard.flat().map((b: any) => b.text)).toContain('🧩 پروفایل‌ها');
    await tap(ADMIN, `pn:i:${code}`); expect(cbs()).toEqual(expect.arrayContaining([`pn:ib:${code}:1`, `pn:ib:${code}:2`]));
    await tap(ADMIN, `pn:ib:${code}:2`); expect(cbs()).toContain(`pn:np:${code}:2`);
    await tap(ADMIN, `pn:np:${code}:2`);
    await say(ADMIN, 'Germany 50 | 30 | 50 | 300000');
    expect(await prisma.product.findFirstOrThrow()).toMatchObject({ name: 'Germany 50', xuiProviderId: code, xuiInboundId: 2 });
  });

  describe('web', () => {
    let web: http.Server; let base: string;
    beforeAll(async () => { web = createServer().listen(0, '127.0.0.1'); await new Promise((r) => web.once('listening', r)); base = `http://127.0.0.1:${(web.address() as AddressInfo).port}`; });
    afterAll(() => { web.close(); });
    beforeEach(() => resetPanelRateLimits());
    const login = async () => (await fetch(`${base}/admin/auth?token=${createLoginToken(9000n)}`, { redirect: 'manual' })).headers.get('set-cookie')!.split(';')[0];
    const call = async (cookie: string, method: string, path: string, body?: unknown) => {
      const r = await fetch(`${base}/admin/api${path}`, { method, headers: { cookie, 'content-type': 'application/json', 'x-requested-with': 'admin-panel' }, body: body ? JSON.stringify(body) : undefined });
      return { status: r.status, json: (await r.json().catch(() => null)) as any };
    };
    it('probe, create with profiles, edit profiles, list (no secrets)', async () => {
      const c = await login();
      const pr = await call(c, 'POST', '/panels/probe', { baseUrl: fake.url, apiToken: fake.apiKey });
      expect(pr.json.nodes).toHaveLength(2); expect(pr.json.protocols.length).toBeGreaterThan(3);
      expect((await call(c, 'POST', '/panels/probe', { baseUrl: fake.url, apiToken: 'wrong-wrong-wrong-wrong' })).status).toBe(400);
      const made = await call(c, 'POST', '/panels', { name: 'Own', kind: 'vpnpanel', baseUrl: fake.url, apiToken: fake.apiKey, profiles: [{ id: 1, name: 'اصلی', protos: ['vless'], nodeIds: [] }] });
      expect(made.status).toBe(200);
      const list = await call(c, 'GET', '/panels');
      expect(list.json.items[0]).toMatchObject({ kind: 'vpnpanel', profiles: [{ id: 1, name: 'اصلی' }] });
      expect(JSON.stringify(list.json)).not.toContain(fake.apiKey);
      expect((await call(c, 'PATCH', `/panels/${made.json.id}`, { profiles: [{ id: 1, name: 'اصلی', protos: ['vless', 'trojan'], nodeIds: [1] }] })).status).toBe(200);
      expect((await call(c, 'PATCH', `/panels/${made.json.id}`, { profiles: [{ id: 1, name: 'x', protos: ['hy2'], nodeIds: [] }] })).status).toBe(400);
    });
  });
});
