import { all, get, qs } from './db';
import { ATTR, effectivePrice } from './variations';
import type { Attribute, Badge, Banner, CardData, ProductAttr, ProductFull, Spec, Term, Variation } from './types';

/* ───────── تنظیمات فروشگاه ───────── */

export const SETTING_DEFAULTS: Record<string, string> = {
  store_name: 'Caseline',
  store_name_en: '',
  tagline: 'لوازم جانبی اصل موبایل',
  phone: '۰۲۱-۱۲۳۴۵۶۷۸',
  email: 'support@caseline.example',
  address: 'تهران، خیابان ولیعصر، پلاک ۱۰',
  instagram: '',
  telegram: '',
  footer_about: 'فروشگاه تخصصی لوازم جانبی موبایل با تمرکز بر اصالت، سرعت و انتخاب دقیق.',
  announcements: 'گارانتی اصالت و سلامت فیزیکی کالا\nارسال رایگان بالای ۱٬۵۰۰٬۰۰۰ تومان\nمرجوعی ۷ روزه',
  free_shipping_min: '1500000',
  shipping_cost: '90000',
  low_stock: '5',
  pay_cod: '1',
  pay_online: '1',
  checkout_note: 'پس از ثبت سفارش، کارشناسان ما برای تأیید با شما تماس می‌گیرند.',
};

export type Settings = typeof SETTING_DEFAULTS;

