'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { get, run } from '../db';
import { getMethod } from '../payment-methods';
import { createSession, destroySession, getUser, hashPassword, loginAllowed, loginFailed, loginOk, verifyPassword } from '../auth';
import { isValidIranMobile, normDigits, normText } from '../format';
import { onlineGatewayEnabled } from '../payments';
import { DRIVERS } from '../payment-drivers';
import { orderPayCode } from '../payment-methods';
import { checkCoupon, placeOrder, priceCart, shippingFor } from '../orders';
import type { CartInput, CartLine } from '../types';

export type FormState = { error?: string; ok?: string; fields?: Record<string, string> } | undefined;
const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

/* ───── سبد ───── */
export async function getCartLines(items: CartInput[], coupon: string): Promise<{
  lines: CartLine[]; subtotal: number; discount: number; shipping: number; total: number; freeMin: number; couponError?: string; couponCode?: string;
}> {
  const lines = priceCart(items.filter((i) => Number.isInteger(i.productId)));
  const subtotal = lines.filter((l) => l.ok).reduce((a, l) => a + l.price * l.qty, 0);
  let discount = 0, couponError: string | undefined, couponCode: string | undefined;
  if (coupon.trim()) {
    const r = checkCoupon(coupon, subtotal);
    if (r.ok) { discount = r.discount; couponCode = r.coupon.code; } else couponError = r.error;
  }
  const sh = shippingFor(subtotal - discount);
  return { lines, subtotal, discount, shipping: sh.shipping, total: subtotal - discount + sh.shipping, freeMin: sh.freeMin, couponError, couponCode };
}

export async function getWishlistItems(ids: number[]) {
  const { listProducts } = await import('../catalog');
  return listProducts({ ids: ids.filter(Number.isInteger).slice(0, 60), limit: 60 }).items;
}

/* ───── سفارش ───── */
export async function submitOrder(_prev: FormState, fd: FormData): Promise<FormState> {
  const fields = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string')) as Record<string, string>;
  let items: CartInput[] = [];
  try {
    const raw = JSON.parse(s(fd, 'items'));
    if (Array.isArray(raw)) items = raw.map((i) => ({ productId: Number(i.productId), variationId: i.variationId ? Number(i.variationId) : null, qty: Number(i.qty) || 1 })).filter((i) => Number.isInteger(i.productId));
  } catch { /* noop */ }
  const name = normText(s(fd, 'name')), phone = normDigits(s(fd, 'phone')).replace(/\s/g, ''), address = normText(s(fd, 'address'));
  if (name.length < 3) return { error: 'نام و نام خانوادگی را کامل وارد کنید', fields };
  if (!isValidIranMobile(phone)) return { error: 'شماره موبایل معتبر نیست (مثال: ۰۹۱۲۱۲۳۴۵۶۷)', fields };
  if (address.length < 10) return { error: 'نشانی را کامل‌تر وارد کنید', fields };
  const postal = normDigits(s(fd, 'postal')).replace(/\D/g, '');
  if (postal && postal.length !== 10) return { error: 'کد پستی باید ۱۰ رقم باشد', fields };
  const method = s(fd, 'method');
  const user = await getUser();
  const r = placeOrder(items, {
    name, phone, email: s(fd, 'email'), province: normText(s(fd, 'province')), city: normText(s(fd, 'city')), address, postal, note: normText(s(fd, 'note')),
    method, coupon: s(fd, 'coupon'), userId: user?.id ?? null,
  });
  if (!r.ok) return { error: r.error, fields };
  redirect(DRIVERS[r.driver]?.kind === 'cod' ? `/checkout/success/${r.number}` : `/pay/${r.number}`);
}

/** درگاه آزمایشی: در محیط واقعی با درگاه بانکی جایگزین شود (lib/payments.ts در README توضیح داده شده) */
export async function finishPayment(number: string, ok: boolean) {
  if (!onlineGatewayEnabled()) redirect(`/checkout/success/${number}`);
  const o = get<{ id: number; total: number; payment_status: string; pay_code: string | null; payment_method: string }>('SELECT id, total, payment_status, pay_code, payment_method FROM orders WHERE number = ?', number);
  if (!o || o.payment_status === 'paid' || (o.pay_code ?? 'test') !== 'test') redirect(`/checkout/success/${number}`);
  run('UPDATE payments SET status = ?, ref = ? WHERE order_id = ? AND status = ?', ok ? 'success' : 'failed', ok ? `TEST-${Date.now().toString(36).toUpperCase()}` : null, o!.id, 'pending');
  run('UPDATE orders SET payment_status = ?, status = CASE WHEN ? THEN \'processing\' ELSE status END WHERE id = ?', ok ? 'paid' : 'failed', ok ? 1 : 0, o!.id);
  redirect(`/checkout/success/${number}${ok ? '' : '?failed=1'}`);
}

