import { NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/auth';
import { all } from '@/lib/db';
import { ORDER_STATUS, PAY_STATUS, parseDbDate } from '@/lib/format';
import { orderPayCode, payLabels } from '@/lib/payment-methods';
import { tehranDate } from '@/lib/stats';

const esc = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // جلوگیری از اجرای فرمول در اکسل
  return `"${s.replace(/"/g, '""')}"`;
};
const csv = (head: string[], rows: unknown[][]) => '﻿' + [head, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');

export async function GET(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  try { await assertAdmin(); } catch { return new NextResponse('Unauthorized', { status: 401 }); }
  const { kind } = await ctx.params;
  const days = Number(new URL(req.url).searchParams.get('days')) || 0;
  let body = '';
  if (kind === 'orders') {
    const from = days ? tehranDate(-(days - 1)) : '1970-01-01';
    const labels = payLabels();
    const rows = all<{ number: string; created_at: string; customer_name: string; phone: string; province: string; city: string; address: string; status: string; payment_method: string; pay_code: string | null; payment_status: string; subtotal: number; discount: number; shipping: number; total: number; coupon_code: string | null; tracking_code: string }>(
      "SELECT * FROM orders WHERE date(created_at, '+210 minutes') >= ? ORDER BY id DESC", from);
    body = csv(['شماره سفارش', 'تاریخ', 'مشتری', 'موبایل', 'استان', 'شهر', 'نشانی', 'وضعیت', 'روش پرداخت', 'وضعیت پرداخت', 'جمع کالاها', 'تخفیف', 'ارسال', 'مبلغ نهایی', 'کد تخفیف', 'کد رهگیری'],
      rows.map((o) => [o.number, parseDbDate(o.created_at).toLocaleString('fa-IR-u-ca-persian', { timeZone: 'Asia/Tehran' }), o.customer_name, o.phone, o.province, o.city, o.address, ORDER_STATUS[o.status].label, labels[orderPayCode(o)] ?? orderPayCode(o), PAY_STATUS[o.payment_status].label, o.subtotal, o.discount, o.shipping, o.total, o.coupon_code ?? '', o.tracking_code]));
  } else if (kind === 'products') {
    const rows = all<{ name: string; sku: string | null; type: string; status: string; price: number; sale_price: number | null; stock: number; brand: string | null; cat: string | null }>(
      'SELECT p.name, p.sku, p.type, p.status, p.price, p.sale_price, p.stock, b.name brand, c.name cat FROM products p LEFT JOIN brands b ON b.id=p.brand_id LEFT JOIN categories c ON c.id=p.category_id ORDER BY p.id');
    body = csv(['نام', 'کد', 'نوع', 'وضعیت', 'قیمت', 'قیمت تخفیفی', 'موجودی', 'برند', 'دسته'], rows.map((r) => [r.name, r.sku ?? '', r.type === 'variable' ? 'متغیر' : 'ساده', r.status === 'published' ? 'منتشرشده' : 'پیش‌نویس', r.price, r.sale_price ?? '', r.stock, r.brand ?? '', r.cat ?? '']));
  } else if (kind === 'customers') {
    const rows = all<{ name: string; login: string; created_at: string; orders: number; spent: number }>(
      "SELECT u.name, u.login, u.created_at, (SELECT COUNT(*) FROM orders o WHERE o.user_id=u.id) orders, (SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.user_id=u.id AND o.status NOT IN ('cancelled','returned')) spent FROM users u WHERE u.role='customer' ORDER BY u.id DESC");
    body = csv(['نام', 'موبایل', 'تاریخ عضویت', 'تعداد سفارش', 'مجموع خرید'], rows.map((r) => [r.name, r.login, parseDbDate(r.created_at).toLocaleDateString('fa-IR-u-ca-persian'), r.orders, r.spent]));
  } else return new NextResponse('Not found', { status: 404 });
  return new NextResponse(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${kind}-${tehranDate()}.csv"`, 'Cache-Control': 'no-store' } });
}
