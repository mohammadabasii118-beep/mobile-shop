'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { all, get, qs, run, tx } from '../db';
import { assertAdmin } from '../auth';
import { normText, slugify, toInt, toIntOrNull } from '../format';
import { adjustStock } from '../orders';
import { ATTR } from '../variations';
import type { AState } from '@/components/admin/client';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const flag = (fd: FormData, k: string) => (fd.get(k) ? 1 : 0);

function uniqueSlug(table: string, base: string, ignoreId?: number): string {
  let slug = slugify(base), n = 1;
  while (get(`SELECT 1 FROM ${table} WHERE slug = ? ${ignoreId ? 'AND id <> ?' : ''}`, ...(ignoreId ? [slug, ignoreId] : [slug]))) slug = `${slugify(base)}-${++n}`;
  return slug;
}

/* ═════════ محصول ═════════ */

export type ProductPayload = {
  id: number | null;
  name: string;
  slug: string;
  short_desc: string;
  description: string;
  type: 'simple' | 'variable';
  brand_id: number | null;
  category_id: number | null;
  status: 'published' | 'draft';
  featured: boolean;
  badge: 'new' | 'best' | 'promo' | null;
  sku: string;
  price: number | null;
  sale_price: number | null;
  stock: number | null;
  images: string[];
  specs: { k: string; v: string }[];
  attributes: { attribute_id: number; term_ids: number[]; for_variations: boolean }[];
  variations: { id: number | null; attrs: Record<string, string>; sku: string; price: number | null; sale_price: number | null; stock: number | null; image: string | null; status: 'active' | 'disabled' }[];
};

