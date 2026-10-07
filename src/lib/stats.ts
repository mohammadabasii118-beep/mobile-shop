import { all, get } from './db';

/** تهران UTC+3:30 (بدون ساعت تابستانی) */
const TZ = '+210 minutes';

export function tehranDate(offsetDays = 0): string {
  const d = new Date(Date.now() + 210 * 60_000 + offsetDays * 864e5);
  return d.toISOString().slice(0, 10);
}
export const NOT_LOST = `status NOT IN ('cancelled','returned')`;

export type DayRow = { day: string; revenue: number; orders: number };

export function salesByDay(days: number): DayRow[] {
  const from = tehranDate(-(days - 1));
  const rows = all<DayRow>(
    `SELECT date(created_at, '${TZ}') AS day, COALESCE(SUM(total),0) AS revenue, COUNT(*) AS orders
     FROM orders WHERE ${NOT_LOST} AND date(created_at, '${TZ}') >= ? GROUP BY day`, from);
  return Array.from({ length: days }, (_, i) => {
    const day = tehranDate(-(days - 1 - i));
    return rows.find((r) => r.day === day) ?? { day, revenue: 0, orders: 0 };
  });
}

export function periodTotals(fromOffset: number, toOffset: number) {
  const from = tehranDate(fromOffset), to = tehranDate(toOffset);
  const o = get<{ revenue: number; orders: number }>(
    `SELECT COALESCE(SUM(total),0) revenue, COUNT(*) orders FROM orders WHERE ${NOT_LOST} AND date(created_at, '${TZ}') BETWEEN ? AND ?`, from, to)!;
  const c = get<{ n: number }>(`SELECT COUNT(*) n FROM users WHERE role = 'customer' AND date(created_at, '${TZ}') BETWEEN ? AND ?`, from, to)!.n;
  const items = get<{ n: number }>(
    `SELECT COALESCE(SUM(i.qty),0) n FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.${NOT_LOST} AND date(o.created_at, '${TZ}') BETWEEN ? AND ?`, from, to)!.n;
  return { revenue: o.revenue, orders: o.orders, customers: c, items, avg: o.orders ? Math.round(o.revenue / o.orders) : 0 };
}

export function pctChange(cur: number, prev: number): number | null {
  if (!prev) return cur ? 100 : null;
  return ((cur - prev) / prev) * 100;
}

export function topProducts(days: number, limit = 5) {
  const from = tehranDate(-(days - 1));
  return all<{ product_id: number; name: string; qty: number; revenue: number }>(
    `SELECT i.product_id, i.name, SUM(i.qty) qty, SUM(i.qty * i.price) revenue
     FROM order_items i JOIN orders o ON o.id = i.order_id
     WHERE o.${NOT_LOST} AND date(o.created_at, '${TZ}') >= ? GROUP BY i.product_id, i.name ORDER BY qty DESC, revenue DESC LIMIT ?`, from, limit);
}

export function salesByCategory(days: number) {
  const from = tehranDate(-(days - 1));
  return all<{ name: string; qty: number; revenue: number }>(
    `SELECT COALESCE(c.name, 'بدون دسته') name, SUM(i.qty) qty, SUM(i.qty * i.price) revenue
     FROM order_items i JOIN orders o ON o.id = i.order_id LEFT JOIN products p ON p.id = i.product_id LEFT JOIN categories c ON c.id = p.category_id
     WHERE o.${NOT_LOST} AND date(o.created_at, '${TZ}') >= ? GROUP BY c.id ORDER BY revenue DESC`, from);
}

export function salesByBrand(days: number) {
  const from = tehranDate(-(days - 1));
  return all<{ name: string; qty: number; revenue: number }>(
    `SELECT COALESCE(b.name, 'بدون برند') name, SUM(i.qty) qty, SUM(i.qty * i.price) revenue
     FROM order_items i JOIN orders o ON o.id = i.order_id LEFT JOIN products p ON p.id = i.product_id LEFT JOIN brands b ON b.id = p.brand_id
     WHERE o.${NOT_LOST} AND date(o.created_at, '${TZ}') >= ? GROUP BY b.id ORDER BY revenue DESC`, from);
}

export function ordersByStatus(days: number) {
  const from = tehranDate(-(days - 1));
  return all<{ status: string; n: number }>(`SELECT status, COUNT(*) n FROM orders WHERE date(created_at, '${TZ}') >= ? GROUP BY status`, from);
}

export function byPaymentMethod(days: number) {
  const from = tehranDate(-(days - 1));
  return all<{ payment_method: string; n: number; revenue: number }>(
    `SELECT COALESCE(pay_code, payment_method) payment_method, COUNT(*) n, COALESCE(SUM(total),0) revenue FROM orders WHERE ${NOT_LOST} AND date(created_at, '${TZ}') >= ? GROUP BY COALESCE(pay_code, payment_method)`, from);
}

export function lowStockUnits(threshold: number, limit = 8) {
  return all<{ product_id: number; name: string; label: string; stock: number; variation_id: number | null }>(
    `SELECT p.id product_id, p.name, '' label, p.stock, NULL variation_id FROM products p WHERE p.type = 'simple' AND p.status = 'published' AND p.stock <= ?
     UNION ALL
     SELECT p.id, p.name, COALESCE((SELECT GROUP_CONCAT(t.name, ' · ') FROM json_each(v.attrs) j JOIN attributes a ON a.slug = j.key JOIN attribute_terms t ON t.attribute_id = a.id AND t.slug = j.value), '') label, v.stock, v.id
     FROM variations v JOIN products p ON p.id = v.product_id WHERE v.status = 'active' AND p.status = 'published' AND v.stock <= ?
     ORDER BY stock ASC, name LIMIT ?`, threshold, threshold, limit);
}
