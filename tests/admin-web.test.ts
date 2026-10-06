import http from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client';
import { createServer } from '../src/server';
import { resetPanelRateLimits } from '../src/admin-web/http';
import { createLoginToken, signSession } from '../src/admin-web/auth';
import { addLedgerTx, makeOrder, makeProduct, makeUser, resetDb, setup, submit } from './helpers';
import { approvePayment } from '../src/modules/payments/service';
import { createTicket } from '../src/modules/support/service';
import { FakeXui } from '../dev/fakeXui';

let web: http.Server;
let base: string;
let ctx: ReturnType<typeof setup>;
beforeAll(async () => { web = createServer().listen(0, '127.0.0.1'); await new Promise((r) => web.once('listening', r)); base = `http://127.0.0.1:${(web.address() as AddressInfo).port}`; });
afterAll(() => { web.close(); });
beforeEach(async () => { await resetDb(); ctx = setup(); resetPanelRateLimits(); });

async function login(telegramId = 9000n): Promise<string> {
  const r = await fetch(`${base}/admin/auth?token=${createLoginToken(telegramId)}`, { redirect: 'manual' });
  const c = r.headers.get('set-cookie');
  return c ? c.split(';')[0] : '';
}
async function call(cookie: string, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const r = await fetch(`${base}/admin/api${path}`, { method, headers: { cookie, 'content-type': 'application/json', 'x-requested-with': 'admin-panel', ...headers }, body: body ? JSON.stringify(body) : undefined });
  const ct = r.headers.get('content-type') ?? '';
  return { status: r.status, json: ct.includes('json') ? ((await r.json()) as any) : null, raw: ct.includes('json') ? null : Buffer.from(await r.arrayBuffer()), ct };
}
async function paid() {
  const u = await makeUser(); const p = await makeProduct(); const o = await makeOrder(u.id, p.id);
  const pay = await submit(u.id, o.id, { trackingCode: String(Math.floor(Math.random() * 9e8) + 1e8), image: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, Math.floor(Math.random() * 255)]) });
  return { u, p, o, pay };
}

