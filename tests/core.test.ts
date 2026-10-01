import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client';
import { makeOrder, makeProduct, makeUser, resetDb, setup, submit } from './helpers';
import { upsertUser } from '../src/modules/users/service';
import { cancelOrder, createOrder, getOrderForUser, listUserOrders } from '../src/modules/orders/service';
import { createCoupon, computeDiscount } from '../src/modules/coupons/service';
import { getServiceForUser, listUserServices } from '../src/modules/vpn/service';
import { approvePayment } from '../src/modules/payments/service';
import { getTicketForUser, createTicket, listUserTickets } from '../src/modules/support/service';
import { hasPermission, requirePermission } from '../src/modules/admin/rbac';
import { audit, redact } from '../src/modules/admin/audit';
import { RateLimiter } from '../src/utils/ratelimit';
import { loadEnv } from '../src/config/env';
import { parseReceiptText, jalaliToGregorian } from '../src/modules/payments/receipt';
import { assessRisk } from '../src/modules/payments/risk';
import { setSetting } from '../src/modules/settings/service';
import { CryptoPaymentProvider } from '../src/providers/payments/crypto';
import { notify, flushPending, setSender } from '../src/modules/notifications/service';

beforeEach(async () => { await resetDb(); setup(); });

describe('users', () => {
  it('registers once per telegramId and updates profile', async () => {
    const a = await upsertUser({ id: 55, username: 'x', first_name: 'A' });
    const b = await upsertUser({ id: 55, username: 'y', first_name: 'B' });
    expect(a.id).toBe(b.id);
    expect(b.username).toBe('y');
    expect(await prisma.user.count()).toBe(1);
  });
  it('users only see their own orders / orders by id / services / tickets', async () => {
    const u1 = await makeUser(), u2 = await makeUser();
    const p = await makeProduct();
    const o = await makeOrder(u1.id, p.id);
    expect(await listUserOrders(u2.id)).toHaveLength(0);
    await expect(getOrderForUser(u2.id, o.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(cancelOrder(u2.id, o.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(submit(u2.id, o.id, { trackingCode: '12345678' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const pay = await submit(u1.id, o.id, { trackingCode: '12345678' });
    await approvePayment(pay.id, { actor: 'a' });
    const svc = (await listUserServices(u1.id))[0];
    expect(await listUserServices(u2.id)).toHaveLength(0);
    await expect(getServiceForUser(u2.id, svc.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const t = await createTicket(u1.id, 'OTHER', 'hi', 'hello there');
    await expect(getTicketForUser(u2.id, t.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await listUserTickets(u2.id)).toHaveLength(0);
  });
});

describe('orders', () => {
  it('server computes amounts; inactive product / disabled method rejected', async () => {
    const u = await makeUser();
    const p = await makeProduct({ price: 100000 });
    const { order } = await createOrder({ userId: u.id, productId: p.id, paymentMethod: 'CARD_TO_CARD' });
    expect(order).toMatchObject({ amount: 100000, finalAmount: 100000, status: 'PENDING_PAYMENT' });
    const off = await makeProduct({ name: 'off', isActive: false });
    await expect(createOrder({ userId: u.id, productId: off.id, paymentMethod: 'CARD_TO_CARD' })).rejects.toThrow();
    await expect(createOrder({ userId: u.id, productId: p.id, paymentMethod: 'CRYPTO' })).rejects.toThrow(/فعال نیست/);
    await setSetting('card.enabled', 'false');
    await expect(createOrder({ userId: u.id, productId: p.id, paymentMethod: 'CARD_TO_CARD' })).rejects.toThrow(/فعال نیست/);
  });
  it('duplicate open order is reused; order numbers unique', async () => {
    const u = await makeUser(); const p = await makeProduct();
    const a = await createOrder({ userId: u.id, productId: p.id, paymentMethod: 'CARD_TO_CARD' });
    const b = await createOrder({ userId: u.id, productId: p.id, paymentMethod: 'CARD_TO_CARD' });
    expect(b.reused).toBe(true);
    expect(b.order.id).toBe(a.order.id);
    const p2 = await makeProduct({ name: 'x2' });
    const c = await createOrder({ userId: u.id, productId: p2.id, paymentMethod: 'CARD_TO_CARD' });
    expect(c.order.orderNumber).not.toBe(a.order.orderNumber);
  });
  it('cancel works only while unpaid and releases the coupon', async () => {
    const u = await makeUser(); const p = await makeProduct();
    await createCoupon('t', { code: 'off10', type: 'PERCENT', value: 10, maxUses: 1 });
    const { order } = await createOrder({ userId: u.id, productId: p.id, paymentMethod: 'CARD_TO_CARD', couponCode: 'OFF10' });
    expect(order.finalAmount).toBe(225000);
    expect((await prisma.coupon.findFirstOrThrow()).usedCount).toBe(1);
    await cancelOrder(u.id, order.id);
    expect((await prisma.coupon.findFirstOrThrow()).usedCount).toBe(0);
    await expect(cancelOrder(u.id, order.id)).rejects.toThrow();
    const o2 = await makeOrder(u.id, p.id);
    const pay = await submit(u.id, o2.id, { trackingCode: '55555555' });
    await expect(cancelOrder(u.id, o2.id)).rejects.toThrow(); // already submitted
    expect(pay.status).toBe('NEEDS_REVIEW');
  });
});

describe('coupons', () => {
  it('percent/fixed math, caps, expiry, maxUses, once per user', async () => {
    expect(computeDiscount('PERCENT', 20, 1000)).toBe(200);
    expect(computeDiscount('FIXED', 5000, 1000)).toBe(1000);
    const p = await makeProduct({ price: 100000 });
    await createCoupon('t', { code: 'fix', type: 'FIXED', value: 30000, maxUses: 1 });
    await createCoupon('t', { code: 'old', type: 'FIXED', value: 1, expiresAt: new Date(Date.now() - 1000) });
    const u1 = await makeUser(), u2 = await makeUser();
    const { order } = await createOrder({ userId: u1.id, productId: p.id, paymentMethod: 'CARD_TO_CARD', couponCode: 'fix' });
    expect(order.finalAmount).toBe(70000);
    await expect(createOrder({ userId: u2.id, productId: p.id, paymentMethod: 'CARD_TO_CARD', couponCode: 'fix' })).rejects.toThrow(/ظرفیت/);
    await expect(createOrder({ userId: u2.id, productId: p.id, paymentMethod: 'CARD_TO_CARD', couponCode: 'old' })).rejects.toThrow(/منقضی/);
    await expect(createOrder({ userId: u2.id, productId: p.id, paymentMethod: 'CARD_TO_CARD', couponCode: 'nope' })).rejects.toThrow(/نامعتبر/);
  });
  it('coupon is race-safe (maxUses=1, concurrent orders)', async () => {
    const p = await makeProduct();
    await createCoupon('t', { code: 'race', type: 'PERCENT', value: 10, maxUses: 1 });
    const us = await Promise.all([makeUser(), makeUser(), makeUser()]);
    const r = await Promise.allSettled(us.map((u) => createOrder({ userId: u.id, productId: p.id, paymentMethod: 'CARD_TO_CARD', couponCode: 'race' })));
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect((await prisma.coupon.findFirstOrThrow()).usedCount).toBe(1);
  });
});

describe('admin permissions + audit', () => {
  it('role permissions are enforced; bootstrap admin is SUPER_ADMIN', async () => {
    expect(await hasPermission(9000n, 'settings.manage')).toBe(true); // ADMIN_TELEGRAM_ID
    await prisma.admin.create({ data: { telegramId: 11n, role: 'PAYMENT_ADMIN' } });
    await prisma.admin.create({ data: { telegramId: 12n, role: 'SUPPORT_ADMIN' } });
    await prisma.admin.create({ data: { telegramId: 13n, role: 'VPN_ADMIN', isActive: false } });
    expect(await hasPermission(11n, 'payments.review')).toBe(true);
    expect(await hasPermission(11n, 'vpn.delete')).toBe(false);
    expect(await hasPermission(12n, 'payments.review')).toBe(false);
    expect(await hasPermission(12n, 'support.reply')).toBe(true);
    expect(await hasPermission(13n, 'vpn.manage')).toBe(false); // inactive
    expect(await hasPermission(777n, 'stats.view')).toBe(false); // random user
    await expect(requirePermission(12n, 'products.manage')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('audit log strips secrets', async () => {
    await audit({ actor: 'a', action: 'x', metadata: { password: 'p', nested: { apiToken: 't', ok: 1 }, list: [{ secret: 's' }] } });
    const row = await prisma.auditLog.findFirstOrThrow();
    expect(JSON.stringify(row.metadata)).not.toMatch(/"p"|"t"|"s"/);
    expect(redact({ BOT_TOKEN: 'abc', n: 1 })).toEqual({ BOT_TOKEN: '[REDACTED]', n: 1 });
  });
  it('payment approval / rejection / provisioning produce a complete audit trail', async () => {
    const u = await makeUser(); const p = await makeProduct(); const o = await makeOrder(u.id, p.id);
    const pay = await submit(u.id, o.id, { trackingCode: '19191919' });
    await approvePayment(pay.id, { actor: 'admin:5' });
    const acts = (await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } })).map((a) => a.action);
    for (const a of ['order.create', 'payment.create', 'payment.submit', 'payment.needs_review', 'payment.approve', 'vpn.provision.start', 'vpn.provision.success']) expect(acts).toContain(a);
  });
});

describe('misc units', () => {
  it('rate limiter windows', () => {
    let t = 0;
    const rl = new RateLimiter(2, 1000, () => t);
    expect([rl.allow('a'), rl.allow('a'), rl.allow('a')]).toEqual([true, true, false]);
    expect(rl.allow('b')).toBe(true);
    t = 1500;
    expect(rl.allow('a')).toBe(true);
  });
  it('mock VPN provider is refused in production', () => {
    expect(() => loadEnv({ DATABASE_URL: 'x', NODE_ENV: 'production', VPN_PROVIDER: 'mock' } as any)).toThrow(/forbidden in production/);
    expect(loadEnv({ DATABASE_URL: 'x', NODE_ENV: 'production' } as any).VPN_PROVIDER).toBe('xui');
  });
  it('receipt parser handles Persian digits, rials, Jalali dates', () => {
    const r = parseReceiptText('انتقال موفق\nمبلغ: ۲٬۵۰۰٬۰۰۰ ریال\nشماره پیگیری: ۱۲۳۴۵۶۷۸۹۰\nتاریخ: ۱۴۰۵/۰۷/۱۰ ساعت ۱۴:۳۰\nبانک صادرات');
    expect(r).toMatchObject({ amount: 250000, trackingCode: '1234567890', date: '1405/07/10', time: '14:30', bank: 'صادرات' });
    expect(r.confidence).toBe(1);
    expect(new Date(r.occurredAt!).getUTCHours()).toBe(11); // 14:30 Tehran = 11:00 UTC
    expect(jalaliToGregorian(1403, 1, 1)).toEqual([2024, 3, 20]);
    expect(parseReceiptText('hello').confidence).toBe(0);
  });
  it('risk engine levels and factors', () => {
    const base = { orderAmount: 100, trackingMatchedLedger: true, matchedBy: 'tracking' as const, duplicateTracking: false, duplicateReceipt: false, ocrMinConfidence: 0.6, receiptTimeBeforeOrder: false, submissions24h: 1, maxSubmissions24h: 5, userRejectedCount: 0, userApprovedCount: 0, verificationVerified: true, trackingCode: 'abc12345' };
    const t = { mediumAt: 30, highAt: 60 };
    expect(assessRisk(base, t).level).toBe('LOW');
    expect(assessRisk({ ...base, duplicateTracking: true }, t).level).toBe('HIGH');
    expect(assessRisk({ ...base, verificationVerified: false }, t).level).toBe('MEDIUM');
    expect(assessRisk({ ...base, ocrAmount: 50 }, t).factors.map((f) => f.code)).toContain('amount_mismatch');
  });
  it('crypto stays DISABLED without a real chain verifier, even if flag is on', async () => {
    await setSetting('crypto.enabled', 'true');
    const c = new CryptoPaymentProvider();
    expect(await c.isEnabled()).toBe(false);
    await expect(c.createPayment({} as any)).rejects.toThrow();
    const u = await makeUser(); const pr = await makeProduct(); const o = await makeOrder(u.id, pr.id);
    const pay = await prisma.payment.create({ data: { orderId: o.id, userId: u.id, provider: 'CRYPTO', amount: 1 } });
    expect((await c.verifyPayment(pay.id)).result).toBe('UNKNOWN');
  });
  it('notifications persist, retry when sender fails, and dedupe', async () => {
    let fail = true; const got: string[] = [];
    setSender(async (m) => { if (fail) throw new Error('tg down'); got.push(m.text); });
    await notify({ chatId: 1n, type: 't', text: 'hello', dedupeKey: 'k1' });
    expect(await notify({ chatId: 1n, type: 't', text: 'hello', dedupeKey: 'k1' })).toBeNull();
    expect((await prisma.notification.findFirstOrThrow()).status).toBe('PENDING');
    fail = false;
    await flushPending();
    expect(got).toEqual(['hello']);
    expect((await prisma.notification.findFirstOrThrow()).status).toBe('SENT');
  });
});
