import { all, get, run, tx } from './db';
import { getSettings } from './catalog';
import { restockOrder } from './orders';

/** نشانه‌ی سفارش‌های نمونه‌ی seed (یادداشت مدیر) */
export const DEMO_NOTE = 'سفارش نمونه';
const AUTO_NOTE = (days: number) => `لغو خودکار: پرداخت تا ${days} روز انجام نشد.`;

/**
 * سفارش آنلاین/کارت‌به‌کارتِ پرداخت‌نشده‌ی قدیمی‌تر از `days` روز را لغو می‌کند (DESIGN.md §۱۸.۱۶).
 * روز = ۰ یعنی خاموش. تعداد سفارش‌های لغوشده را برمی‌گرداند.
 */
export function expireUnpaidOrders(days?: number): number {
  const d = days ?? Math.max(0, parseInt(getSettings().unpaid_cancel_days, 10) || 0);
  if (d <= 0) return 0;
  const stale = all<{ id: number; number: string; coupon_code: string | null }>(
    `SELECT o.id, o.number, o.coupon_code FROM orders o
      WHERE o.status = 'pending' AND o.payment_method = 'online' AND o.payment_status IN ('unpaid', 'failed')
        AND o.created_at <= datetime('now', ?)
        AND COALESCE(o.admin_note, '') <> ?
        AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND (p.status = 'success' OR p.ref IS NOT NULL OR p.meta IS NOT NULL))`,
    `-${d} days`, DEMO_NOTE);
  for (const o of stale) {
    tx(() => {
      restockOrder(o.id, `لغو خودکار سفارش ${o.number}`);
      run("UPDATE payments SET status = 'failed' WHERE order_id = ? AND status = 'pending'", o.id);
      run("UPDATE orders SET status = 'cancelled', payment_status = 'failed', admin_note = CASE WHEN COALESCE(admin_note, '') = '' THEN ? ELSE admin_note || char(10) || ? END WHERE id = ?", AUTO_NOTE(d), AUTO_NOTE(d), o.id);
      if (o.coupon_code) run('UPDATE coupons SET used = MAX(0, used - 1) WHERE UPPER(code) = UPPER(?)', o.coupon_code);
    });
  }
  return stale.length;
}

export function countDemoOrders(): number {
  return get<{ n: number }>('SELECT COUNT(*) n FROM orders WHERE admin_note = ?', DEMO_NOTE)?.n ?? 0;
}

/** فقط سفارش‌های نمونه (و آیتم‌ها/پرداخت‌هایشان با cascade) حذف می‌شود */
export function purgeDemoOrders(): number {
  const n = countDemoOrders();
  if (n) run('DELETE FROM orders WHERE admin_note = ?', DEMO_NOTE);
  return n;
}

let last = 0;
/** اجرای کم‌هزینه هنگام ورود به پنل: حداکثر هر ۵ دقیقه */
export function maybeExpireOrders() {
  if (Date.now() - last < 5 * 60_000) return;
  last = Date.now();
  try { expireUnpaidOrders(); } catch { /* نباید پنل را خراب کند */ }
}

/** زمان‌بند ساعتی در پس‌زمینه‌ی سرور (از instrumentation) */
export function startOrderExpiry() {
  const g = globalThis as unknown as { __caselineExpiry?: boolean };
  if (g.__caselineExpiry) return;
  g.__caselineExpiry = true;
  const tick = () => { try { expireUnpaidOrders(); } catch { /* noop */ } };
  setTimeout(tick, 30_000).unref?.();
  setInterval(tick, 60 * 60_000).unref?.();
}
