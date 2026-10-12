/**
 * ثبت یک پست کانال در فروشگاه: ردیف فید + (اگر قیمت دارد) محصول متغیر با برند/مدل/رنگ.
 * بدون Server Action و بدون session ادمین؛ فقط از ربات یا مسیر امن /api/channel/ingest صدا زده می‌شود.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { all, DATA_DIR, get, run, tx } from '../db';
import { slugify } from '../format';
import { optimizeImage } from '../images';
import { ATTR, generateCombos, type GenAttr } from '../variations';
import { BRAND_NAME, parsePost, type CategoryHint, type ParsedPost } from './parse';

export type IncomingPost = {
  /** کلید یکتا؛ مثل «chat:messageId». ارسال دوباره‌ی همان پست چیزی را تکرار نمی‌کند. */
  key: string;
  groupId?: string | null;
  text: string;
  date: Date;
  image?: Buffer | null;
  edited?: boolean;
};
export type IngestResult = { status: 'created' | 'updated' | 'attached' | 'skipped'; postId?: number; productId?: number | null; note?: string };

const IMG_OK = (b: Buffer) =>
  b.length > 12 &&
  ((b[0] === 0xff && b[1] === 0xd8) || b.subarray(1, 4).toString() === 'PNG' || (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP'));

/** تصویر پست را مثل آپلود مدیر بهینه می‌کند (AVIF + WebP) و مسیر /uploads/... را برمی‌گرداند. */
async function storeImage(buf: Buffer | null | undefined): Promise<string | null> {
  if (!buf || !IMG_OK(buf)) return null;
  const d = new Date();
  const sub = path.join(String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'));
  const dir = path.join(DATA_DIR, 'uploads', sub);
  fs.mkdirSync(dir, { recursive: true });
  try {
    const name = await optimizeImage(buf, dir, crypto.randomBytes(8).toString('hex'));
    return `/uploads/${sub.replace(/\\/g, '/')}/${name}`;
  } catch {
    return null;
  }
}

function uniqueSlug(base: string): string {
  const root = slugify(base).slice(0, 80) || 'item';
  let slug = root, n = 1;
  while (get('SELECT 1 FROM products WHERE slug = ?', slug)) slug = `${root}-${++n}`;
  return slug;
}

function attrId(slug: string, name: string, type: 'select' | 'color', parentSlug: string | null, sort: number): number {
  const ex = get<{ id: number }>('SELECT id FROM attributes WHERE slug = ?', slug);
  if (ex) return ex.id;
  const parent = parentSlug ? get<{ id: number }>('SELECT id FROM attributes WHERE slug = ?', parentSlug)?.id ?? null : null;
  return Number(run('INSERT INTO attributes (slug, name, type, parent_attribute_id, sort) VALUES (?,?,?,?,?)', slug, name, type, parent, sort).lastInsertRowid);
}

/** مقدار ویژگی را پیدا می‌کند یا می‌سازد (متغیر جدید = ویژگی/مقدار جدید، بدون دست‌زدن به مقدارهای موجود) */
function termId(attributeId: number, slug: string, name: string, value: string | null, parentTermId: number | null): number {
  const ex =
    get<{ id: number }>('SELECT id FROM attribute_terms WHERE attribute_id = ? AND slug = ?', attributeId, slug) ??
    get<{ id: number }>('SELECT id FROM attribute_terms WHERE attribute_id = ? AND lower(name) = lower(?)', attributeId, name);
  if (ex) return ex.id;
  return Number(
    run('INSERT INTO attribute_terms (attribute_id, slug, name, value, parent_term_id, sort) VALUES (?,?,?,?,?, (SELECT COALESCE(MAX(sort),0)+1 FROM attribute_terms WHERE attribute_id = ?))',
      attributeId, slug, name, value, parentTermId, attributeId).lastInsertRowid,
  );
}

const CAT_SLUGS: Record<CategoryHint, string[]> = {
  case: ['case', 'قاب'], glass: ['glass', 'گلس'], cable: ['cable', 'کابل'], charger: ['charger', 'شارژر'],
  powerbank: ['powerbank', 'پاوربانک'], audio: ['audio', 'هندزفری'], holder: ['holder', 'هولدر'], storage: ['storage', 'فلش'],
};
/** فقط دسته‌ی موجود را پیدا می‌کند؛ دسته‌ی جدید خودکار ساخته نمی‌شود. */
function findCategory(h: CategoryHint | null): number | null {
  if (!h) return null;
  const [slug, word] = CAT_SLUGS[h];
  return get<{ id: number }>('SELECT id FROM categories WHERE slug = ? OR name LIKE ? ORDER BY slug = ? DESC LIMIT 1', slug, `%${word}%`, slug)?.id ?? null;
}
/** برند سازنده‌ی محصول (Anker، Baseus، …) فقط اگر نامش دقیقاً در متن باشد؛ برندهای گوشی اینجا حساب نمی‌شوند. */
function findBrand(text: string): number | null {
  const t = text.toLowerCase();
  for (const b of all<{ id: number; name: string }>('SELECT id, name FROM brands WHERE active = 1')) {
    if (['apple', 'samsung', 'xiaomi'].includes(b.name.toLowerCase())) continue;
    if (new RegExp(`(?<![\\p{L}\\d])${b.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\d])`, 'u').test(t)) return b.id;
  }
  return null;
}

type Made = { productId: number; note: string };

/** محصول را (مستقیم منتشرشده) می‌سازد. باید داخل tx صدا زده شود. */
function createProduct(p: ParsedPost, text: string, messageKey: string, image: string | null): Made {
  const price = p.price!;
  const cat = findCategory(p.category), brand = findBrand(text);
  const attrs: GenAttr[] = [];
  const pa: { attribute_id: number; term_ids: number[] }[] = [];

  if (p.models.length || p.brands.length) {
    const brandAttr = attrId(ATTR.brand, 'برند گوشی', 'select', null, 1);
    const brandTerms = new Map<string, number>();
    const brandList = [...new Set([...p.brands, ...p.models.map((m) => m.brand)])];
    for (const b of brandList) brandTerms.set(b, termId(brandAttr, b, BRAND_NAME[b], null, null));
    const brandIds = [...brandTerms.values()];
    attrs.push({ id: brandAttr, slug: ATTR.brand, parent_attribute_id: null, terms: [...brandTerms.entries()].map(([slug, id]) => ({ id, slug, parent_term_id: null })) });
    pa.push({ attribute_id: brandAttr, term_ids: brandIds });
    if (p.models.length) {
      const modelAttr = attrId(ATTR.model, 'مدل گوشی', 'select', ATTR.brand, 2);
      const terms = p.models.map((m) => {
        const slug = slugify(m.name);
        return { id: termId(modelAttr, slug, m.name, null, brandTerms.get(m.brand)!), slug, parent_term_id: brandTerms.get(m.brand)! };
      });
      attrs.push({ id: modelAttr, slug: ATTR.model, parent_attribute_id: brandAttr, terms });
      pa.push({ attribute_id: modelAttr, term_ids: terms.map((t) => t.id) });
    }
  }
  if (p.colors.length) {
    const colorAttr = attrId(ATTR.color, 'رنگ', 'color', null, 3);
    const terms = p.colors.map((c) => ({ id: termId(colorAttr, c.slug, c.name, c.hex, null), slug: c.slug, parent_term_id: null as number | null }));
    // اگر مقدار موجود فروشگاه slug متفاوتی دارد (مثلاً ثبت دستی)، slug واقعی را برای متغیر برمی‌داریم
    for (const t of terms) t.slug = get<{ slug: string }>('SELECT slug FROM attribute_terms WHERE id = ?', t.id)!.slug;
    attrs.push({ id: colorAttr, slug: ATTR.color, parent_attribute_id: null, terms });
    pa.push({ attribute_id: colorAttr, term_ids: terms.map((t) => t.id) });
  }
  // مدل‌ها هم باید slug واقعی را بگیرند
  const modelAttrRef = attrs.find((a) => a.slug === ATTR.model);
  if (modelAttrRef) for (const t of modelAttrRef.terms) t.slug = get<{ slug: string }>('SELECT slug FROM attribute_terms WHERE id = ?', t.id)!.slug;
  const brandAttrRef = attrs.find((a) => a.slug === ATTR.brand);
  if (brandAttrRef) for (const t of brandAttrRef.terms) t.slug = get<{ slug: string }>('SELECT slug FROM attribute_terms WHERE id = ?', t.id)!.slug;

  const combos = attrs.length ? generateCombos(attrs) : [];
  const variable = combos.length > 0;
  const stock = Math.max(0, p.stock ?? 0);
  const images = image ? [image] : [];
  const pid = Number(
    run(`INSERT INTO products (name, slug, brand_id, category_id, short_desc, description, type, sku, price, stock, images, specs, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'published')`,
      p.title, uniqueSlug(p.title), brand, cat, p.description.replace(/\s+/g, ' ').slice(0, 160), p.description, variable ? 'variable' : 'simple',
      `TG-${messageKey.replace(/[^\w-]/g, '')}`, price, variable ? 0 : stock, JSON.stringify(images), '[]').lastInsertRowid,
  );
  if (cat) run('INSERT OR IGNORE INTO product_categories (product_id, category_id) VALUES (?,?)', pid, cat);
  if (brand) run('INSERT OR IGNORE INTO product_brands (product_id, brand_id) VALUES (?,?)', pid, brand);
  pa.forEach((a, i) => run('INSERT INTO product_attributes (product_id, attribute_id, term_ids, for_variations, sort) VALUES (?,?,?,1,?)', pid, a.attribute_id, JSON.stringify(a.term_ids), i));
  if (variable) {
    combos.forEach((attrsObj, i) => {
      const id = Number(run('INSERT INTO variations (product_id, sku, price, stock, attrs, status) VALUES (?,?,?,?,?, \'active\')', pid, `TG-${messageKey.replace(/[^\w-]/g, '')}-${i + 1}`, price, stock, JSON.stringify(attrsObj)).lastInsertRowid);
      if (stock > 0) run('INSERT INTO inventory_log (product_id, variation_id, delta, stock_after, reason) VALUES (?,?,?,?,?)', pid, id, stock, stock, 'ثبت خودکار از کانال');
    });
  } else if (stock > 0) {
    run('INSERT INTO inventory_log (product_id, variation_id, delta, stock_after, reason) VALUES (?,?,?,?,?)', pid, null, stock, stock, 'ثبت خودکار از کانال');
  }

  const fa = (n: number) => n.toLocaleString('fa-IR');
  const parts = [variable ? `محصول متغیر با ${fa(combos.length)} متغیر` : 'محصول ساده', `قیمت ${fa(price)} تومان`];
  if (p.models.length) parts.push(`مدل‌ها: ${p.models.map((m) => m.name).join('، ')}`);
  else if (p.brands.length) parts.push(`برند گوشی: ${p.brands.map((b) => BRAND_NAME[b]).join('، ')}`);
  if (p.colors.length) parts.push(`رنگ‌ها: ${p.colors.map((c) => c.name).join('، ')}`);
  parts.push(p.stock === null ? 'موجودی در پست نبود (۰ ثبت شد؛ در پنل وارد کنید)' : variable ? `موجودی هر متغیر: ${fa(stock)}` : `موجودی: ${fa(stock)}`);
  if (!cat) parts.push('دسته تشخیص داده نشد');
  return { productId: pid, note: parts.join(' · ') };
}

export async function ingestPost(inc: IncomingPost): Promise<IngestResult> {
  const text = inc.text.replace(/\r/g, '').trim();
  const existing = get<{ id: number; product_id: number | null; text: string }>('SELECT id, product_id, text FROM channel_posts WHERE source_key = ?', inc.key);

  if (existing) {
    // ویرایش پست در کانال: فقط متن فید به‌روز می‌شود؛ محصول ساخته‌شده را (که شاید مدیر ویرایش کرده) دست نمی‌زنیم
    if (inc.edited && text && text !== existing.text) {
      run('UPDATE channel_posts SET text = ? WHERE id = ?', text, existing.id);
      return { status: 'updated', postId: existing.id, productId: existing.product_id };
    }
    return { status: 'skipped', postId: existing.id, productId: existing.product_id };
  }

  const image = await storeImage(inc.image);

  // عکس بدون متن از یک آلبوم: به پست اصلی همان آلبوم اضافه می‌شود
  if (!text) {
    if (!inc.groupId || !image) return { status: 'skipped' };
    const row = get<{ id: number; product_id: number | null; image: string | null }>('SELECT id, product_id, image FROM channel_posts WHERE group_id = ? ORDER BY id LIMIT 1', inc.groupId);
    if (!row) return { status: 'skipped' };
    if (!row.image) run('UPDATE channel_posts SET image = ? WHERE id = ?', image, row.id);
    if (row.product_id) {
      const cur = JSON.parse(get<{ images: string }>('SELECT images FROM products WHERE id = ?', row.product_id)?.images ?? '[]') as string[];
      if (cur.length < 12) run('UPDATE products SET images = ? WHERE id = ?', JSON.stringify([...cur, image]), row.product_id);
    }
    return { status: 'attached', postId: row.id, productId: row.product_id };
  }

  const parsed = parsePost(text);
  return tx(() => {
    let made: Made | null = null;
    if (parsed.price) made = createProduct(parsed, text, inc.key.replace(/[^\w]/g, '-'), image);
    const note = made ? made.note : 'فقط در فید کانال نمایش داده می‌شود (قیمتی در پست پیدا نشد؛ برای ساخت محصول «قیمت: …» بنویسید)';
    const info = run('INSERT INTO channel_posts (source_key, group_id, text, image, product_id, note, posted_at) VALUES (?,?,?,?,?,?,?)',
      inc.key, inc.groupId ?? null, text, image, made?.productId ?? null, note, inc.date.toISOString());
    return { status: 'created' as const, postId: Number(info.lastInsertRowid), productId: made?.productId ?? null, note };
  });
}