/** کارت‌به‌کارت: مشتری اطلاعات واریز را ثبت می‌کند؛ پرداخت تا تأیید مدیر «در انتظار» می‌ماند. */
export async function submitCardReceipt(number: string, _p: FormState, fd: FormData): Promise<FormState> {
  const o = get<{ id: number; payment_status: string; pay_code: string | null; payment_method: string }>('SELECT id, payment_status, pay_code, payment_method FROM orders WHERE number = ?', number);
  if (!o || o.payment_status === 'paid') return { error: 'این سفارش در انتظار پرداخت نیست' };
  const m = getMethod(orderPayCode(o));
  if (!m || DRIVERS[m.driver]?.kind !== 'manual') return { error: 'روش پرداخت این سفارش کارت‌به‌کارت نیست' };
  const tracking = normDigits(s(fd, 'tracking')).replace(/\s/g, '').slice(0, 40);
  const last4 = normDigits(s(fd, 'last4')).replace(/\D/g, '');
  const note = normText(s(fd, 'note')).slice(0, 300);
  if (tracking.length < 4) return { error: 'کد پیگیری یا شماره‌ی مرجع تراکنش را وارد کنید' };
  if (last4 && last4.length !== 4) return { error: 'چهار رقم آخر کارت باید دقیقاً ۴ رقم باشد' };
  run("UPDATE payments SET ref = ?, meta = ? WHERE order_id = ? AND status = 'pending'", tracking, JSON.stringify({ last4, note, at: new Date().toISOString() }), o.id);
  redirect(`/checkout/success/${number}?receipt=1`);
}

/* ───── حساب کاربری ───── */
export async function login(_p: FormState, fd: FormData): Promise<FormState> {
  const loginName = normDigits(s(fd, 'login')).toLowerCase();
  const key = `c:${loginName}`;
  if (!loginAllowed(key)) return { error: 'تلاش‌های ناموفق زیاد بود. ۱۰ دقیقه بعد دوباره امتحان کنید.' };
  const u = get<{ id: number; password_hash: string; active: number; role: string }>('SELECT id, password_hash, active, role FROM users WHERE login = ?', loginName);
  if (!u || !u.active || !verifyPassword(s(fd, 'password'), u.password_hash)) { loginFailed(key); return { error: 'شماره موبایل یا رمز عبور درست نیست', fields: { login: s(fd, 'login') } }; }
  loginOk(key);
  await createSession(u.id);
  const next = s(fd, 'next');
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/account');
}

export async function register(_p: FormState, fd: FormData): Promise<FormState> {
  const name = normText(s(fd, 'name')), phone = normDigits(s(fd, 'login')).replace(/\s/g, ''), pw = s(fd, 'password');
  const fields = { name, login: phone };
  if (name.length < 3) return { error: 'نام و نام خانوادگی را وارد کنید', fields };
  if (!isValidIranMobile(phone)) return { error: 'شماره موبایل معتبر نیست', fields };
  if (pw.length < 6) return { error: 'رمز عبور حداقل ۶ نویسه باشد', fields };
  if (get('SELECT 1 FROM users WHERE login = ?', phone)) return { error: 'با این شماره قبلاً ثبت‌نام شده است. وارد شوید.', fields };
  const info = run('INSERT INTO users (name, login, password_hash, role) VALUES (?,?,?,?)', name, phone, hashPassword(pw), 'customer');
  await createSession(Number(info.lastInsertRowid));
  redirect('/account');
}

export async function logout() {
  await destroySession();
  redirect('/');
}

export async function updateProfile(_p: FormState, fd: FormData): Promise<FormState> {
  const u = await getUser();
  if (!u) redirect('/account/login');
  const name = normText(s(fd, 'name'));
  if (name.length < 3) return { error: 'نام را کامل وارد کنید' };
  const pw = s(fd, 'password');
  run('UPDATE users SET name = ? WHERE id = ?', name, u.id);
  if (pw) {
    if (pw.length < 6) return { error: 'رمز عبور حداقل ۶ نویسه باشد' };
    run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(pw), u.id);
  }
  revalidatePath('/account');
  return { ok: 'اطلاعات ذخیره شد' };
}

/* ───── نظرات ───── */
export async function submitReview(productId: number, _p: FormState, fd: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: 'برای ثبت نظر وارد حساب کاربری شوید' };
  const rating = Math.max(1, Math.min(5, Number(normDigits(s(fd, 'rating'))) || 0));
  const body = normText(s(fd, 'body'));
  if (!rating) return { error: 'امتیاز را انتخاب کنید' };
  if (body.length < 10) return { error: 'متن نظر حداقل ۱۰ نویسه باشد' };
  const author = normText(s(fd, 'author')) || user.name || 'کاربر';
  run('INSERT INTO reviews (product_id, author, rating, body, approved) VALUES (?,?,?,?,0)', productId, author.slice(0, 60), rating, body.slice(0, 1500));
  return { ok: 'نظر شما ثبت شد و پس از تأیید مدیر نمایش داده می‌شود' };
}
