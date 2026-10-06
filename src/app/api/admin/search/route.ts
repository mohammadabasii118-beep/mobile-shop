import { NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/auth';
import { all } from '@/lib/db';
import { fa, normText, toman } from '@/lib/format';

export async function GET(req: Request) {
  try { await assertAdmin(); } catch { return NextResponse.json([], { status: 401 }); }
  const q = normText(new URL(req.url).searchParams.get('q') || '').slice(0, 60);
  if (q.length < 2) return NextResponse.json([]);
  const like = `%${q.replace(/[%_]/g, ' ')}%`;
  const products = all<{ id: number; name: string; sku: string | null }>('SELECT id, name, sku FROM products WHERE name LIKE ? OR sku LIKE ? ORDER BY id DESC LIMIT 5', like, like);
  const orders = all<{ id: number; number: string; customer_name: string; total: number }>('SELECT id, number, customer_name, total FROM orders WHERE number LIKE ? OR customer_name LIKE ? OR phone LIKE ? ORDER BY id DESC LIMIT 5', like, like, like);
  const users = all<{ id: number; name: string; login: string }>('SELECT id, name, login FROM users WHERE name LIKE ? OR login LIKE ? LIMIT 4', like, like);
  return NextResponse.json([
    ...orders.map((o) => ({ type: 'order', title: `سفارش ${fa(o.number)} · ${o.customer_name}`, sub: `${toman(o.total)} تومان`, href: `/admin/orders/${o.id}` })),
    ...products.map((p) => ({ type: 'product', title: p.name, sub: p.sku ?? 'محصول', href: `/admin/products/${p.id}` })),
    ...users.map((u) => ({ type: 'user', title: u.name || u.login, sub: u.login, href: `/admin/users?q=${encodeURIComponent(u.login)}` })),
  ]);
}