export function getSettings(): Settings {
  const rows = all<{ key: string; value: string }>('SELECT key, value FROM settings');
  const out = { ...SETTING_DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

/* ───────── دسته‌ها و برندها ───────── */

export type Category = { id: number; slug: string; name: string; parent_id: number | null; art: string | null; image: string | null; sort: number; active: number };
export type Brand = { id: number; slug: string; name: string; logo: string | null; sort: number; active: number };

export function getCategories(onlyActive = true): Category[] {
  return all<Category>(`SELECT * FROM categories ${onlyActive ? 'WHERE active = 1' : ''} ORDER BY sort, id`);
}
export function getBrands(onlyActive = true): Brand[] {
  return all<Brand>(`SELECT * FROM brands ${onlyActive ? 'WHERE active = 1' : ''} ORDER BY sort, name`);
}
export function descendantIds(categoryId: number): number[] {
  const rows = all<{ id: number; parent_id: number | null }>('SELECT id, parent_id FROM categories');
  const out = [categoryId];
  for (let i = 0; i < out.length; i++) for (const r of rows) if (r.parent_id === out[i] && !out.includes(r.id)) out.push(r.id);
  return out;
}

/* ───────── بنرها ───────── */

export function getBanners(position: 'hero' | 'promo'): Banner[] {
  return all<Banner>(
    `SELECT * FROM banners
     WHERE position = ? AND active = 1
       AND (starts_at IS NULL OR starts_at = '' OR date(starts_at) <= date('now'))
       AND (ends_at IS NULL OR ends_at = '' OR date(ends_at) >= date('now'))
     ORDER BY sort, id`,
    position,
  );
}

/* ───────── ویژگی‌ها ───────── */

export function getAttributes(): (Attribute & { terms: Term[] })[] {
  const attrs = all<Attribute>('SELECT * FROM attributes ORDER BY sort, id');
  const terms = all<Term>('SELECT * FROM attribute_terms ORDER BY sort, id');
  return attrs.map((a) => ({ ...a, terms: terms.filter((t) => t.attribute_id === a.id) }));
}

/* ───────── محصولات (کارت) ───────── */

type Row = {
  id: number; slug: string; name: string; brand_name: string | null; images: string; type: 'simple' | 'variable';
  price: number; sale_price: number | null; eff_price: number | null; eff_stock: number; rating: number | null; rating_count: number;
  badge: Badge | null; created_at: string; featured: number; on_sale: number;
};

const BASE = `
WITH base AS (
  SELECT p.*, b.name AS brand_name, b.slug AS brand_slug, c.slug AS cat_slug, c.name AS cat_name,
    CASE WHEN p.type = 'variable'
      THEN (SELECT MIN(COALESCE(CASE WHEN v.sale_price > 0 AND v.sale_price < v.price THEN v.sale_price END, v.price)) FROM variations v WHERE v.product_id = p.id AND v.status = 'active')
      ELSE COALESCE(CASE WHEN p.sale_price > 0 AND p.sale_price < p.price THEN p.sale_price END, p.price) END AS eff_price,
    CASE WHEN p.type = 'variable'
      THEN (SELECT COALESCE(SUM(v.stock), 0) FROM variations v WHERE v.product_id = p.id AND v.status = 'active')
      ELSE p.stock END AS eff_stock,
    (SELECT AVG(r.rating) FROM reviews r WHERE r.product_id = p.id AND r.approved = 1) AS rating,
    (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.approved = 1) AS rating_count,
    CASE WHEN p.type = 'variable'
      THEN EXISTS (SELECT 1 FROM variations v WHERE v.product_id = p.id AND v.status = 'active' AND v.sale_price > 0 AND v.sale_price < v.price)
      ELSE (p.sale_price > 0 AND p.sale_price < p.price) END AS on_sale
  FROM products p
  LEFT JOIN brands b ON b.id = p.brand_id
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE p.status = 'published'
)`;

export type ListOpts = {
  q?: string;
  categoryId?: number;
  brandSlug?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  onSale?: boolean;
  featured?: boolean;
  model?: string; // slug مدل گوشی
  ids?: number[];
  excludeId?: number;
  sort?: 'new' | 'price_asc' | 'price_desc' | 'popular';
  page?: number;
  limit?: number;
};

export function listProducts(o: ListOpts = {}): { items: CardData[]; total: number } {
  const where: string[] = [];
  const args: unknown[] = [];
  if (o.q) {
    const like = `%${o.q.replace(/[%_]/g, ' ')}%`;
    where.push(`(name LIKE ? OR brand_name LIKE ? OR cat_name LIKE ? OR sku LIKE ? OR short_desc LIKE ?)`);
    args.push(like, like, like, like, like);
  }
  if (o.categoryId) {
    const ids = descendantIds(o.categoryId);
    where.push(`category_id IN (${qs(ids.length)})`);
    args.push(...ids);
  }
  if (o.brandSlug) { where.push('brand_slug = ?'); args.push(o.brandSlug); }
  if (o.minPrice) { where.push('eff_price >= ?'); args.push(o.minPrice); }
  if (o.maxPrice) { where.push('eff_price <= ?'); args.push(o.maxPrice); }
  if (o.inStock) where.push('eff_stock > 0');
  if (o.onSale) where.push('on_sale = 1');
  if (o.featured) where.push('featured = 1');
  if (o.excludeId) { where.push('id <> ?'); args.push(o.excludeId); }
  if (o.ids) {
    if (!o.ids.length) return { items: [], total: 0 };
    where.push(`id IN (${qs(o.ids.length)})`);
    args.push(...o.ids);
  }
  if (o.model) {
    // محصولاتی که برای این مدل متغیر دارند + محصولات عمومی (بدون ویژگی مدل گوشی)
    where.push(`(
      EXISTS (SELECT 1 FROM variations v WHERE v.product_id = base.id AND v.status = 'active' AND json_extract(v.attrs, '$."${ATTR.model}"') = ?)
      OR NOT EXISTS (SELECT 1 FROM product_attributes pa JOIN attributes a ON a.id = pa.attribute_id WHERE pa.product_id = base.id AND a.slug = '${ATTR.model}')
    )`);
    args.push(o.model);
  }
  const W = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const order =
    o.sort === 'price_asc' ? 'eff_price ASC, id DESC'
    : o.sort === 'price_desc' ? 'eff_price DESC, id DESC'
    : o.sort === 'popular' ? 'rating_count DESC, featured DESC, id DESC'
    : 'id DESC';
  // با فیلتر مدل گوشی، محصولات مخصوص همان مدل بالاتر از محصولات عمومی می‌آیند
  const orderArgs: unknown[] = [];
  let orderPrefix = '';
  if (o.model) {
    orderPrefix = `EXISTS (SELECT 1 FROM variations v WHERE v.product_id = base.id AND v.status = 'active' AND json_extract(v.attrs, '$."${ATTR.model}"') = ?) DESC, `;
    orderArgs.push(o.model);
  }
  const limit = o.limit ?? 12;
  const offset = ((o.page ?? 1) - 1) * limit;
  const total = get<{ n: number }>(`${BASE} SELECT COUNT(*) AS n FROM base ${W}`, ...args)?.n ?? 0;
  const rows = all<Row>(`${BASE} SELECT * FROM base ${W} ORDER BY ${orderPrefix}${order} LIMIT ? OFFSET ?`, ...args, ...orderArgs, limit, offset);
  return { items: toCards(rows), total };
}

function parseImages(s: string): string[] {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}

function toCards(rows: Row[]): CardData[] {
  if (!rows.length) return [];
  const varIds = rows.filter((r) => r.type === 'variable').map((r) => r.id);
  const vars = varIds.length
    ? all<{ product_id: number; price: number; sale_price: number | null; image: string | null; attrs: string }>(
        `SELECT product_id, price, sale_price, image, attrs FROM variations WHERE status = 'active' AND product_id IN (${qs(varIds.length)})`, ...varIds)
    : [];
  const colorRows = varIds.length
    ? all<{ product_id: number; term_ids: string }>(
        `SELECT pa.product_id, pa.term_ids FROM product_attributes pa JOIN attributes a ON a.id = pa.attribute_id
         WHERE a.type = 'color' AND pa.product_id IN (${qs(varIds.length)})`, ...varIds)
    : [];
  const termIds = new Set<number>();
  for (const c of colorRows) for (const id of JSON.parse(c.term_ids) as number[]) termIds.add(id);
  const terms = termIds.size ? all<{ id: number; value: string | null }>(`SELECT id, value FROM attribute_terms WHERE id IN (${qs(termIds.size)})`, ...[...termIds]) : [];
  const tv = new Map(terms.map((t) => [t.id, t.value]));

  return rows.map((r) => {
    const imgs = parseImages(r.images);
    let price = r.eff_price ?? r.price;
    let old: number | null = null;
    let image = imgs[0] ?? null;
    if (r.type === 'variable') {
      let best: (typeof vars)[number] | null = null;
      for (const v of vars) {
        if (v.product_id !== r.id) continue;
        if (!best || effectivePrice(v.price, v.sale_price) < effectivePrice(best.price, best.sale_price)) best = v;
      }
      if (best) {
        price = effectivePrice(best.price, best.sale_price);
        old = price < best.price ? best.price : null;
        if (!imgs[0] && best.image) image = best.image;
      }
    } else {
      price = effectivePrice(r.price, r.sale_price);
      old = price < r.price ? r.price : null;
    }
    const isNew = Date.now() - new Date(r.created_at.replace(' ', 'T') + 'Z').getTime() < 14 * 864e5;
    const colors = colorRows
      .filter((c) => c.product_id === r.id)
      .flatMap((c) => (JSON.parse(c.term_ids) as number[]).map((id) => tv.get(id)).filter((x): x is string => !!x));
    return {
      id: r.id, slug: r.slug, name: r.name, brand: r.brand_name, image, color: null,
      price, old, off: old ? Math.round((1 - price / old) * 100) : 0,
      stock: r.eff_stock, variable: r.type === 'variable',
      rating: r.rating ?? 0, ratingCount: r.rating_count,
      badge: r.badge ?? (isNew ? 'new' : null), colors,
    };
  });
}

/* ───────── محصول کامل ───────── */

type FullRow = {
  id: number; slug: string; name: string; brand_id: number | null; category_id: number | null; short_desc: string; description: string;
  type: 'simple' | 'variable'; sku: string | null; price: number; sale_price: number | null; stock: number; images: string; specs: string;
  badge: Badge | null; status: 'published' | 'draft'; featured: number;
};

export function getProductFull(by: { slug: string } | { id: number }, opts: { includeDraft?: boolean } = {}): ProductFull | null {
  const r = 'slug' in by
    ? get<FullRow>('SELECT * FROM products WHERE slug = ?', by.slug)
    : get<FullRow>('SELECT * FROM products WHERE id = ?', by.id);
  if (!r || (r.status !== 'published' && !opts.includeDraft)) return null;
  const brand = r.brand_id ? get<{ id: number; name: string; slug: string }>('SELECT id, name, slug FROM brands WHERE id = ?', r.brand_id) ?? null : null;
  const category = r.category_id ? get<{ id: number; name: string; slug: string }>('SELECT id, name, slug FROM categories WHERE id = ?', r.category_id) ?? null : null;

  const pas = all<{ attribute_id: number; term_ids: string; for_variations: number }>(
    'SELECT attribute_id, term_ids, for_variations FROM product_attributes WHERE product_id = ? ORDER BY sort, attribute_id', r.id);
  const attributes: ProductAttr[] = pas.flatMap((pa) => {
    const attribute = get<Attribute>('SELECT * FROM attributes WHERE id = ?', pa.attribute_id);
    if (!attribute) return [];
    const ids = JSON.parse(pa.term_ids) as number[];
    const terms = ids.length ? all<Term>(`SELECT * FROM attribute_terms WHERE id IN (${qs(ids.length)}) ORDER BY sort, id`, ...ids) : [];
    return [{ attribute, terms, for_variations: !!pa.for_variations }];
  });
  const variations = all<Omit<Variation, 'attrs'> & { attrs: string }>('SELECT * FROM variations WHERE product_id = ? ORDER BY id', r.id)
    .map((v) => ({ ...v, attrs: JSON.parse(v.attrs) as Record<string, string> }));
  const rv = get<{ a: number | null; n: number }>('SELECT AVG(rating) a, COUNT(*) n FROM reviews WHERE product_id = ? AND approved = 1', r.id);
  let specs: Spec[] = [];
  try { specs = JSON.parse(r.specs); } catch { /* noop */ }
  return {
    id: r.id, slug: r.slug, name: r.name, brand, category, short_desc: r.short_desc, description: r.description,
    type: r.type, sku: r.sku, price: r.price, sale_price: r.sale_price, stock: r.stock,
    images: parseImages(r.images), specs, badge: r.badge, status: r.status, featured: !!r.featured,
    attributes, variations, rating: rv?.a ?? 0, ratingCount: rv?.n ?? 0,
  };
}

/* ───────── نظرات ───────── */

export type Review = { id: number; product_id: number | null; author: string; rating: number; body: string; created_at: string };
export function getProductReviews(productId: number): Review[] {
  return all<Review>('SELECT * FROM reviews WHERE product_id = ? AND approved = 1 ORDER BY id DESC LIMIT 20', productId);
}
export function getHomeReviews(): Review[] {
  return all<Review>('SELECT * FROM reviews WHERE approved = 1 AND show_home = 1 ORDER BY id DESC LIMIT 6');
}
export function getStoreRating(): { avg: number; n: number } {
  const r = get<{ a: number | null; n: number }>('SELECT AVG(rating) a, COUNT(*) n FROM reviews WHERE approved = 1');
  return { avg: r?.a ?? 0, n: r?.n ?? 0 };
}
