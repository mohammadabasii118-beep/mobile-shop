import http from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client';
import { createBot } from '../src/bot';
import { createServer } from '../src/server';
import { createLoginToken } from '../src/admin-web/auth';
import { resetPanelRateLimits } from '../src/admin-web/http';
import { TEXT_DEFS, listTexts, loadTexts, previewText, resetText, setText, validateText, type TextKey } from '../src/modules/texts/service';
import { approvePayment, rejectPayment } from '../src/modules/payments/service';
import { makeOrder, makeProduct, makeUser, resetDb, setup, submit } from './helpers';

let ctx: ReturnType<typeof setup>;
beforeEach(async () => { await resetDb(); ctx = setup(); });

describe('text service', () => {
  it('defaults are used until an admin overrides; reset restores them; cache is invalidated on write', async () => {
    expect((await loadTexts()).plain('btn.buy')).toBe('🛒 خرید VPN');
    await setText('admin:1', 'btn.buy', '🛍 فروشگاه');
    expect((await loadTexts()).plain('btn.buy')).toBe('🛍 فروشگاه');
    expect((await listTexts()).find((t) => t.key === 'btn.buy')).toMatchObject({ isDefault: false, value: '🛍 فروشگاه' });
    await resetText('admin:1', 'btn.buy');
    expect((await loadTexts()).plain('btn.buy')).toBe('🛒 خرید VPN');
    expect((await prisma.auditLog.findMany()).map((a) => a.action)).toEqual(expect.arrayContaining(['text.update', 'text.reset']));
  });
  it('renders safely: escapes HTML, *bold*, known {vars} only (escaped; code vars tap-to-copy)', async () => {
    await setText('a', 'msg.rejected', '❌ *نشد*\nسفارش {order}\nدلیل: {reason}\n<script>alert(1)</script> & co');
    const T = await loadTexts();
    const html = T.html('msg.rejected', { order: 'VPN-1', reason: '<b>x</b> & y' });
    expect(html).toContain('<b>نشد</b>'); expect(html).toContain('<code>VPN-1</code>');
    expect(html).toContain('دلیل: &lt;b&gt;x&lt;/b&gt; &amp; y');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; co');
    expect(html.replace(/<\/?(b|code)>/g, '')).not.toMatch(/<[^>]*>/);
  });
  it('validation: length, empty (unless optional), unknown variables, multi-line button labels', async () => {
    expect(() => validateText('welcome', '   ')).toThrow(/خالی/);
    expect(() => validateText('btn.buy', 'x'.repeat(31))).toThrow(/حداکثر/);
    expect(() => validateText('btn.buy', 'a\nb')).toThrow(/یک خط/);
    expect(() => validateText('welcome', 'سلام {nope}')).toThrow(/\{nope\}/);
    expect(() => validateText('rules', 'سلام {name}')).toThrow(/متغیر/); // rules has no vars
    expect(validateText('delivery.tips', '')).toBe(''); // optional
    expect(validateText('welcome', 'سلام {name}')).toBe('سلام {name}');
  });
  it('every default text passes its own validation and previews without leftover placeholders', () => {
    for (const k of Object.keys(TEXT_DEFS) as TextKey[]) {
      const d = TEXT_DEFS[k] as { default: string; optional?: boolean };
      expect(() => validateText(k, d.default), k).not.toThrow();
      expect(previewText(k, d.default), k).not.toMatch(/\{\w+\}/);
    }
  });
});

describe('customer messages use the edited texts', () => {
  async function paid() { const u = await makeUser(); const p = await makeProduct(); const o = await makeOrder(u.id, p.id); const pay = await submit(u.id, o.id, { trackingCode: String(Math.floor(Math.random() * 9e8) + 1e8) }); return { u, o, pay }; }
  it('payment / rejection / delivery notifications', async () => {
    await setText('a', 'msg.verified', '🎉 *عالی!* پرداخت {order} قبول شد');
    await setText('a', 'msg.rejected', 'رد شد: {reason}');
    await setText('a', 'delivery.tips', '');
    const { pay, o } = await paid();
    await approvePayment(pay.id, { actor: 'a' });
    expect(ctx.sent.some((m) => m.html && m.text.includes('<b>عالی!</b> پرداخت') && m.text.includes(`<code>${o.orderNumber}</code>`))).toBe(true);
    const delivery = ctx.sent.find((m) => m.text.includes('سرویس شما آماده است'))!;
    expect(delivery.text).not.toContain('V2Ray/Hiddify'); // tips removed
    const b = await paid();
    await rejectPayment(b.pay.id, { actor: 'a', reason: '<i>غلط</i>' });
    expect(ctx.sent.some((m) => m.text.includes('رد شد: &lt;i&gt;غلط&lt;/i&gt;'))).toBe(true);
  });
});

