'use server';

import { revalidatePath } from 'next/cache';
import { all, get, run, tx } from '../db';
import { assertAdmin, hashPassword } from '../auth';
import { isValidIranMobile, normDigits, normText } from '../format';
import { adjustStock, restockOrder } from '../orders';
import type { AState } from '@/components/admin/client';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const LOST = ['cancelled', 'returned'];
const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
const PAY = ['unpaid', 'paid', 'failed', 'refunded'];

function applyOrderStatus(id: number, status: string) {
  const o = get<{ status: string; number: string }>('SELECT status, number FROM orders WHERE id = ?', id);
  if (!o || o.status === status) return;
  if (!LOST.includes(o.status) && LOST.includes(status)) restockOrder(id, `${status === 'cancelled' ? 'لغو' : 'مرجوعی'} سفارش ${o.number}`);
  if (LOST.includes(o.status) && !LOST.includes(status)) {
    for (const i of all<{ product_id: number | null; variation_id: number | null; qty: number }>('SELECT product_id, variation_id, qty FROM order_items WHERE order_id = ?', id)) {
      if (i.product_id) adjustStock(i.product_id, i.variation_id, -i.qty, `بازگشایی سفارش ${o.number}`);
    }
  }
  run('UPDATE orders SET status = ? WHERE id = ?', status, id);
}

export async function updateOrder(id: number, _p: AState, fd: FormData): Promise<AState> {
  await assertAdmin();
  const status = str(fd, 'status'), pay = str(fd, 'payment_status');
  if (!STATUSES.includes(status) || !PAY.includes(pay)) return { error: 'وضعیت نامعتبر است' };
  tx(() => {
    applyOrderStatus(id, status);
    const old = get<{ payment_status: string }>('SELECT payment_status FROM orders WHERE id = ?', id)!.payment_status;
    run('UPDATE orders SET payment_status = ?, tracking_code = ?, admin_note = ? WHERE id = ?', pay, normText(str(fd, 'tracking_code')), str(fd, 'admin_note').slice(0, 1000), id);
    if (old !== pay) run('UPDATE payments SET status = ? WHERE order_id = ? AND id = (SELECT MAX(id) FROM payments WHERE order_id = ?)', pay === 'paid' ? 'success' : pay === 'failed' ? 'failed' : pay === 'refunded' ? 'refunded' : 'pending', id, id);
  });
  revalidatePath('/admin/orders'); revalidatePath(`/admin/orders/${id}`);
  return { ok: 'سفارش به‌روزرسانی شد' };
}

export async function quickOrderStatus(id: number, status: string): Promise<AState> {
  await assertAdmin();
  if (!STATUSES.includes(status)) return { error: 'وضعیت نامعتبر است' };
  tx(() => applyOrderStatus(id, status));
  revalidatePath('/admin/orders'); revalidatePath(`/admin/orders/${id}`);
  return { ok: 'وضعیت سفارش تغییر کرد' };
}

export async function setPaymentStatus(paymentId: number, status: 'success' | 'failed' | 'refunded' | 'pending'): Promise<AState> {
  await assertAdmin();
  const p = get<{ order_id: number }>('SELECT order_id FROM payments WHERE id = ?', paymentId);
  if (!p) return { error: 'پرداخت پیدا نشد' };
  tx(() => {
    run('UPDATE payments SET status = ? WHERE id = ?', status, paymentId);
    run('UPDATE orders SET payment_status = ? WHERE id = ?', status === 'success' ? 'paid' : status === 'failed' ? 'failed' : status === 'refunded' ? 'refunded' : 'unpaid', p.order_id);
    if (status === 'success') run("UPDATE orders SET status = 'processing' WHERE id = ? AND status = 'pending'", p.order_id);
  });
  revalidatePath('/admin/payments'); revalidatePath('/admin/orders');
  return { ok: 'وضعیت پرداخت تغییر کرد' };
}

/* ───── کاربران ───── */
export async function createUser(_p: AState, fd: FormData): Promise<AState> {
  await assertAdmin();
  const name = normText(str(fd, 'name')), login = normDigits(str(fd, 'login')).toLowerCase().replace(/\s/g, ''), pw = str(fd, 'password');
  const role = str(fd, 'role') === 'admin' ? 'admin' : 'customer';
  if (name.length < 2) return { error: 'نام را وارد کنید' };
  if (role === 'customer' ? !isValidIranMobile(login) : !/^[a-z0-9_.@-]{3,40}$/.test(login)) return { error: role === 'customer' ? 'شماره موبایل معتبر نیست' : 'نام کاربری فقط حروف انگلیسی، عدد و _ . - باشد (حداقل ۳ نویسه)' };
  if (pw.length < 6) return { error: 'رمز عبور حداقل ۶ نویسه باشد' };
  if (get('SELECT 1 FROM users WHERE login = ?', login)) return { error: 'این نام کاربری قبلاً ثبت شده است' };
  run('INSERT INTO users (name, login, password_hash, role) VALUES (?,?,?,?)', name, login, hashPassword(pw), role);
  revalidatePath('/admin/users');
  return { ok: 'کاربر ساخته شد' };
}

export async function updateUser(id: number, _p: AState, fd: FormData): Promise<AState> {
  const me = await assertAdmin();
  const u = get<{ id: number; role: string }>('SELECT id, role FROM users WHERE id = ?', id);
  if (!u) return { error: 'کاربر پیدا نشد' };
  const role = str(fd, 'role') === 'admin' ? 'admin' : 'customer';
  const active = fd.get('active') ? 1 : 0;
  if (id === me.id && (role !== 'admin' || !active)) return { error: 'نمی‌توانید نقش یا فعال بودن حساب خودتان را تغییر دهید' };
  run('UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?', normText(str(fd, 'name')), role, active, id);
  const pw = str(fd, 'password');
  if (pw) { if (pw.length < 6) return { error: 'رمز عبور حداقل ۶ نویسه باشد' }; run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(pw), id); }
  revalidatePath('/admin/users');
  return { ok: 'کاربر ذخیره شد' };
}

/* ───── نظرات ───── */
export async function moderateReview(id: number, op: 'approve' | 'unapprove' | 'delete' | 'home' | 'unhome'): Promise<AState> {
  await assertAdmin();
  if (op === 'approve') run('UPDATE reviews SET approved = 1 WHERE id = ?', id);
  else if (op === 'unapprove') run('UPDATE reviews SET approved = 0, show_home = 0 WHERE id = ?', id);
  else if (op === 'delete') run('DELETE FROM reviews WHERE id = ?', id);
  else if (op === 'home') run('UPDATE reviews SET show_home = 1, approved = 1 WHERE id = ?', id);
  else run('UPDATE reviews SET show_home = 0 WHERE id = ?', id);
  revalidatePath('/admin/reviews');
  return { ok: 'انجام شد' };
}