export async function saveProduct(p: ProductPayload): Promise<{ ok?: string; error?: string; id?: number }> {
  await assertAdmin();
  const name = normText(p.name);
  if (name.length < 2) return { error: 'نام محصول را وارد کنید' };
  if (p.type === 'simple' && !(toInt(p.price) > 0)) return { error: 'قیمت محصول را وارد کنید' };
  if (p.type === 'variable') {
    if (p.variations.length === 0) return { error: 'برای محصول متغیر حداقل یک متغیر لازم است. ویژگی‌ها را انتخاب کنید و «ساخت متغیرها» را بزنید.' };
    const bad = p.variations.find((v) => v.status === 'active' && !(toInt(v.price) > 0));
    if (bad) return { error: 'قیمت همه‌ی متغیرهای فعال باید وارد شود' };
  }
  const images = p.images.filter((i) => typeof i === 'string' && (i.startsWith('/uploads/') || /^art:p-[a-z]+(@#[0-9a-fA-F]{3,8})?$/.test(i))).slice(0, 12);
  const specs = p.specs.map((s) => ({ k: normText(s.k).slice(0, 80), v: normText(s.v).slice(0, 200) })).filter((s) => s.k && s.v).slice(0, 40);
  const badge = p.badge && ['new', 'best', 'promo'].includes(p.badge) ? p.badge : null;

  try {
    const id = tx(() => {
      const price = toInt(p.price);
      const sale = toIntOrNull(p.sale_price);
      const base = {
        short: normText(p.short_desc).slice(0, 300), desc: p.description.replace(/\r/g, '').trim().slice(0, 8000),
        brand: p.brand_id && get('SELECT 1 FROM brands WHERE id = ?', p.brand_id) ? p.brand_id : null,
        cat: p.category_id && get('SELECT 1 FROM categories WHERE id = ?', p.category_id) ? p.category_id : null,
      };
      let pid = p.id;
      const slug = uniqueSlug('products', p.slug || name, pid ?? undefined);
      const varPrices = p.variations.filter((v) => v.status === 'active').map((v) => toInt(v.price));
      const topPrice = p.type === 'variable' ? Math.min(...varPrices, Infinity) : price;
      if (pid) {
        if (!get('SELECT 1 FROM products WHERE id = ?', pid)) throw new Error('محصول پیدا نشد (ممکن است حذف شده باشد)');
        const old = get<{ stock: number; type: string }>('SELECT stock, type FROM products WHERE id = ?', pid)!;
        run(`UPDATE products SET name=?, slug=?, brand_id=?, category_id=?, short_desc=?, description=?, type=?, sku=?, price=?, sale_price=?, stock=?, images=?, specs=?, badge=?, status=?, featured=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
          name, slug, base.brand, base.cat, base.short, base.desc, p.type, normText(p.sku) || null, p.type === 'variable' ? (Number.isFinite(topPrice) ? topPrice : 0) : price,
          p.type === 'simple' && sale && sale > 0 && sale < price ? sale : null, p.type === 'simple' ? Math.max(0, toInt(p.stock)) : 0,
          JSON.stringify(images), JSON.stringify(specs), badge, p.status === 'draft' ? 'draft' : 'published', p.featured ? 1 : 0, pid);
        if (p.type === 'simple' && old.type === 'simple' && old.stock !== Math.max(0, toInt(p.stock))) {
          run('INSERT INTO inventory_log (product_id, variation_id, delta, stock_after, reason) VALUES (?,?,?,?,?)', pid, null, Math.max(0, toInt(p.stock)) - old.stock, Math.max(0, toInt(p.stock)), 'ویرایش محصول');
        }
      } else {
        const info = run(`INSERT INTO products (name, slug, brand_id, category_id, short_desc, description, type, sku, price, sale_price, stock, images, specs, badge, status, featured)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          name, slug, base.brand, base.cat, base.short, base.desc, p.type, normText(p.sku) || null, p.type === 'variable' ? (Number.isFinite(topPrice) ? topPrice : 0) : price,
          p.type === 'simple' && sale && sale > 0 && sale < price ? sale : null, p.type === 'simple' ? Math.max(0, toInt(p.stock)) : 0,
          JSON.stringify(images), JSON.stringify(specs), badge, p.status === 'draft' ? 'draft' : 'published', p.featured ? 1 : 0);
        pid = Number(info.lastInsertRowid);
        if (p.type === 'simple' && toInt(p.stock) > 0) run('INSERT INTO inventory_log (product_id, variation_id, delta, stock_after, reason) VALUES (?,?,?,?,?)', pid, null, toInt(p.stock), toInt(p.stock), 'ثبت محصول');
      }

      // ویژگی‌های محصول
      run('DELETE FROM product_attributes WHERE product_id = ?', pid);
      if (p.type === 'variable') {
        p.attributes.forEach((a, i) => {
          if (!get('SELECT 1 FROM attributes WHERE id = ?', a.attribute_id)) return;
          const ids = a.term_ids.filter((t) => get('SELECT 1 FROM attribute_terms WHERE id = ? AND attribute_id = ?', t, a.attribute_id));
          if (!ids.length) return;
          run('INSERT INTO product_attributes (product_id, attribute_id, term_ids, for_variations, sort) VALUES (?,?,?,?,?)', pid, a.attribute_id, JSON.stringify(ids), a.for_variations ? 1 : 0, i);
        });
      }

      // متغیرها: به‌روزرسانی، افزودن، حذف
      const keep: number[] = [];
      if (p.type === 'variable') {
        for (const v of p.variations) {
          const vprice = toInt(v.price);
          const vsale = toIntOrNull(v.sale_price);
          const vals = [normText(v.sku) || null, vprice, vsale && vsale > 0 && vsale < vprice ? vsale : null, Math.max(0, toInt(v.stock)), v.image && (v.image.startsWith('/uploads/') || v.image.startsWith('art:')) ? v.image : null, JSON.stringify(v.attrs), v.status === 'disabled' ? 'disabled' : 'active'];
          if (v.id && get('SELECT 1 FROM variations WHERE id = ? AND product_id = ?', v.id, pid)) {
            const oldS = get<{ stock: number }>('SELECT stock FROM variations WHERE id = ?', v.id)!.stock;
            run('UPDATE variations SET sku=?, price=?, sale_price=?, stock=?, image=?, attrs=?, status=? WHERE id=?', ...vals, v.id);
            if (oldS !== vals[3]) run('INSERT INTO inventory_log (product_id, variation_id, delta, stock_after, reason) VALUES (?,?,?,?,?)', pid, v.id, (vals[3] as number) - oldS, vals[3], 'ویرایش محصول');
            keep.push(v.id);
          } else {
            const info = run('INSERT INTO variations (product_id, sku, price, sale_price, stock, image, attrs, status) VALUES (?,?,?,?,?,?,?,?)', pid, ...vals);
            keep.push(Number(info.lastInsertRowid));
            if ((vals[3] as number) > 0) run('INSERT INTO inventory_log (product_id, variation_id, delta, stock_after, reason) VALUES (?,?,?,?,?)', pid, Number(info.lastInsertRowid), vals[3], vals[3], 'ثبت متغیر');
          }
        }
      }
      if (keep.length) run(`DELETE FROM variations WHERE product_id = ? AND id NOT IN (${qs(keep.length)})`, pid, ...keep);
      else run('DELETE FROM variations WHERE product_id = ?', pid);
      return pid!;
    });
    revalidatePath('/admin/products');
    return { ok: p.id ? 'تغییرات ذخیره شد' : 'محصول ساخته شد', id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'ذخیره انجام نشد' };
  }
}

export async function deleteProduct(id: number): Promise<AState> {
  await assertAdmin();
  run('DELETE FROM products WHERE id = ?', id);
  revalidatePath('/admin/products');
  return { ok: 'محصول حذف شد' };
}

export async function duplicateProduct(id: number): Promise<AState> {
  await assertAdmin();
  const p = get<Record<string, unknown> & { name: string; slug: string }>('SELECT * FROM products WHERE id = ?', id);
  if (!p) return { error: 'محصول پیدا نشد' };
  const newId = tx(() => {
    const slug = uniqueSlug('products', `${p.slug}-copy`);
    const info = run(`INSERT INTO products (slug, name, brand_id, category_id, short_desc, description, type, sku, price, sale_price, stock, images, specs, badge, status, featured)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'draft', 0)`, slug, `${p.name} (کپی)`, p.brand_id, p.category_id, p.short_desc, p.description, p.type, null, p.price, p.sale_price, p.stock, p.images, p.specs, p.badge);
    const nid = Number(info.lastInsertRowid);
    run('INSERT INTO product_attributes (product_id, attribute_id, term_ids, for_variations, sort) SELECT ?, attribute_id, term_ids, for_variations, sort FROM product_attributes WHERE product_id = ?', nid, id);
    run('INSERT INTO variations (product_id, sku, price, sale_price, stock, image, attrs, status) SELECT ?, NULL, price, sale_price, stock, image, attrs, status FROM variations WHERE product_id = ?', nid, id);
    return nid;
  });
  revalidatePath('/admin/products');
  redirect(`/admin/products/${newId}`);
}

export async function bulkProducts(fd: FormData): Promise<void> {
  await assertAdmin();
  const ids = fd.getAll('ids').map((x) => Number(x)).filter(Number.isInteger);
  const op = str(fd, 'op');
  if (!ids.length) return;
  if (op === 'publish') run(`UPDATE products SET status = 'published' WHERE id IN (${qs(ids.length)})`, ...ids);
  else if (op === 'draft') run(`UPDATE products SET status = 'draft' WHERE id IN (${qs(ids.length)})`, ...ids);
  else if (op === 'feature') run(`UPDATE products SET featured = 1 WHERE id IN (${qs(ids.length)})`, ...ids);
  else if (op === 'unfeature') run(`UPDATE products SET featured = 0 WHERE id IN (${qs(ids.length)})`, ...ids);
  else if (op === 'delete') run(`DELETE FROM products WHERE id IN (${qs(ids.length)})`, ...ids);
  revalidatePath('/admin/products');
}

export async function toggleProductStatus(id: number): Promise<AState> {
  await assertAdmin();
  run(`UPDATE products SET status = CASE status WHEN 'published' THEN 'draft' ELSE 'published' END WHERE id = ?`, id);
  revalidatePath('/admin/products');
  return { ok: 'وضعیت تغییر کرد' };
}

/* ═════════ ویژگی‌ها و عضوها ═════════ */

export async function saveAttribute(id: number | null, _p: AState, fd: FormData): Promise<AState> {
  await assertAdmin();
  const name = normText(str(fd, 'name'));
  if (name.length < 2) return { error: 'نام ویژگی را وارد کنید' };
  const type = str(fd, 'type') === 'color' ? 'color' : 'select';
  const parent = toIntOrNull(str(fd, 'parent'));
  if (id) {
    const a = get<{ slug: string }>('SELECT slug FROM attributes WHERE id = ?', id);
    if (!a) return { error: 'ویژگی پیدا نشد' };
    const system = Object.values(ATTR).includes(a.slug as never);
    run('UPDATE attributes SET name = ?, type = ?, parent_attribute_id = ? WHERE id = ?', name, system ? get<{ type: string }>('SELECT type FROM attributes WHERE id = ?', id)!.type : type, parent && parent !== id ? parent : null, id);
    revalidatePath('/admin/attributes');
    return { ok: 'ویژگی ذخیره شد' };
  }
  const slug = uniqueSlug('attributes', str(fd, 'slug') || name);
  const info = run('INSERT INTO attributes (slug, name, type, parent_attribute_id, sort) VALUES (?,?,?,?, (SELECT COALESCE(MAX(sort),0)+1 FROM attributes))', slug, name, type, parent);
  revalidatePath('/admin/attributes');
  redirect(`/admin/attributes/${Number(info.lastInsertRowid)}`);
}

export async function deleteAttribute(id: number): Promise<AState> {
  await assertAdmin();
  const a = get<{ slug: string }>('SELECT slug FROM attributes WHERE id = ?', id);
  if (!a) return { error: 'ویژگی پیدا نشد' };
  if (Object.values(ATTR).includes(a.slug as never)) return { error: 'این ویژگی پایه‌ی سیستم است و حذف نمی‌شود' };
  const used = get<{ n: number }>('SELECT COUNT(*) n FROM product_attributes WHERE attribute_id = ?', id)!.n;
  if (used) return { error: `این ویژگی در ${used.toLocaleString('fa-IR')} محصول استفاده شده است؛ ابتدا از محصولات حذفش کنید` };
  run('DELETE FROM attributes WHERE id = ?', id);
  revalidatePath('/admin/attributes');
  redirect('/admin/attributes');
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export async function addTerm(attributeId: number, _p: AState, fd: FormData): Promise<AState> {
  await assertAdmin();
  const a = get<{ id: number; type: string }>('SELECT id, type FROM attributes WHERE id = ?', attributeId);
  if (!a) return { error: 'ویژگی پیدا نشد' };
  const bulk = String(fd.get('bulk') ?? '');
  const parent = toIntOrNull(str(fd, 'parent'));
  const lines = (bulk.trim() ? bulk.split('\n') : [`${str(fd, 'name')}|${str(fd, 'value')}`]).map((l) => l.trim()).filter(Boolean);
  let added = 0;
  tx(() => {
    for (const line of lines) {
      const [rawName, rawVal] = line.split('|');
      const name = normText(rawName ?? '');
      if (!name) continue;
      const slug = slugify(name);
      if (get('SELECT 1 FROM attribute_terms WHERE attribute_id = ? AND slug = ?', attributeId, slug)) continue;
      const value = a.type === 'color' ? (HEX.test((rawVal ?? '').trim()) ? rawVal.trim() : '#cccccc') : null;
      run('INSERT INTO attribute_terms (attribute_id, slug, name, value, parent_term_id, sort) VALUES (?,?,?,?,?, (SELECT COALESCE(MAX(sort),0)+1 FROM attribute_terms WHERE attribute_id = ?))', attributeId, slug, name, value, parent, attributeId);
      added++;
    }
  });
  revalidatePath(`/admin/attributes/${attributeId}`);
  return added ? { ok: `${added.toLocaleString('fa-IR')} مقدار اضافه شد` } : { error: 'مقدار جدیدی اضافه نشد (خالی یا تکراری)' };
}

export async function updateTerm(id: number, _p: AState, fd: FormData): Promise<AState> {
  await assertAdmin();
  const t = get<{ attribute_id: number }>('SELECT attribute_id FROM attribute_terms WHERE id = ?', id);
  if (!t) return { error: 'مقدار پیدا نشد' };
  const a = get<{ type: string }>('SELECT type FROM attributes WHERE id = ?', t.attribute_id)!;
  const name = normText(str(fd, 'name'));
  if (!name) return { error: 'نام را وارد کنید' };
  const val = a.type === 'color' ? (HEX.test(str(fd, 'value')) ? str(fd, 'value') : '#cccccc') : null;
  const parent = toIntOrNull(str(fd, 'parent'));
  run('UPDATE attribute_terms SET name = ?, value = ?, parent_term_id = ?, sort = ? WHERE id = ?', name, val, parent && parent !== id ? parent : null, toInt(str(fd, 'sort')), id);
  revalidatePath(`/admin/attributes/${t.attribute_id}`);
  return { ok: 'ذخیره شد' };
}

export async function deleteTerm(id: number): Promise<AState> {
  await assertAdmin();
  const t = get<{ attribute_id: number; slug: string }>('SELECT attribute_id, slug FROM attribute_terms WHERE id = ?', id);
  if (!t) return { error: 'مقدار پیدا نشد' };
  const used = all<{ term_ids: string }>('SELECT term_ids FROM product_attributes WHERE attribute_id = ?', t.attribute_id).filter((r) => (JSON.parse(r.term_ids) as number[]).includes(id)).length;
  if (used) return { error: `این مقدار در ${used.toLocaleString('fa-IR')} محصول استفاده شده است؛ ابتدا از محصولات حذفش کنید` };
  run('DELETE FROM attribute_terms WHERE id = ?', id);
  revalidatePath(`/admin/attributes/${t.attribute_id}`);
  return { ok: 'حذف شد' };
}

/* ═════════ دسته‌بندی و برند ═════════ */

export async function saveCategory(id: number | null, _p: AState, fd: FormData): Promise<AState> {
  await assertAdmin();
  const name = normText(str(fd, 'name'));
  if (name.length < 2) return { error: 'نام دسته را وارد کنید' };
  const parent = toIntOrNull(str(fd, 'parent'));
  if (id && parent === id) return { error: 'دسته نمی‌تواند زیرمجموعه‌ی خودش باشد' };
  const art = str(fd, 'art') || null;
  const image = str(fd, 'image') || null;
  const vals = [name, parent, art, image && image.startsWith('/uploads/') ? image : null, toInt(str(fd, 'sort')), flag(fd, 'active')];
  if (id) {
    run('UPDATE categories SET name=?, parent_id=?, art=?, image=?, sort=?, active=? WHERE id=?', ...vals, id);
    if (str(fd, 'slug')) { const s = uniqueSlug('categories', str(fd, 'slug'), id); run('UPDATE categories SET slug = ? WHERE id = ?', s, id); }
  } else {
    run('INSERT INTO categories (slug, name, parent_id, art, image, sort, active) VALUES (?,?,?,?,?,?,?)', uniqueSlug('categories', str(fd, 'slug') || name), ...vals);
  }
  revalidatePath('/admin/categories');
  if (!id) redirect('/admin/categories');
  return { ok: 'دسته‌بندی ذخیره شد' };
}

export async function deleteCategory(id: number): Promise<AState> {
  await assertAdmin();
  run('DELETE FROM categories WHERE id = ?', id);
  revalidatePath('/admin/categories');
  redirect('/admin/categories');
}

export async function saveBrand(id: number | null, _p: AState, fd: FormData): Promise<AState> {
  await assertAdmin();
  const name = normText(str(fd, 'name'));
  if (name.length < 1) return { error: 'نام برند را وارد کنید' };
  const logo = str(fd, 'logo');
  if (id) {
    run('UPDATE brands SET name=?, logo=?, sort=?, active=? WHERE id=?', name, logo.startsWith('/uploads/') ? logo : null, toInt(str(fd, 'sort')), flag(fd, 'active'), id);
    if (str(fd, 'slug')) run('UPDATE brands SET slug = ? WHERE id = ?', uniqueSlug('brands', str(fd, 'slug'), id), id);
  } else {
    run('INSERT INTO brands (slug, name, logo, sort, active) VALUES (?,?,?,?,?)', uniqueSlug('brands', str(fd, 'slug') || name), name, logo.startsWith('/uploads/') ? logo : null, toInt(str(fd, 'sort')), flag(fd, 'active'));
  }
  revalidatePath('/admin/brands');
  if (!id) redirect('/admin/brands');
  return { ok: 'برند ذخیره شد' };
}

export async function deleteBrand(id: number): Promise<AState> {
  await assertAdmin();
  run('DELETE FROM brands WHERE id = ?', id);
  revalidatePath('/admin/brands');
  redirect('/admin/brands');
}

/* ═════════ موجودی ═════════ */

export async function setStock(productId: number, variationId: number | null, _p: AState, fd: FormData): Promise<AState> {
  await assertAdmin();
  const v = Math.max(0, toInt(str(fd, 'stock'), NaN));
  if (!Number.isFinite(v)) return { error: 'عدد معتبر وارد کنید' };
  const cur = variationId ? get<{ stock: number }>('SELECT stock FROM variations WHERE id = ? AND product_id = ?', variationId, productId) : get<{ stock: number }>('SELECT stock FROM products WHERE id = ?', productId);
  if (!cur) return { error: 'مورد پیدا نشد' };
  if (cur.stock !== v) adjustStock(productId, variationId, v - cur.stock, str(fd, 'reason') || 'ویرایش دستی موجودی');
  revalidatePath('/admin/inventory');
  return { ok: 'موجودی ثبت شد' };
}

/* ═════════ تخفیف‌ها ═════════ */

export async function bulkDiscount(_p: AState, fd: FormData): Promise<AState> {
  await assertAdmin();
  const mode = str(fd, 'mode');
  const scope = str(fd, 'scope');
  const scopeId = toIntOrNull(str(fd, 'scope_id'));
  const percent = toInt(str(fd, 'percent'));
  const round = Number(str(fd, 'round')) || 1000;
  let where = '1=1'; const args: unknown[] = [];
  if (scope === 'category' && scopeId) {
    const ids = [scopeId]; const rows = all<{ id: number; parent_id: number | null }>('SELECT id, parent_id FROM categories');
    for (let i = 0; i < ids.length; i++) for (const r of rows) if (r.parent_id === ids[i] && !ids.includes(r.id)) ids.push(r.id);
    where = `category_id IN (${qs(ids.length)})`; args.push(...ids);
  } else if (scope === 'brand' && scopeId) { where = 'brand_id = ?'; args.push(scopeId); }
  else if (scope !== 'all') return { error: 'محدوده را انتخاب کنید' };
  const prods = all<{ id: number }>(`SELECT id FROM products WHERE ${where}`, ...args);
  if (!prods.length) return { error: 'محصولی در این محدوده نیست' };
  const ids = prods.map((p) => p.id);
  if (mode === 'remove') {
    run(`UPDATE products SET sale_price = NULL WHERE id IN (${qs(ids.length)})`, ...ids);
    run(`UPDATE variations SET sale_price = NULL WHERE product_id IN (${qs(ids.length)})`, ...ids);
    revalidatePath('/admin/discounts');
    return { ok: `تخفیف ${prods.length.toLocaleString('fa-IR')} محصول برداشته شد` };
  }
  if (percent < 1 || percent > 90) return { error: 'درصد تخفیف بین ۱ تا ۹۰ باشد' };
  const calc = (price: number) => Math.max(round, Math.floor((price * (100 - percent)) / 100 / round) * round);
  tx(() => {
    for (const r of all<{ id: number; price: number }>(`SELECT id, price FROM products WHERE type = 'simple' AND id IN (${qs(ids.length)})`, ...ids)) {
      const sp = calc(r.price); if (sp < r.price) run('UPDATE products SET sale_price = ? WHERE id = ?', sp, r.id);
    }
    for (const r of all<{ id: number; price: number }>(`SELECT id, price FROM variations WHERE product_id IN (${qs(ids.length)})`, ...ids)) {
      const sp = calc(r.price); if (sp < r.price) run('UPDATE variations SET sale_price = ? WHERE id = ?', sp, r.id);
    }
  });
  revalidatePath('/admin/discounts');
  return { ok: `تخفیف ${percent.toLocaleString('fa-IR')}٪ روی ${prods.length.toLocaleString('fa-IR')} محصول اعمال شد` };
}

export async function removeProductDiscount(id: number): Promise<AState> {
  await assertAdmin();
  run('UPDATE products SET sale_price = NULL WHERE id = ?', id);
  run('UPDATE variations SET sale_price = NULL WHERE product_id = ?', id);
  revalidatePath('/admin/discounts');
  return { ok: 'تخفیف برداشته شد' };
}

/* ═════════ کد تخفیف ═════════ */

export async function saveCoupon(id: number | null, _p: AState, fd: FormData): Promise<AState> {
  await assertAdmin();
  const code = normText(str(fd, 'code')).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (code.length < 3) return { error: 'کد باید حداقل ۳ نویسه‌ی انگلیسی یا عدد باشد' };
  const type = str(fd, 'type') === 'fixed' ? 'fixed' : 'percent';
  const value = toInt(str(fd, 'value'));
  if (value <= 0 || (type === 'percent' && value > 100)) return { error: type === 'percent' ? 'درصد باید بین ۱ تا ۱۰۰ باشد' : 'مبلغ تخفیف را وارد کنید' };
  const dup = get('SELECT 1 FROM coupons WHERE UPPER(code) = ? AND id <> ?', code, id ?? 0);
  if (dup) return { error: 'این کد قبلاً ساخته شده است' };
  const vals = [code, type, value, type === 'percent' ? toIntOrNull(str(fd, 'max_discount')) : null, toInt(str(fd, 'min_total')), toIntOrNull(str(fd, 'max_uses')), str(fd, 'starts_at') || null, str(fd, 'ends_at') || null, flag(fd, 'active'), normText(str(fd, 'note'))];
  if (id) run('UPDATE coupons SET code=?, type=?, value=?, max_discount=?, min_total=?, max_uses=?, starts_at=?, ends_at=?, active=?, note=? WHERE id=?', ...vals, id);
  else run('INSERT INTO coupons (code, type, value, max_discount, min_total, max_uses, starts_at, ends_at, active, note) VALUES (?,?,?,?,?,?,?,?,?,?)', ...vals);
  revalidatePath('/admin/coupons');
  if (!id) redirect('/admin/coupons');
  return { ok: 'کد تخفیف ذخیره شد' };
}

export async function deleteCoupon(id: number): Promise<AState> {
  await assertAdmin();
  run('DELETE FROM coupons WHERE id = ?', id);
  revalidatePath('/admin/coupons');
  return { ok: 'کد تخفیف حذف شد' };
}

export async function toggleCoupon(id: number): Promise<AState> {
  await assertAdmin();
  run('UPDATE coupons SET active = 1 - active WHERE id = ?', id);
  revalidatePath('/admin/coupons');
  return { ok: 'وضعیت تغییر کرد' };
}