describe('Telegram: custom texts + admin editor', () => {
  const ADMIN = 9000, USER = 6300;
  let api: { method: string; payload: any }[] = [];
  let bot: ReturnType<typeof createBot>;
  let uid = 1;
  beforeEach(() => {
    api = [];
    bot = createBot('123:TEST', { botInfo: { id: 123, is_bot: true, first_name: 'B', username: 'b', can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false, allows_users_to_create_topics: false } as any, fetchFile: async () => Buffer.from('x') });
    bot.api.config.use(async (_p, method, payload: any) => { api.push({ method, payload }); return { ok: true, result: method.startsWith('send') || method.startsWith('edit') ? { message_id: api.length, date: 0, chat: { id: payload.chat_id ?? 1, type: 'private' }, text: payload.text } : true } as any; });
  });
  const who = (id: number) => ({ from: { id, is_bot: false, first_name: 'علی' }, chat: { id, type: 'private' as const } });
  const say = (id: number, text: string) => bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, ...who(id), text, entities: text.startsWith('/') ? [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }] : undefined } } as any);
  const tap = (id: number, data: string) => bot.handleUpdate({ update_id: uid++, callback_query: { id: String(uid), from: who(id).from, chat_instance: 'x', data, message: { message_id: 1, date: 0, chat: who(id).chat, text: 'x' } } } as any);
  const last = () => api.filter((c) => ['sendMessage', 'editMessageText'].includes(c.method)).at(-1)!;
  const labels = () => (last().payload.reply_markup?.inline_keyboard ?? []).flat().map((b: any) => b.text) as string[];
  const cbs = () => (last().payload.reply_markup?.inline_keyboard ?? []).flat().map((b: any) => b.callback_data) as string[];

  it('welcome, menu labels, rules, buy prompt/intro, payment note, receipt and support texts are all editable', async () => {
    await setText('a', 'welcome', '🌟 درود *{name}* عزیز!');
    await setText('a', 'btn.buy', '🛍 خرید سرویس'); await setText('a', 'btn.rules', '📋 مقررات');
    await setText('a', 'rules', 'قانون اول *مهم*'); await setText('a', 'buy.intro', 'تخفیف آخر هفته!'); await setText('a', 'buy.prompt', 'انتخاب کنید 👇');
    await setText('a', 'payment.note', 'حتماً دقیق واریز کنید'); await setText('a', 'receipt.prompt', 'رسید را بفرستید'); await setText('a', 'support.intro', 'در خدمتیم'); await setText('a', 'coupon.prompt', 'کدت را بده');
    await say(USER, '/start');
    expect(last().payload.text).toBe('🌟 درود <b>علی</b> عزیز!');
    expect(labels()).toEqual(expect.arrayContaining(['🛍 خرید سرویس', '📋 مقررات']));
    await tap(USER, 'menu:rules'); expect(last().payload.text).toContain('قانون اول <b>مهم</b>');
    const p = await makeProduct();
    await tap(USER, 'menu:buy'); expect(last().payload.text).toContain('تخفیف آخر هفته!'); expect(last().payload.text).toContain('انتخاب کنید 👇');
    await tap(USER, `bo:${p.id}`); expect(last().payload.text).toContain('حتماً دقیق واریز کنید');
    const o = await prisma.order.findFirstOrThrow();
    await tap(USER, `rc:${o.id}`); expect(last().payload.text).toContain('رسید را بفرستید');
    await tap(USER, 'menu:support'); expect(last().payload.text).toContain('در خدمتیم');
    await tap(USER, 'menu:coupon'); expect(last().payload.text).toContain('کدت را بده');
  });

  it('admin edits a text in the bot with preview; validation errors keep the step; reset works; permission enforced', async () => {
    await tap(ADMIN, 'adm:home');
    expect(cbs()).toContain('tx:l');
    await tap(ADMIN, 'tx:l'); expect(labels()).toEqual(expect.arrayContaining(['منو و خوش‌آمد', 'اعلان‌ها']));
    await tap(ADMIN, 'tx:g:0'); expect(cbs()).toContain('tx:v:welcome');
    await tap(ADMIN, 'tx:v:welcome');
    expect(last().payload.text).toContain('{name}'); expect(cbs()).toEqual(expect.arrayContaining(['tx:e:welcome']));
    await tap(ADMIN, 'tx:e:welcome');
    await say(ADMIN, 'سلام {bad}');
    expect(last().payload.text).toContain('{bad}');
    await say(ADMIN, 'سلام *{name}* جان');
    expect((await loadTexts()).plain('welcome')).toBe('سلام *{name}* جان');
    expect(api.some((c) => c.payload.parse_mode === 'HTML' && String(c.payload.text).includes('سلام <b>علی</b> جان'))).toBe(true); // preview with the sample name
    await tap(ADMIN, 'tx:v:welcome'); expect(cbs()).toContain('tx:r:welcome');
    await tap(ADMIN, 'tx:r:welcome');
    expect((await loadTexts()).plain('welcome')).toContain('خوش آمدید');
    // permission: PAYMENT_ADMIN does not have texts.manage, PRODUCT_ADMIN does
    await prisma.admin.create({ data: { telegramId: 71n, role: 'PAYMENT_ADMIN' } }); await prisma.admin.create({ data: { telegramId: 72n, role: 'PRODUCT_ADMIN' } });
    await tap(71, 'tx:l'); expect(last().payload.text).toContain('دسترسی غیرمجاز');
    await tap(USER, 'tx:e:welcome'); expect(last().payload.text).toContain('دسترسی غیرمجاز');
    await tap(72, 'tx:l'); expect(last().payload.text).toContain('کدام بخش');
  });
});

