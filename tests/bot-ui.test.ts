import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client';
import { createBot } from '../src/bot';
import { makeProduct, makeUser, resetDb, setup, makeOrder, submit } from './helpers';
import { approvePayment } from '../src/modules/payments/service';
import { createCoupon } from '../src/modules/coupons/service';

const U = 6001;
let api: { method: string; payload: any }[] = [];
let bot: ReturnType<typeof createBot>;
let uid = 1;
beforeEach(async () => {
  await resetDb(); setup(); api = [];
  bot = createBot('123:TEST', { botInfo: { id: 123, is_bot: true, first_name: 'B', username: 'b', can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false, allows_users_to_create_topics: false } as any, fetchFile: async () => Buffer.from('x') });
  bot.api.config.use(async (_p, method, payload: any) => { api.push({ method, payload }); return { ok: true, result: method.startsWith('send') || method.startsWith('edit') ? { message_id: api.length, date: 0, chat: { id: payload.chat_id ?? 1, type: 'private' }, text: payload.text } : true } as any; });
});
const from = (id: number) => ({ id, is_bot: false, first_name: 'علی', username: `u${id}` });
const chat = (id: number) => ({ id, type: 'private' as const });
const say = (text: string, id = U) => bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, chat: chat(id), from: from(id), text, entities: text.startsWith('/') ? [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }] : undefined } } as any);
const tap = (data: string, id = U) => bot.handleUpdate({ update_id: uid++, callback_query: { id: String(uid), from: from(id), chat_instance: 'x', data, message: { message_id: 1, date: 0, chat: chat(id), text: 'x' } } } as any);
const out = () => api.filter((c) => ['sendMessage', 'editMessageText'].includes(c.method));
const last = () => out().at(-1)!;
const text = () => String(last().payload.text);
const cbs = (c = last()) => (c.payload.reply_markup?.inline_keyboard ?? []).flat().map((b: any) => b.callback_data).filter(Boolean) as string[];
const labels = (c = last()) => (c.payload.reply_markup?.inline_keyboard ?? []).flat().map((b: any) => b.text) as string[];

