import http from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client';
import { createBot } from '../src/bot';
import { createServer } from '../src/server';
import { createLoginToken } from '../src/admin-web/auth';
import { resetPanelRateLimits } from '../src/admin-web/http';
import { createOrder } from '../src/modules/orders/service';
import { createCoupon } from '../src/modules/coupons/service';
import { setSetting } from '../src/modules/settings/service';
import { approvePayment } from '../src/modules/payments/service';
import { applyForPartner, approvePartner, partnerDiscountFor, partnerStats, rejectPartner, setPartnerPercent, setPartnerSuspended } from '../src/modules/partners/service';
import { makeOrder, makeProduct, makeUser, resetDb, setup, submit } from './helpers';

let sent: ReturnType<typeof setup>['sent'];
beforeEach(async () => { await resetDb(); ({ sent } = setup()); });
const partnerOf = async (userId: string) => prisma.partner.findUniqueOrThrow({ where: { userId } });
const make = async (price = 250000) => ({ u: await makeUser(), p: await makeProduct({ price }) });

describe('partner service', () => {
  it('apply → admins notified with approve/reject buttons; duplicates refused; approve uses the default %; user notified', async () => {
    const { u } = await make();
    const { auto } = await applyForPartner(u.id, 'فروشگاه موبایل، ۵۰ مشتری');
    expect(auto).toBe(false);
    const req = sent.find((m) => m.text.includes('درخواست همکاری جدید'))!;
    expect(req.text).toContain('فروشگاه موبایل');
    expect(req.buttons!.flat().map((b) => b.data)).toEqual(expect.arrayContaining([expect.stringMatching(/^pa:ok:/), expect.stringMatching(/^pa:no:/)]));
    await expect(applyForPartner(u.id)).rejects.toThrow(/در حال بررسی/);
    const row = await partnerOf(u.id);
    await approvePartner('admin:1', row.id);
    expect(await partnerOf(u.id)).toMatchObject({ status: 'APPROVED', discountPercent: 20, decidedBy: 'admin:1' });
    expect(sent.some((m) => m.chatId === u.telegramId && m.text.includes('تأیید شد'))).toBe(true);
    await expect(applyForPartner(u.id)).rejects.toThrow(/همکار هستید/);
    expect(await prisma.auditLog.count({ where: { action: { in: ['partner.apply', 'partner.approve'] } } })).toBe(2);
  });

  it('percent validation: integer 0..100 and never above the configured maximum', async () => {
    const { u } = await make();
    await applyForPartner(u.id);
    const id = (await partnerOf(u.id)).id;
    await expect(approvePartner('a', id, 101)).rejects.toThrow(/بین ۰ تا ۱۰۰/);
    await expect(approvePartner('a', id, 12.5)).rejects.toThrow();
    await expect(approvePartner('a', id, 80)).rejects.toThrow(/حداکثر تخفیف مجاز 70/);
    await approvePartner('a', id, 35);
    await setPartnerPercent('a', id, 40);
    expect((await partnerOf(u.id)).discountPercent).toBe(40);
    await setSetting('partner.maxDiscount', '25'); // lowering the cap lowers every partner's effective rate at once
    expect(await partnerDiscountFor(u.id, 100000)).toEqual({ percent: 25, amount: 25000 });
  });

  it('reject keeps the reason; re-apply is blocked for N days, then allowed', async () => {
    const { u } = await make();
    await applyForPartner(u.id);
    const id = (await partnerOf(u.id)).id;
    await rejectPartner('a', id, 'اطلاعات کافی نیست');
    expect(sent.some((m) => m.chatId === u.telegramId && m.text.includes('اطلاعات کافی نیست'))).toBe(true);
    await expect(applyForPartner(u.id)).rejects.toThrow(/روز دیگر صبر/);
    await prisma.partner.update({ where: { id }, data: { decidedAt: new Date(Date.now() - 4 * 86_400_000) } });
    await applyForPartner(u.id, 'دوباره');
    expect(await partnerOf(u.id)).toMatchObject({ status: 'PENDING', adminNote: null, discountPercent: 0 });
  });

  it('auto-approve and the on/off switch', async () => {
    const { u } = await make();
    await setSetting('partner.enabled', 'false');
    await expect(applyForPartner(u.id)).rejects.toThrow(/فعال نیست/);
    await setSetting('partner.enabled', 'true'); await setSetting('partner.autoApprove', 'true'); await setSetting('partner.defaultDiscount', '15');
    const r = await applyForPartner(u.id);
    expect(r.auto).toBe(true);
    expect(await partnerOf(u.id)).toMatchObject({ status: 'APPROVED', discountPercent: 15, decidedBy: 'system' });
    expect(sent.some((m) => m.text.includes('درخواست همکاری جدید'))).toBe(false); // nothing to review
  });
});

