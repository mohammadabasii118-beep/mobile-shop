import { all, get, run, tx } from './db';
import { getSettings } from './catalog';
import { effectivePrice } from './variations';
import { DRIVERS } from './payment-drivers';
import { getMethod, inRange, isUsable } from './payment-methods';
import type { CartInput, CartLine } from './types';

/** قیمت‌گذاری سبد از روی دیتابیس (هرگز به قیمت کلاینت اعتماد نمی‌کنیم) */
export function priceCart(input: CartInput[]): CartLine[] {
  const lines: CartLine[] = [];
  for (const it of input.slice(0, 50)) {
    const qty = Math.max(1, Math.min(99, Math.floor(Number(it.qty) || 1)));
    const p = get<{ id: number; slug: string; name: string; type: string; price: number; sale_price: number | null; stock: number; images: string; status: string }>(
      'SELECT id, slug, name, type, price, sale_price, stock, images, status FROM products WHERE id = ?', it.productId);
    const key = `${it.productId}:${it.variationId ?? 0}`;
    if (!p || p.status !== 'published') {
      lines.push({ key, productId: it.productId, variationId: it.variationId, qty, name: 'محصول حذف‌شده', slug: '', label: '', image: null, color: null, price: 0, old: null, stock: 0, ok: false, issue: 'این محصول دیگر موجود نیست' });
      continue;
    }
    const imgs: string[] = JSON.parse(p.images || '[]');
    if (p.type === 'variable') {
      const v = it.variationId
        ? get<{ id: number; price: number; sale_price: number | null; stock: number; image: string | null; attrs: string; status: string }>(
            'SELECT * FROM variations WHERE id = ? AND product_id = ?', it.variationId, p.id)
        : undefined;
      if (!v || v.status !== 'active') {
        lines.push({ key, productId: p.id, variationId: it.variationId, qty, name: p.name, slug: p.slug, label: '', image: imgs[0] ?? null, color: null, price: 0, old: null, stock: 0, ok: false, issue: 'این گزینه دیگر عرضه نمی‌شود' });
        continue;
      }
      const price = effectivePrice(v.price, v.sale_price);
      const label = variationLabel(p.id, JSON.parse(v.attrs));
      lines.push({
        key, productId: p.id, variationId: v.id, qty: Math.min(qty, Math.max(v.stock, 1)), name: p.name, slug: p.slug, label,
        image: v.image || imgs[0] || null, color: attrColor(JSON.parse(v.attrs)), price, old: price < v.price ? v.price : null, stock: v.stock,
        ok: v.stock > 0, issue: v.stock > 0 ? undefined : 'ناموجود',
      });
    } else {
      const price = effectivePrice(p.price, p.sale_price);
      lines.push({
        key, productId: p.id, variationId: null, qty: Math.min(qty, Math.max(p.stock, 1)), name: p.name, slug: p.slug, label: '',
        image: imgs[0] ?? null, color: null, price, old: price < p.price ? p.price : null, stock: p.stock,
        ok: p.stock > 0, issue: p.stock > 0 ? undefined : 'ناموجود',
      });
    }
  }
  return lines;
}

/** «Apple · iPhone 15 Pro · مشکی» */
export function variationLabel(productId: number, attrs: Record<string, string>): string {
  const rows = all<{ slug: string; term_ids: string }>(
    `SELECT a.slug, pa.term_ids FROM product_attributes pa JOIN attributes a ON a.id = pa.attribute_id WHERE pa.product_id = ? ORDER BY pa.sort, a.id`, productId);
  const parts: string[] = [];
  for (const r of rows) {
    const slug = attrs[r.slug];
    if (!slug) continue;
    const t = get<{ name: string }>(
      `SELECT t.name FROM attribute_terms t JOIN attributes a ON a.id = t.attribute_id WHERE a.slug = ? AND t.slug = ?`, r.slug, slug);
    if (t) parts.push(t.name);
  }
  return parts.join(' · ');
}

function attrColor(attrs: Record<string, string>): string | null {
  const slug = attrs['color'];
  if (!slug) return null;
  return get<{ value: string | null }>(
    `SELECT t.value FROM attribute_terms t JOIN attributes a ON a.id = t.attribute_id WHERE a.slug = 'color' AND t.slug = ?`, slug)?.value ?? null;
}

export type ShippingInfo = { subtotal: number; shipping: number; freeMin: number };
export function shippingFor(subtotal: number): ShippingInfo {
  const s = getSettings();
  const freeMin = Number(s.free_shipping_min) || 0;
  const cost = Number(s.shipping_cost) || 0;
  return { subtotal, shipping: subtotal === 0 || (freeMin > 0 && subtotal >= freeMin) ? 0 : cost, freeMin };
}

export type Coupon = {
  id: number; code: string; type: 'percent' | 'fixed'; value: number; max_discount: number | null; min_total: number;
  max_uses: number | null; used: number; starts_at: string | null; ends_at: string | null; active: number;
};