describe('web panel texts API', () => {
  let web: http.Server; let base: string;
  beforeAll(async () => { web = createServer().listen(0, '127.0.0.1'); await new Promise((r) => web.once('listening', r)); base = `http://127.0.0.1:${(web.address() as AddressInfo).port}`; });
  afterAll(() => { web.close(); });
  const login = async (id: bigint) => { resetPanelRateLimits(); const r = await fetch(`${base}/admin/auth?token=${createLoginToken(id)}`, { redirect: 'manual' }); return r.headers.get('set-cookie')!.split(';')[0]; };
  const call = async (c: string, method: string, path: string, body?: unknown) => { const r = await fetch(`${base}/admin/api${path}`, { method, headers: { cookie: c, 'content-type': 'application/json', 'x-requested-with': 'admin-panel' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: (await r.json()) as any }; };

  it('list/edit/reset with validation, previews and permissions', async () => {
    const c = await login(9000n);
    const list = (await call(c, 'GET', '/texts')).json.items as any[];
    expect(list.length).toBe(Object.keys(TEXT_DEFS).length);
    expect(list.find((t) => t.key === 'welcome')).toMatchObject({ isDefault: true, vars: [{ name: 'name' }] });
    expect(list.every((t) => !/\{\w+\}/.test(t.preview))).toBe(true);
    expect((await call(c, 'PUT', '/texts', { key: 'welcome', value: 'سلام {name} 👋' })).status).toBe(200);
    expect((await call(c, 'PUT', '/texts', { key: 'welcome', value: 'سلام {x}' })).status).toBe(400);
    expect((await call(c, 'PUT', '/texts', { key: 'nope', value: 'x' })).status).toBe(404);
    expect((await call(c, 'PUT', '/texts', { key: 'btn.buy', value: 'a\nb' })).status).toBe(400);
    expect(((await call(c, 'GET', '/texts')).json.items as any[]).find((t) => t.key === 'welcome')).toMatchObject({ isDefault: false, value: 'سلام {name} 👋' });
    expect((await call(c, 'DELETE', '/texts/welcome')).json.ok).toBe(true);
    expect((await call(c, 'DELETE', '/texts/btn.buy')).status).toBe(200);
    await prisma.admin.create({ data: { telegramId: 81n, role: 'VPN_ADMIN' } });
    const c2 = await login(81n);
    expect((await call(c2, 'GET', '/texts')).status).toBe(403);
    expect((await call(c2, 'PUT', '/texts', { key: 'welcome', value: 'x' })).status).toBe(403);
    await prisma.admin.create({ data: { telegramId: 82n, role: 'PRODUCT_ADMIN' } });
    expect((await call(await login(82n), 'GET', '/texts')).status).toBe(200);
    expect((await call(c, 'GET', '/me')).json.permissions).toContain('texts.manage');
  });
});