describe('stale buttons, races and settings cross-checks', () => {
  it('a stale ✅/❌ cannot override a decision another admin already made', async () => {
    const { u } = await make();
    await applyForPartner(u.id);
    const id = (await partnerOf(u.id)).id;
    await approvePartner('adminA', id, 35);
    await expect(rejectPartner('adminB', id, 'late')).rejects.toThrow(/قبلاً بررسی شده/);
    expect(await partnerOf(u.id)).toMatchObject({ status: 'APPROVED', discountPercent: 35 });
    await approvePartner('adminB', id); // "approve with default" on an approved partner is a no-op: the custom 35% survives
    expect((await partnerOf(u.id)).discountPercent).toBe(35);
    await setPartnerSuspended('adminA', id, true);
    await expect(approvePartner('adminB', id)).rejects.toThrow(/معلق/); // an old ✅ must not lift a suspension
    expect((await partnerOf(u.id)).status).toBe('SUSPENDED');
  });
  it('double submit: exactly one application and one admin notification', async () => {
    const { u } = await make();
    const r = await Promise.allSettled([applyForPartner(u.id, 'a'), applyForPartner(u.id, 'b')]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(r.find((x) => x.status === 'rejected')).toMatchObject({ reason: { code: 'CONFLICT' } });
    expect(await prisma.partner.count()).toBe(1);
    expect(new Set(sent.filter((m) => m.text.includes('درخواست همکاری جدید')).map((m) => String(m.chatId))).size).toBe(sent.filter((m) => m.text.includes('درخواست همکاری جدید')).length);
  });
  it('default % above the cap: validated on save, and approval still works if it ever happens', async () => {
    const { validatePartnerSetting } = await import('../src/modules/partners/service');
    await setSetting('partner.maxDiscount', '30'); await setSetting('partner.defaultDiscount', '20');
    await expect(validatePartnerSetting('partner.defaultDiscount', '50')).rejects.toThrow(/نمی‌تواند از «سقف تخفیف» بیشتر/);
    await expect(validatePartnerSetting('partner.maxDiscount', '10')).rejects.toThrow(/نمی‌تواند از «درصد پیش‌فرض» کمتر/);
    await expect(validatePartnerSetting('partner.maxDiscount', 'abc')).rejects.toThrow(/عدد صحیح/);
    await expect(validatePartnerSetting('partner.maxDiscount', '101')).rejects.toThrow(/عدد صحیح/);
    await expect(validatePartnerSetting('card.number', '1')).rejects.toThrow(/نامعتبر/);
    expect(await validatePartnerSetting('partner.reapplyDays', '7')).toBe('7');
    await setSetting('partner.defaultDiscount', '50'); // forced inconsistency (e.g. edited in the DB)
    await setSetting('partner.autoApprove', 'true');
    const { u } = await make();
    const r = await applyForPartner(u.id);
    expect(r.auto).toBe(true);
    expect((await partnerOf(u.id)).discountPercent).toBe(30); // capped, not stuck half-applied
  });
});

describe('pricing', () => {
  it('approved partner gets the % on every order; amounts are stored; payment amount = final price', async () => {
    const { u, p } = await make(250000);
    await applyForPartner(u.id); await approvePartner('a', (await partnerOf(u.id)).id, 20);
    const o = await makeOrder(u.id, p.id);
    expect(o).toMatchObject({ amount: 250000, partnerDiscountAmount: 50000, discountAmount: 50000, finalAmount: 200000 });
    const pay = await submit(u.id, o.id, { trackingCode: '123456789' });
    expect(pay.amount).toBe(200000);
    await approvePayment(pay.id, { actor: 'admin' });
    expect(await partnerStats(u.id)).toEqual({ orders: 1, spent: 200000, saved: 50000 });
  });

  it('non-partners, pending, rejected, suspended partners and a switched-off programme pay the full price', async () => {
    const { u, p } = await make(100000);
    expect((await makeOrder(u.id, p.id)).finalAmount).toBe(100000);
    await applyForPartner(u.id); const id = (await partnerOf(u.id)).id;
    await prisma.order.deleteMany(); // (open-order reuse is covered below)
    expect((await makeOrder(u.id, p.id)).finalAmount).toBe(100000); // pending
    await approvePartner('a', id, 30);
    await prisma.order.deleteMany();
    expect((await makeOrder(u.id, p.id)).finalAmount).toBe(70000);
    await setPartnerSuspended('a', id, true);
    await prisma.order.deleteMany();
    expect((await makeOrder(u.id, p.id)).finalAmount).toBe(100000);
    await setPartnerSuspended('a', id, false);
    await setSetting('partner.enabled', 'false');
    await prisma.order.deleteMany();
    expect((await makeOrder(u.id, p.id)).finalAmount).toBe(100000);
  });

  it('an unpaid order made before approval is NOT reused at the old price', async () => {
    const { u, p } = await make(100000);
    const before = await makeOrder(u.id, p.id);
    await applyForPartner(u.id); await approvePartner('a', (await partnerOf(u.id)).id, 10);
    const after = await makeOrder(u.id, p.id);
    expect(after.id).not.toBe(before.id);
    expect(after.finalAmount).toBe(90000);
    expect((await makeOrder(u.id, p.id)).id).toBe(after.id); // same price again → reused as usual
  });

  it('coupons: refused with a partner discount by default; stack setting applies it on the reduced price', async () => {
    const { u, p } = await make(250000);
    await createCoupon('a', { code: 'TEN', type: 'PERCENT', value: 10 });
    expect((await createOrder({ userId: u.id, productId: p.id, paymentMethod: 'CARD_TO_CARD', couponCode: 'TEN' })).order.discountAmount).toBe(25000); // plain user: normal coupon
    await prisma.couponUsage.deleteMany(); await prisma.order.deleteMany(); await prisma.coupon.updateMany({ data: { usedCount: 0 } });
    await applyForPartner(u.id); await approvePartner('a', (await partnerOf(u.id)).id, 20);
    await expect(createOrder({ userId: u.id, productId: p.id, paymentMethod: 'CARD_TO_CARD', couponCode: 'TEN' })).rejects.toThrow(/همراه با تخفیف همکاری/);
    await setSetting('partner.stackCoupons', 'true');
    const o = (await createOrder({ userId: u.id, productId: p.id, paymentMethod: 'CARD_TO_CARD', couponCode: 'TEN' })).order;
    expect(o).toMatchObject({ partnerDiscountAmount: 50000, discountAmount: 70000, finalAmount: 180000 }); // 10% of the already reduced 200000
  });

  it('never goes below zero', async () => {
    const { u, p } = await make(1000);
    await setSetting('partner.maxDiscount', '100');
    await applyForPartner(u.id); await approvePartner('a', (await partnerOf(u.id)).id, 100);
    expect((await makeOrder(u.id, p.id)).finalAmount).toBe(0);
  });
});

describe('Telegram: partner button and admin screens', () => {
  const ADMIN = 9000, USER = 6101;
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
  const labels = () => (last().payload.reply_markup?.inline_keyboard ?? []).flat().map((b: any) => b.text) as string[];

  it('user applies from the menu; admin approves; the buy summary shows the partner discount', async () => {
    const p = await makeProduct({ name: 'Eco', price: 250000 });
    await say(USER, '/start');
    expect(labels()).toContain('🤝 همکاری');
    await tap(USER, 'menu:partner');
    expect(last().payload.text).toContain('همکاری در فروش'); expect(cbs()).toContain('pt:req');
    await tap(USER, 'pt:req'); expect(last().payload.text).toContain('کوتاه بنویسید');
    await say(USER, 'کانال فروش دارم');
    const user = await prisma.user.findFirstOrThrow({ where: { telegramId: BigInt(USER) } });
    expect(await partnerOf(user.id)).toMatchObject({ status: 'PENDING', note: 'کانال فروش دارم' });
    expect(api.some((c) => c.method === 'sendMessage' && /درخواست همکاری ثبت شد/.test(c.payload.text))).toBe(true);
    await tap(USER, 'menu:partner'); expect(last().payload.text).toContain('در حال بررسی');
    // the request reached the admin with action buttons
    const id = (await partnerOf(user.id)).id;
    await tap(ADMIN, `pa:v:${id}`); expect(last().payload.text).toContain('کانال فروش دارم'); expect(cbs()).toEqual(expect.arrayContaining([`pa:ok:${id}`, `pa:no:${id}`, `pa:pc:${id}`]));
    await tap(ADMIN, `pa:pc:${id}`); await say(ADMIN, 'abc'); expect(last().payload.text).toMatch(/عدد|نامعتبر|درصد/);
    await say(ADMIN, '۲۵');
    expect(await partnerOf(user.id)).toMatchObject({ status: 'APPROVED', discountPercent: 25 });
    await tap(USER, 'menu:partner'); expect(last().payload.text).toContain('۲۵٪');
    await tap(USER, `buy:${p.id}`);
    expect(last().payload.text).toContain('تخفیف همکاری'); expect(last().payload.text).toContain('۱۸۷'); // 250,000 − 25% = 187,500
  });

  it('admin: home with counts, reject with reason, suspend/resume, settings toggles and validated numbers', async () => {
    const { u } = await make();
    await applyForPartner(u.id, 'x');
    const id = (await partnerOf(u.id)).id;
    await tap(ADMIN, 'adm:g:fin'); expect(cbs()).toContain('pa:h');
    await tap(ADMIN, 'pa:h'); expect(labels().join(' ')).toContain('در انتظار (1)');
    await tap(ADMIN, 'pa:l:PENDING:0'); expect(cbs()).toContain(`pa:v:${id}`);
    await tap(ADMIN, `pa:no:${id}`); await say(ADMIN, 'مشتری ندارد');
    expect(await partnerOf(u.id)).toMatchObject({ status: 'REJECTED', adminNote: 'مشتری ندارد' });
    await tap(ADMIN, `pa:ok:${id}`); expect((await partnerOf(u.id)).status).toBe('APPROVED');
    await tap(ADMIN, `pa:su:${id}`); expect((await partnerOf(u.id)).status).toBe('SUSPENDED');
    await tap(ADMIN, `pa:re:${id}`); expect((await partnerOf(u.id)).status).toBe('APPROVED');
    await tap(ADMIN, 'pa:cfg'); expect(cbs()).toEqual(expect.arrayContaining(['pa:t:partner.autoApprove', 'pa:e:partner.maxDiscount']));
    await tap(ADMIN, 'pa:t:partner.autoApprove'); expect((await prisma.setting.findUnique({ where: { key: 'partner.autoApprove' } }))?.value).toBe('true');
    await tap(ADMIN, 'pa:t:evil.key'); expect(last().payload.text).toContain('نامعتبر');
    await tap(ADMIN, 'pa:e:partner.maxDiscount'); await say(ADMIN, '500'); expect(last().payload.text).toContain('عدد صحیح بین');
    await say(ADMIN, '٪۴۰'); expect((await prisma.setting.findUnique({ where: { key: 'partner.maxDiscount' } }))?.value).toBe('40');
  });

  it('permissions: only SUPER_ADMIN and PAYMENT_ADMIN; crafted callbacks are refused', async () => {
    await prisma.admin.createMany({ data: [{ telegramId: 9401n, role: 'PRODUCT_ADMIN' }, { telegramId: 9402n, role: 'PAYMENT_ADMIN' }] });
    await tap(9401, 'adm:g:fin'); expect(cbs()).not.toContain('pa:h');
    await tap(9401, 'pa:h'); expect(last().payload.text).toContain('دسترسی');
    await tap(USER, 'pa:h'); expect(last().payload.text).toContain('دسترسی');
    await tap(9402, 'adm:g:fin'); expect(cbs()).toContain('pa:h');
    await tap(9402, 'pa:h'); expect(last().payload.text).toContain('همکاری‌ها');
  });
});

describe('web panel API', () => {
  let web: http.Server; let base: string;
  beforeAll(async () => { web = createServer().listen(0, '127.0.0.1'); await new Promise((r) => web.once('listening', r)); base = `http://127.0.0.1:${(web.address() as AddressInfo).port}`; });
  afterAll(() => { web.close(); });
  beforeEach(() => resetPanelRateLimits());
  const login = async (id = 9000n) => (await fetch(`${base}/admin/auth?token=${createLoginToken(id)}`, { redirect: 'manual' })).headers.get('set-cookie')!.split(';')[0];
  const call = async (cookie: string, method: string, path: string, body?: unknown) => {
    const r = await fetch(`${base}/admin/api${path}`, { method, headers: { cookie, 'content-type': 'application/json', 'x-requested-with': 'admin-panel' }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: (await r.json().catch(() => null)) as any };
  };

  it('list/filter, approve with %, change %, suspend, reject; settings validated; permissions', async () => {
    const a = await makeUser(); const b = await makeUser();
    await applyForPartner(a.id, 'اولی'); await applyForPartner(b.id, 'دومی');
    const c = await login();
    const all = await call(c, 'GET', '/partners');
    expect(all.json.total).toBe(2); expect(all.json.counts).toMatchObject({ PENDING: 2, APPROVED: 0 });
    expect(all.json.items[0]).toMatchObject({ status: 'PENDING', stats: { orders: 0 } });
    const ida = (await partnerOf(a.id)).id, idb = (await partnerOf(b.id)).id;
    expect((await call(c, 'POST', `/partners/${ida}/approve`, { percent: 30 })).status).toBe(200);
    expect((await call(c, 'POST', `/partners/${ida}/approve`, { percent: 90 })).json.message).toContain('حداکثر');
    expect((await call(c, 'POST', `/partners/${ida}/approve`, { percent: 35 })).status).toBe(200); // already approved → changes the %
    expect(await partnerOf(a.id)).toMatchObject({ status: 'APPROVED', discountPercent: 35 });
    expect((await call(c, 'POST', `/partners/${ida}/suspend`, { suspended: true })).status).toBe(200);
    expect((await partnerOf(a.id)).status).toBe('SUSPENDED');
    expect((await call(c, 'POST', `/partners/${idb}/reject`, { reason: '' })).status).toBe(400);
    expect((await call(c, 'POST', `/partners/${idb}/reject`, { reason: 'نه' })).status).toBe(200);
    expect((await call(c, 'GET', '/partners?status=REJECTED')).json.items).toHaveLength(1);
    expect((await call(c, 'GET', '/partners/settings')).json).toMatchObject({ 'partner.enabled': 'true', 'partner.defaultDiscount': '20' });
    expect((await call(c, 'PUT', '/partners/settings', { key: 'partner.maxDiscount', value: '150' })).status).toBe(400);
    expect((await call(c, 'PUT', '/partners/settings', { key: 'partner.maxDiscount', value: '10' })).json.message).toContain('کمتر'); // below the 20% default
    expect((await call(c, 'PUT', '/partners/settings', { key: 'card.number', value: '1' })).status).toBe(400); // only partner keys
    expect((await call(c, 'PUT', '/partners/settings', { key: 'partner.maxDiscount', value: '45' })).status).toBe(200);
    await prisma.admin.createMany({ data: [{ telegramId: 9501n, role: 'PRODUCT_ADMIN' }, { telegramId: 9502n, role: 'PAYMENT_ADMIN' }] });
    expect((await call(await login(9501n), 'GET', '/partners')).status).toBe(403);
    expect((await call(await login(9502n), 'GET', '/partners')).status).toBe(200);
  });
});