export function checkCoupon(codeRaw: string, subtotal: number): { ok: true; coupon: Coupon; discount: number } | { ok: false; error: string } {
  const code = codeRaw.trim().toUpperCase();
  if (!code) return { ok: false, error: 'کد تخفیف را وارد کنید' };
  const c = get<Coupon>('SELECT * FROM coupons WHERE UPPER(code) = ?', code);
  if (!c || !c.active) return { ok: false, error: 'کد تخفیف معتبر نیست' };
  const today = new Date().toISOString().slice(0, 10);
  if (c.starts_at && c.starts_at.slice(0, 10) > today) return { ok: false, error: 'این کد هنوز فعال نشده است' };
  if (c.ends_at && c.ends_at.slice(0, 10) < today) return { ok: false, error: 'مهلت استفاده از این کد تمام شده است' };
  if (c.max_uses !== null && c.used >= c.max_uses) return { ok: false, error: 'سقف استفاده از این کد پر شده است' };
  if (subtotal < c.min_total) return { ok: false, error: `حداقل مبلغ سفارش برای این کد ${c.min_total.toLocaleString('fa-IR')} تومان است` };
  let d = c.type === 'percent' ? Math.floor((subtotal * c.value) / 100) : c.value;
  if (c.type === 'percent' && c.max_discount) d = Math.min(d, c.max_discount);
  return { ok: true, coupon: c, discount: Math.min(d, subtotal) };
}

export type OrderForm = {
  name: string; phone: string; email: string; province: string; city: string; address: string; postal: string; note: string;
  method: string; coupon: string; userId: number | null;
};

export function placeOrder(input: CartInput[], f: OrderForm): { ok: true; number: string; method: string; driver: string } | { ok: false; error: string } {
  const lines = priceCart(input);
  if (!lines.length) return { ok: false, error: 'سبد خرید خالی است' };
  const bad = lines.find((l) => !l.ok || l.qty > l.stock);
  if (bad) return { ok: false, error: `«${bad.name}${bad.label ? ' (' + bad.label + ')' : ''}»: ${bad.issue || 'موجودی کافی نیست'}` };
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  let discount = 0;
  let couponCode: string | null = null;
  if (f.coupon.trim()) {
    const r = checkCoupon(f.coupon, subtotal);
    if (!r.ok) return { ok: false, error: r.error };
    discount = r.discount;
    couponCode = r.coupon.code;
  }
  const ship = shippingFor(subtotal - discount).shipping;
  const total = subtotal - discount + ship;

  const pm = getMethod(f.method);
  if (!pm || !isUsable(pm)) return { ok: false, error: 'روش پرداخت انتخاب‌شده در دسترس نیست' };
  if (!inRange(pm, total)) return { ok: false, error: `روش «${pm.title}» برای این مبلغ در دسترس نیست` };
  const kind = DRIVERS[pm.driver].kind === 'cod' ? 'cod' : 'online';

  return tx(() => {
    // بازبینی موجودی داخل تراکنش
    for (const l of lines) {
      const cur = l.variationId
        ? get<{ stock: number }>('SELECT stock FROM variations WHERE id = ?', l.variationId)
        : get<{ stock: number }>('SELECT stock FROM products WHERE id = ?', l.productId);
      if (!cur || cur.stock < l.qty) throw new Error(`موجودی «${l.name}» کافی نیست`);
    }
    const info = run(
      `INSERT INTO orders (user_id, customer_name, phone, email, province, city, address, postal_code, note, payment_method, pay_code, subtotal, discount, shipping, total, coupon_code)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      f.userId, f.name, f.phone, f.email || null, f.province, f.city, f.address, f.postal, f.note, kind, pm.code, subtotal, discount, ship, total, couponCode);
    const id = Number(info.lastInsertRowid);
    const number = String(100000 + id);
    run('UPDATE orders SET number = ? WHERE id = ?', number, id);
    for (const l of lines) {
      run(
        `INSERT INTO order_items (order_id, product_id, variation_id, name, variation_label, sku, price, qty, image) VALUES (?,?,?,?,?,?,?,?,?)`,
        id, l.productId, l.variationId, l.name, l.label,
        l.variationId ? get<{ sku: string | null }>('SELECT sku FROM variations WHERE id = ?', l.variationId)?.sku ?? null : get<{ sku: string | null }>('SELECT sku FROM products WHERE id = ?', l.productId)?.sku ?? null,
        l.price, l.qty, l.image);
      adjustStock(l.productId, l.variationId, -l.qty, `سفارش ${number}`);
    }
    if (couponCode) run('UPDATE coupons SET used = used + 1 WHERE UPPER(code) = ?', couponCode.toUpperCase());
    run('INSERT INTO payments (order_id, method, amount, status) VALUES (?,?,?,?)', id, pm.code, total, 'pending');
    return { ok: true as const, number, method: pm.code, driver: pm.driver };
  });
}

/** تغییر موجودی با ثبت در تاریخچه */
export function adjustStock(productId: number, variationId: number | null, delta: number, reason: string) {
  if (variationId) {
    run('UPDATE variations SET stock = MAX(0, stock + ?) WHERE id = ?', delta, variationId);
  } else {
    run('UPDATE products SET stock = MAX(0, stock + ?) WHERE id = ?', delta, productId);
  }
  const after = variationId
    ? get<{ stock: number }>('SELECT stock FROM variations WHERE id = ?', variationId)?.stock ?? 0
    : get<{ stock: number }>('SELECT stock FROM products WHERE id = ?', productId)?.stock ?? 0;
  run('INSERT INTO inventory_log (product_id, variation_id, delta, stock_after, reason) VALUES (?,?,?,?,?)', productId, variationId, delta, after, reason);
}

/** برگرداندن موجودی هنگام لغو/مرجوعی سفارش */
export function restockOrder(orderId: number, reason: string) {
  const items = all<{ product_id: number | null; variation_id: number | null; qty: number }>('SELECT product_id, variation_id, qty FROM order_items WHERE order_id = ?', orderId);
  for (const i of items) if (i.product_id) adjustStock(i.product_id, i.variation_id, i.qty, reason);
}