describe('Telegram UX', () => {
  it('main menu: personalised, the 7 required entries + partner, mobile-friendly rows (max 2 per row)', async () => {
    await say('/start');
    expect(text()).toContain('سلام علی');
    expect(last().payload.parse_mode).toBe('HTML');
    expect(labels()).toEqual(['🛒 خرید VPN', '📦 سرویس‌های من', '💳 سفارش‌های من', '👤 حساب من', '🎁 کد تخفیف', '🎫 پشتیبانی', '📜 قوانین', '🤝 همکاری']);
    expect(last().payload.reply_markup.inline_keyboard.every((r: any[]) => r.length <= 2)).toBe(true);
  });

  it('no screen is a dead end: every main-menu page offers back/home', async () => {
    for (const d of ['menu:buy', 'menu:services', 'menu:orders', 'menu:account', 'menu:coupon', 'menu:support', 'menu:rules', 'menu:partner', 'tk:new']) {
      await tap(d);
      expect(cbs().some((x) => x === 'menu:main' || x.startsWith('menu:') || x.startsWith('tk:') ), d).toBe(true);
      expect(labels().join(' '), d).toMatch(/بازگشت|منو/);
    }
  });

  it('buy page shows a card per plan; summary shows price/discount/final; payment page has copyable card number', async () => {
    const p = await makeProduct({ name: 'پلن طلایی', price: 300000, description: 'عالی' });
    await createCoupon('t', { code: 'OFF10', type: 'PERCENT', value: 10 });
    await tap('menu:buy');
    expect(text()).toContain('یکی را انتخاب کنید'); // short prompt only — no long plan cards
    expect(text()).not.toContain('موجود');
    expect(labels().join(' ')).toMatch(/پلن طلایی[\s\S]*۳۰۰,۰۰۰ تومان/); // plan = one button: name · price
    expect(cbs()).toContain(`buy:${p.id}`);
    await tap(`buy:${p.id}`);
    expect(text()).toMatch(/قیمت اصلی: ۳۰۰,۰۰۰[\s\S]*تخفیف: —[\s\S]*مبلغ نهایی: <b>۳۰۰,۰۰۰/);
    expect(cbs()).toContain(`bo:${p.id}`); expect(cbs()).toContain(`uc:${p.id}`);
    // coupon via the order summary returns to the summary with the discount applied
    await tap(`uc:${p.id}`); await say('off10');
    expect(text()).toMatch(/تخفیف: ۳۰,۰۰۰[\s\S]*مبلغ نهایی: <b>۲۷۰,۰۰۰/);
    await tap(`bo:${p.id}`);
    expect(text()).toContain('<code>6037991122334455</code>');
    expect(text()).toContain('۲۷۰,۰۰۰ تومان');
    expect(text()).toMatch(/مرحله ۲ از ۳/);
  });

  it('invalid coupon: friendly error with a way out, user stays able to retry', async () => {
    await tap('menu:coupon'); await say('NOPE');
    expect(text()).toMatch(/❌[\s\S]*نامعتبر/);
    expect(labels().join(' ')).toMatch(/منو/);
    await createCoupon('t', { code: 'GOOD', type: 'FIXED', value: 1000 });
    await say('good');
    expect(out().some((c) => String(c.payload.text).includes('کد تخفیف ثبت شد'))).toBe(true);
  });

  it('cancelling an order asks for confirmation first', async () => {
    const p = await makeProduct();
    await tap(`bo:${p.id}`);
    const o = await prisma.order.findFirstOrThrow();
    await tap(`oc:${o.id}`);
    expect(text()).toContain('لغو شود؟');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe('PENDING_PAYMENT');
    expect(cbs()).toEqual([`oc2:${o.id}`, `ov:${o.id}`]);
    await tap(`oc2:${o.id}`);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe('CANCELLED');
    expect(text()).toContain('سفارش لغو شد');
  });

  it('users never see raw technical status names; order screen shows a friendly timeline', async () => {
    const p = await makeProduct();
    await tap(`bo:${p.id}`);
    const o = await prisma.order.findFirstOrThrow({ include: { user: true } });
    await tap(`rc:${o.id}`); await say('ref 99887766');
    await tap(`ov:${o.id}`);
    expect(text()).toMatch(/در حال بررسی پرداخت/);
    expect(text()).toMatch(/✅ سفارش|🔸 بررسی|▫️ تحویل/);
    await prisma.order.update({ where: { id: o.id }, data: { status: 'PROVISIONING' } });
    await tap(`ov:${o.id}`);
    expect(text()).toContain('سرویس شما در حال آماده‌سازی است...');
    const all = api.map((c) => String(c.payload.text ?? '')).join('\n');
    expect(all).not.toMatch(/\b(PENDING_PAYMENT|PAYMENT_SUBMITTED|PAYMENT_REVIEW|PROVISIONING|FULFILLED|NEEDS_REVIEW|SUBMITTED|APPROVED)\b/);
  });

  it('fallbacks: random text and stale buttons get a friendly menu, never silence', async () => {
    await say('سلام چطوری');
    expect(text()).toContain('متوجه نشدم'); expect(cbs()).toContain('menu:buy');
    await tap('totally:unknown');
    expect(text()).toContain('دیگر معتبر نیست'); expect(cbs()).toContain('menu:buy');
    await tap('menu:coupon'); await say('/start');
    expect(text()).toContain('خوش آمدید');
  });

  it('service screens adapt to state: active / expired / suspended; no fake usage before first sync', async () => {
    const user = await makeUser(U); const p = await makeProduct();
    const o = await makeOrder(user.id, p.id); const pay = await submit(user.id, o.id, { trackingCode: '12312312' });
    await approvePayment(pay.id, { actor: 'a' });
    const svc = await prisma.vpnService.findFirstOrThrow();
    await tap('menu:services');
    expect(text()).toMatch(/🟢 فعال · ۳۰ روز مانده/);
    await prisma.vpnService.update({ where: { id: svc.id }, data: { lastSyncAt: null } });
    await tap(`sv:v:${svc.id}`);
    expect(text()).toContain('به‌زودی به‌روزرسانی می‌شود');
    expect(text()).not.toMatch(/باقی‌مانده/);
    expect(cbs()).toEqual(expect.arrayContaining([`sv:link:${svc.id}`, `sv:qr:${svc.id}`, `sv:renew:${svc.id}`]));
    await prisma.vpnService.update({ where: { id: svc.id }, data: { status: 'EXPIRED', expiresAt: new Date(Date.now() - 86_400_000) } });
    await tap(`sv:v:${svc.id}`);
    expect(text()).toContain('منقضی شده'); expect(cbs()).toContain(`sv:renew:${svc.id}`); expect(cbs()).not.toContain(`sv:link:${svc.id}`);
    await prisma.vpnService.update({ where: { id: svc.id }, data: { status: 'SUSPENDED' } });
    await tap(`sv:v:${svc.id}`);
    expect(text()).toContain('معلق'); expect(cbs()).toContain('menu:support'); expect(cbs()).not.toContain(`sv:renew:${svc.id}`);
  });

  it('HTML safety: hostile product names/ticket text are escaped; only b/i/code tags are emitted', async () => {
    const hostile = await makeProduct({ name: '<script>alert(1)</script> & co' });
    await tap('menu:buy');
    expect(text()).not.toContain('<script>'); // buy list: names live in plain-text buttons only
    expect(labels().join(' ')).toContain('<script>alert(1)</script> & co'); // button text is never parsed as HTML
    await tap(`buy:${hostile.id}`);
    expect(text()).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; co'); // HTML screens escape it
    for (const c of api) {
      if (c.payload.parse_mode !== 'HTML') continue;
      const stripped = String(c.payload.text).replace(/<\/?(b|i|code)>/g, '');
      expect(stripped).not.toMatch(/<[^>]*>/);
    }
  });
});