describe('web panel: auth + hardening', () => {
  it('serves the SPA with strict security headers; static allow-list blocks traversal', async () => {
    const r = await fetch(`${base}/admin/`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-security-policy')).toContain("script-src 'self'");
    expect(r.headers.get('x-frame-options')).toBe('DENY');
    expect(await r.text()).toContain('<html lang="fa" dir="rtl">');
    for (const p of ['/admin/static/../../package.json', '/admin/static/%2e%2e/package.json', '/admin/static/secret.txt']) expect((await fetch(`${base}${p}`)).status).toBe(404);
    expect((await fetch(`${base}/admin/static/app.css`)).status).toBe(200);
  });
  it('API requires a valid session; tampered/expired cookies are rejected', async () => {
    expect((await call('', 'GET', '/me')).status).toBe(401);
    const good = await login();
    expect((await call(good, 'GET', '/me')).status).toBe(200);
    expect((await call(good.slice(0, -3) + 'abc', 'GET', '/me')).status).toBe(401);
    const expired = `vpn_admin=${signSession(9000n, Date.now() - 13 * 3_600_000)}`;
    expect((await call(expired, 'GET', '/me')).status).toBe(401);
  });
  it('login token is single-use and only admins can obtain a session', async () => {
    const t = createLoginToken(9000n);
    expect((await fetch(`${base}/admin/auth?token=${t}`, { redirect: 'manual' })).headers.get('set-cookie')).toContain('HttpOnly');
    const again = await fetch(`${base}/admin/auth?token=${t}`, { redirect: 'manual' });
    expect(again.headers.get('location')).toContain('login=failed');
    expect(again.headers.get('set-cookie')).toBeNull();
    expect(await login(123456n)).toBe(''); // not an admin
    await prisma.admin.create({ data: { telegramId: 55n, role: 'SUPPORT_ADMIN', isActive: false } });
    expect(await login(55n)).toBe(''); // inactive admin
  });
  it('session cookie is HttpOnly + SameSite=Strict; deactivating an admin kills the session immediately', async () => {
    const adm = await prisma.admin.create({ data: { telegramId: 77n, role: 'SUPPORT_ADMIN' } });
    const r = await fetch(`${base}/admin/auth?token=${createLoginToken(77n)}`, { redirect: 'manual' });
    const raw = r.headers.get('set-cookie')!;
    expect(raw).toMatch(/HttpOnly/); expect(raw).toMatch(/SameSite=Strict/);
    const cookie = raw.split(';')[0];
    expect((await call(cookie, 'GET', '/me')).status).toBe(200);
    await prisma.admin.update({ where: { id: adm.id }, data: { isActive: false } });
    expect((await call(cookie, 'GET', '/me')).status).toBe(401);
  });
  it('mutations require the CSRF header', async () => {
    const c = await login();
    expect((await call(c, 'POST', '/notifications/flush', {}, { 'x-requested-with': '' })).status).toBe(403);
    expect((await call(c, 'POST', '/notifications/flush', {})).status).toBe(200);
  });
  it('role permissions apply to the API', async () => {
    await prisma.admin.create({ data: { telegramId: 12n, role: 'SUPPORT_ADMIN' } });
    const c = await login(12n);
    expect((await call(c, 'GET', '/me')).json.permissions).toContain('support.reply');
    expect((await call(c, 'GET', '/tickets')).status).toBe(200);
    for (const p of ['/products', '/settings', '/audit', '/dashboard', '/coupons']) expect((await call(c, 'GET', p)).status).toBe(403);
    expect((await call(c, 'GET', '/payments')).status).toBe(200); // read-only visibility
    expect((await call(c, 'POST', '/payments/x/approve', {})).status).toBe(403);
  });
});

describe('web panel: real data only', () => {
  it('empty database => zeros, zero-filled 30-day series, empty lists (no invented numbers)', async () => {
    const c = await login();
    const d = (await call(c, 'GET', '/dashboard')).json;
    expect(d.stats).toMatchObject({ users: 0, orders: 0, revenue: 0, pendingPayments: 0, activeVpn: 0 });
    expect(d.series).toHaveLength(30);
    expect(d.series.every((x: any) => x.revenue === 0 && x.orders === 0 && x.sales === 0)).toBe(true);
    expect(d.servicesByStatus).toEqual({}); expect(d.attention).toEqual([]); expect(d.recentOrders).toEqual([]);
    for (const p of ['/users', '/orders', '/payments', '/services', '/tickets']) { const r = await call(c, 'GET', p); expect(r.json.items).toEqual([]); expect(r.json.total).toBe(0); }
  });
  it('dashboard reflects real orders, revenue and service states', async () => {
    const { o, pay } = await paid();
    await approvePayment(pay.id, { actor: 'admin:1' });
    await makeOrder((await makeUser()).id, (await makeProduct({ name: 'p2' })).id);
    const d = (await call(await login(), 'GET', '/dashboard')).json;
    expect(d.stats).toMatchObject({ users: 2, orders: 2, revenue: o.finalAmount, activeVpn: 1 });
    expect(d.series.at(-1)).toMatchObject({ revenue: o.finalAmount, sales: 1, orders: 2 });
    expect(d.servicesByStatus).toEqual({ ACTIVE: 1 });
    expect(d.recentOrders).toHaveLength(2);
  });
});

describe('web panel: payments', () => {
  it('list: filters, search, pagination; detail has OCR/risk/verification/audit; receipt is served privately', async () => {
    const c = await login();
    const { pay, o } = await paid();
    await addLedgerTx(o.finalAmount, '888777666');
    const u2 = await makeUser(); const o2 = await makeOrder(u2.id, (await makeProduct({ name: 'x' })).id);
    await addLedgerTx(o2.finalAmount, '135135135');
    await submit(u2.id, o2.id, { trackingCode: '135135135' }); // auto approved
    const all = (await call(c, 'GET', '/payments')).json;
    expect(all.total).toBe(2);
    expect((await call(c, 'GET', '/payments?filter=review')).json.items.map((x: any) => x.id)).toEqual([pay.id]);
    expect((await call(c, 'GET', '/payments?filter=auto')).json.items).toHaveLength(1);
    expect((await call(c, 'GET', `/payments?q=${o.orderNumber}`)).json.items).toHaveLength(1);
    expect((await call(c, 'GET', `/payments?q=${u2.telegramId}`)).json.items[0].autoApproved).toBe(true);
    expect((await call(c, 'GET', '/payments?page=2')).json.items).toHaveLength(0);
    const d = (await call(c, 'GET', `/payments/${pay.id}`)).json;
    expect(d.payment).toMatchObject({ status: 'NEEDS_REVIEW', trackingCode: pay.trackingCode });
    expect(d.audit.map((a: any) => a.action)).toEqual(expect.arrayContaining(['payment.submit', 'payment.needs_review']));
    const rc = await call(c, 'GET', `/payments/${pay.id}/receipt`);
    expect(rc.ct).toBe('image/jpeg'); expect(rc.raw![0]).toBe(0xff);
    expect((await call('', 'GET', `/payments/${pay.id}/receipt`)).status).toBe(401);
  });
  it('approve twice via API => one client; reject works; both audited with actor', async () => {
    const c = await login();
    const a = await paid(); const b = await paid();
    const r1 = await call(c, 'POST', `/payments/${a.pay.id}/approve`, {});
    const r2 = await call(c, 'POST', `/payments/${a.pay.id}/approve`, {});
    expect([r1.json.changed, r2.json.changed]).toEqual([true, false]);
    expect(ctx.vpn.createCalls).toBe(1);
    expect((await call(c, 'POST', `/payments/${b.pay.id}/reject`, { reason: '' })).status).toBe(400);
    expect((await call(c, 'POST', `/payments/${b.pay.id}/reject`, { reason: 'مبلغ اشتباه' })).json.changed).toBe(true);
    const acts = await prisma.auditLog.findMany({ where: { action: { in: ['payment.approve', 'payment.reject'] } } });
    expect(acts.every((x) => x.actor === 'admin:9000')).toBe(true);
    expect((await call(c, 'GET', '/payments/nope')).status).toBe(404);
  });
});

describe('web panel: products, coupons, services, settings, support, audit', () => {
  it('products: validated create/update/toggle; delete refused when used, allowed when unused', async () => {
    const c = await login();
    const bad = await call(c, 'POST', '/products', { name: '', durationDays: 0, trafficGB: 1, price: 1, xuiInboundId: 1, protocol: 'VLESS' });
    expect(bad.status).toBe(400);
    const made = await call(c, 'POST', '/products', { name: 'پلن تست', durationDays: 30, trafficGB: 10, price: 100000, xuiInboundId: 1, protocol: 'VLESS' });
    expect(made.status).toBe(200);
    const id = made.json.id;
    expect((await call(c, 'PATCH', `/products/${id}`, { price: 120000, isActive: false })).json).toMatchObject({ price: 120000, isActive: false });
    expect((await call(c, 'DELETE', `/products/${id}`)).json.ok).toBe(true);
    const used = await makeProduct({ name: 'used' }); await makeOrder((await makeUser()).id, used.id);
    expect((await call(c, 'DELETE', `/products/${used.id}`)).status).toBe(400);
    expect((await call(c, 'GET', '/products')).json.items).toHaveLength(1);
    const acts = (await prisma.auditLog.findMany()).map((a) => a.action);
    expect(acts).toEqual(expect.arrayContaining(['product.create', 'product.price_change', 'product.delete']));
  });
  it('products bulk: one request creates all lines (default inbound), errors are listed, permission enforced; PATCH keeps untouched fields', async () => {
    const c = await login();
    const ok = await call(c, 'POST', '/products/bulk', { text: 'A | 30 | 50 | 1000\nB | 60 | 100 | 2000', inbound: 23, protocol: 'VMESS' });
    expect(ok.json.created).toBe(2);
    expect(ok.json.items.every((x: any) => x.xuiInboundId === 23 && x.protocol === 'VMESS')).toBe(true);
    const bad = await call(c, 'POST', '/products/bulk', { text: 'C | 30 | 50 | 1000\nD | x | 5 | 1' , inbound: 23 });
    expect(bad.status).toBe(400); expect(bad.json.message).toContain('خط 2');
    expect((await call(c, 'GET', '/products')).json.items).toHaveLength(2);
    const id = ok.json.items[0].id;
    await call(c, 'PATCH', `/products/${id}`, { price: 5 });
    expect((await call(c, 'GET', '/products')).json.items.find((x: any) => x.id === id)).toMatchObject({ price: 5, protocol: 'VMESS', isActive: true, xuiInboundId: 23 });
    await prisma.admin.create({ data: { telegramId: 31n, role: 'SUPPORT_ADMIN' } });
    expect((await call(await login(31n), 'POST', '/products/bulk', { text: 'E|1|1|1|1' })).status).toBe(403);
  });
  it('coupons: create, duplicate rejected, toggle', async () => {
    const c = await login();
    const made = await call(c, 'POST', '/coupons', { code: 'off10', type: 'PERCENT', value: 10, maxUses: 5 });
    expect(made.json.code).toBe('OFF10');
    expect((await call(c, 'POST', '/coupons', { code: 'OFF10', type: 'PERCENT', value: 10 })).status).toBe(409);
    expect((await call(c, 'POST', '/coupons', { code: 'x', type: 'PERCENT', value: 200 })).status).toBe(400);
    expect((await call(c, 'POST', `/coupons/${made.json.id}/toggle`, { isActive: false })).json.isActive).toBe(false);
  });
  it('services: detail hides config; sync/suspend/resume; delete needs the exact confirmation phrase', async () => {
    const c = await login();
    const { pay, o } = await paid();
    await approvePayment(pay.id, { actor: 'a' });
    const svc = await prisma.vpnService.findUniqueOrThrow({ where: { orderId: o.id } });
    const list = (await call(c, 'GET', '/services?status=ACTIVE')).json;
    expect(list.items[0]).toMatchObject({ id: svc.id, status: 'ACTIVE', synced: true });
    expect(list.items[0].config).toBeUndefined();
    const det = (await call(c, 'GET', `/services/${svc.id}`)).json;
    expect(det.service.config).toBeUndefined(); expect(det.service.subscriptionUrl).toBeUndefined();
    expect((await call(c, 'POST', `/services/${svc.id}/suspend`, {})).json.ok).toBe(true);
    expect(ctx.vpn.clients.get(svc.externalId)!.enabled).toBe(false);
    expect((await call(c, 'POST', `/services/${svc.id}/resume`, {})).json.ok).toBe(true);
    expect((await call(c, 'POST', `/services/${svc.id}/delete`, { confirm: 'delete' })).status).toBe(400);
    expect((await call(c, 'POST', `/services/${svc.id}/delete`, {})).status).toBe(400);
    expect(ctx.vpn.clients.size).toBe(1);
    expect((await call(c, 'POST', `/services/${svc.id}/delete`, { confirm: `DELETE ${svc.externalId.slice(-6)}` })).json.ok).toBe(true);
    expect(ctx.vpn.clients.size).toBe(0);
    // VPN_ADMIN lacks nothing here, but PAYMENT_ADMIN cannot touch services
    await prisma.admin.create({ data: { telegramId: 21n, role: 'PAYMENT_ADMIN' } });
    expect((await call(await login(21n), 'POST', `/services/${svc.id}/suspend`, {})).status).toBe(403);
  });
  it('failed provisioning shows up under the "failed" filter and can be retried from the API', async () => {
    const c = await login();
    ctx.vpn.failNext = 1;
    const { pay, o } = await paid();
    await approvePayment(pay.id, { actor: 'a' });
    const failed = (await call(c, 'GET', '/services?status=failed')).json.items;
    expect(failed).toHaveLength(1);
    expect(failed[0].lastError).toContain('unavailable');
    const svc = failed[0];
    expect((await call(c, 'POST', `/services/${svc.id}/retry`, {})).json.result).toBe('done');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe('FULFILLED');
  });
  it('settings: strict validation, safe keys only, audited (card number masked)', async () => {
    const c = await login();
    expect((await call(c, 'PUT', '/settings', { key: 'card.number', value: '123' })).status).toBe(400);
    expect((await call(c, 'PUT', '/settings', { key: 'XUI_PASSWORD', value: 'x' })).status).toBe(400);
    expect((await call(c, 'PUT', '/settings', { key: 'risk.highAt', value: '10' })).status).toBe(400); // <= medium (30)
    expect((await call(c, 'PUT', '/settings', { key: 'verification.mode', value: 'YOLO' })).status).toBe(400);
    expect((await call(c, 'PUT', '/settings', { key: 'card.number', value: '6037-9911 2233 4466' })).status).toBe(200);
    expect((await call(c, 'PUT', '/settings', { key: 'verification.mode', value: 'MANUAL_REVIEW' })).status).toBe(200);
    const s = (await call(c, 'GET', '/settings')).json;
    expect(s.settings['card.number']).toBe('6037991122334466'); expect(s.settings['verification.mode']).toBe('MANUAL_REVIEW');
    expect(JSON.stringify(s)).not.toMatch(/BOT_TOKEN|XUI_PASSWORD|PANEL_SESSION/);
    const log = await prisma.auditLog.findMany({ where: { action: 'setting.change' } });
    expect(JSON.stringify(log)).not.toContain('6037991122334466');
    expect((await call(c, 'GET', '/xui/status')).json).toMatchObject({ panels: [] });
  });
  it('support: list, detail, admin reply notifies the user, close', async () => {
    const c = await login();
    const u = await makeUser();
    const t = await createTicket(u.id, 'VPN_ISSUE', 'مشکل اتصال', 'سلام کمک می‌خواهم');
    const list = (await call(c, 'GET', '/tickets?status=OPEN')).json;
    expect(list.items[0]).toMatchObject({ id: t.id, messageCount: 1 });
    expect((await call(c, 'POST', `/tickets/${t.id}/reply`, { text: '' })).status).toBe(400);
    expect((await call(c, 'POST', `/tickets/${t.id}/reply`, { text: 'در حال بررسی' })).json.ok).toBe(true);
    expect(ctx.sent.some((m) => m.html && m.text.includes('در حال بررسی'))).toBe(true);
    const det = (await call(c, 'GET', `/tickets/${t.id}`)).json;
    expect(det.status).toBe('ANSWERED'); expect(det.messages).toHaveLength(2);
    await call(c, 'POST', `/tickets/${t.id}/close`, {});
    expect((await call(c, 'GET', '/tickets?status=CLOSED')).json.total).toBe(1);
  });
  it('audit + notifications + users + orders listings (search/filter/pagination)', async () => {
    const c = await login();
    const users = await Promise.all(Array.from({ length: 17 }, () => makeUser()));
    const p = await makeProduct();
    await makeOrder(users[0].id, p.id);
    const page1 = (await call(c, 'GET', '/users')).json;
    expect(page1).toMatchObject({ total: 17, pageSize: 15 }); expect(page1.items).toHaveLength(15);
    expect((await call(c, 'GET', '/users?page=2')).json.items).toHaveLength(2);
    expect((await call(c, 'GET', `/users?q=${users[3].telegramId}`)).json.items).toHaveLength(1);
    expect((await call(c, 'GET', '/users?status=blocked')).json.total).toBe(0);
    expect((await call(c, 'GET', '/orders?status=PENDING_PAYMENT')).json.total).toBe(1);
    expect((await call(c, 'GET', '/orders?status=PAID')).json.total).toBe(0);
    expect((await call(c, 'GET', '/audit?action=order')).json.items[0].action).toBe('order.create');
    expect((await call(c, 'GET', '/audit?q=%25%27%3B--')).status).toBe(200); // hostile search string is just text
    expect((await call(c, 'GET', '/notifications')).json).toHaveProperty('counts');
    expect((await call(c, 'GET', '/users/' + users[0].id)).json.orders).toHaveLength(1);
  });
});

describe('web panel: multi-panel management API', () => {
  it('CRUD + test + inbounds; secrets are write-only; only super admin manages panels; product admin can read options', async () => {
    const fake = await new FakeXui().start();
    try {
      const c = await login();
      const bad = await call(c, 'POST', '/panels', { name: 'P', baseUrl: fake.url, username: 'admin', password: 'WRONG' });
      expect(bad.status).toBe(400); expect(bad.json.message).toContain('اتصال');
      const made = await call(c, 'POST', '/panels', { name: 'Berlin', baseUrl: fake.url, username: 'admin', password: 'secret' });
      expect(made.status).toBe(200); expect(made.json.code).toBe('berlin');
      const list = await call(c, 'GET', '/panels');
      expect(JSON.stringify(list.json)).not.toMatch(/secret|passwordEnc/);
      expect(list.json.items[0]).toMatchObject({ code: 'berlin', auth: 'password', products: 0, source: 'db' });
      expect((await call(c, 'POST', '/panels/berlin/test')).json).toMatchObject({ ok: true });
      expect((await call(c, 'PATCH', `/panels/${made.json.id}`, { name: 'Berlin 2' })).status).toBe(200);
      await prisma.admin.create({ data: { telegramId: 9300n, role: 'PRODUCT_ADMIN' } });
      const pa = await login(9300n);
      expect((await call(pa, 'GET', '/panels')).status).toBe(403);
      expect((await call(pa, 'POST', '/panels', { name: 'x', baseUrl: fake.url })).status).toBe(403);
      expect((await call(pa, 'GET', '/panels/options')).json.items).toEqual([{ code: 'berlin', name: 'Berlin 2' }]);
      expect((await call(c, 'DELETE', `/panels/${made.json.id}`)).status).toBe(200);
    } finally { await fake.stop(); }
  });
});
