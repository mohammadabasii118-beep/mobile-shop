'use server';

import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { all, get, run, tx } from '../db';
import { assertAdmin } from '../auth';
import { normDigits, normText } from '../format';
import { DRIVERS } from '../payment-drivers';
import { parseCfg, type PayMethod } from '../payment-methods';
import type { AState } from '@/components/admin/client';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const money = (fd: FormData, k: string) => Math.max(0, Math.min(1_000_000_000_000, parseInt(normDigits(str(fd, k)).replace(/\D/g, ''), 10) || 0));
const done = () => { revalidatePath('/admin/payment-methods'); revalidatePath('/checkout'); revalidatePath('/admin/payments'); };

/** مشکل پیکربندی که روشن‌شدن روش را مسدود می‌کند (یا null) */
function blocker(driver: string, cfg: Record<string, string>): string | null {
  const d = DRIVERS[driver];
  if (!d) return 'درایور روش شناخته‌شده نیست';
  if (!d.implemented) return 'اتصال این درگاه هنوز پیاده‌سازی نشده است (نیازمند قرارداد پذیرنده و مستندات رسمی)';
  for (const f of d.fields) if (f.required && !(cfg[f.key] ?? '').trim()) return `«${f.label}» را وارد کنید`;
  if (driver === 'card' && !/^\d{16}$/.test((cfg.card_number ?? '').replace(/\D/g, ''))) return 'شماره کارت باید ۱۶ رقم باشد';
  return null;
}

export async function saveMethod(id: number | null, driverNew: string, _p: AState, fd: FormData): Promise<AState> {
  await assertAdmin();
  const cur = id ? get<PayMethod>('SELECT * FROM payment_methods WHERE id = ?', id) : undefined;
  if (id && !cur) return { error: 'روش پرداخت پیدا نشد' };
  const driver = cur?.driver ?? driverNew;
  const d = DRIVERS[driver];
  if (!d || (!cur && !d.multiple)) return { error: 'این نوع روش را نمی‌توان اضافه کرد' };
  const title = normText(str(fd, 'title')).slice(0, 80);
  if (title.length < 2) return { error: 'عنوان روش را وارد کنید' };
  const min = money(fd, 'min_amount'), max = money(fd, 'max_amount');
  if (max && max < min) return { error: 'حداکثر مبلغ نمی‌تواند از حداقل کمتر باشد' };
  const old = parseCfg(cur?.config ?? '{}');
  const cfg: Record<string, string> = {};
  for (const f of d.fields) {
    let v = str(fd, `cfg_${f.key}`);
    if (f.type === 'password' && !v) v = old[f.key] ?? '';          // خالی = بدون تغییر
    if (f.type === 'card') v = normDigits(v).replace(/\D/g, '');
    if (f.key === 'sheba') v = normDigits(v).replace(/\s/g, '').toUpperCase();
    cfg[f.key] = (f.type === 'textarea' ? v.replace(/\r/g, '') : normText(v)).slice(0, 600);
  }
  if (driver === 'card' && cfg.card_number && cfg.card_number.length !== 16) return { error: 'شماره کارت باید ۱۶ رقم باشد' };
  const description = normText(str(fd, 'description')).slice(0, 160);
  const wantsOn = !!fd.get('enabled');
  const why = wantsOn ? blocker(driver, cfg) : null;
  if (why) return { error: `روشن نشد: ${why}` };
  if (cur) {
    run('UPDATE payment_methods SET title = ?, description = ?, min_amount = ?, max_amount = ?, config = ?, enabled = ? WHERE id = ?', title, description, min, max, JSON.stringify(cfg), wantsOn ? 1 : 0, cur.id);
  } else {
    const code = `${driver}-${crypto.randomBytes(3).toString('hex')}`;
    const sort = (get<{ m: number | null }>('SELECT MAX(sort) m FROM payment_methods WHERE sort < 9')?.m ?? 0) + 1;
    run('INSERT INTO payment_methods (code, driver, title, description, enabled, sort, min_amount, max_amount, config, builtin) VALUES (?,?,?,?,?,?,?,?,?,0)', code, driver, title, description, wantsOn ? 1 : 0, sort, min, max, JSON.stringify(cfg));
  }
  done();
  return { ok: cur ? 'روش پرداخت ذخیره شد' : 'روش پرداخت اضافه شد' };
}

export async function toggleMethod(id: number): Promise<AState> {
  await assertAdmin();
  const m = get<PayMethod>('SELECT * FROM payment_methods WHERE id = ?', id);
  if (!m) return { error: 'روش پرداخت پیدا نشد' };
  if (!m.enabled) {
    const why = blocker(m.driver, parseCfg(m.config));
    if (why) return { error: `روشن نشد: ${why}` };
  }
  run('UPDATE payment_methods SET enabled = ? WHERE id = ?', m.enabled ? 0 : 1, id);
  done();
  return { ok: m.enabled ? 'روش خاموش شد' : 'روش روشن شد' };
}

export async function moveMethod(id: number, dir: -1 | 1): Promise<AState> {
  await assertAdmin();
  const list = all<{ id: number }>('SELECT id FROM payment_methods ORDER BY sort, id');
  const i = list.findIndex((x) => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  tx(() => list.forEach((x, k) => run('UPDATE payment_methods SET sort = ? WHERE id = ?', k + 1, x.id)));
  done();
}

export async function deleteMethod(id: number): Promise<AState> {
  await assertAdmin();
  const m = get<PayMethod>('SELECT * FROM payment_methods WHERE id = ?', id);
  if (!m) return { error: 'روش پرداخت پیدا نشد' };
  if (m.builtin) return { error: 'روش‌های پیش‌فرض حذف نمی‌شوند؛ آن را خاموش کنید' };
  if (get('SELECT 1 FROM payments WHERE method = ? LIMIT 1', m.code)) return { error: 'برای این روش تراکنش ثبت شده است؛ به‌جای حذف آن را خاموش کنید' };
  run('DELETE FROM payment_methods WHERE id = ?', id);
  done();
  return { ok: 'روش پرداخت حذف شد' };
}
