/**
 * افزودن ۹ محصول نمونه‌ی شارژر/کابل اپل و سامسونگ با عکس واقعی، بدون پاک کردن داده‌های موجود.
 * امن برای اجرای چندباره: محصولی که slug آن موجود باشد دوباره ساخته نمی‌شود (فقط عکسش به عکس جدید تغییر می‌کند).
 *
 *   npm run seed:chargers
 */
import { db, run, get } from '../src/lib/db';
import { CHARGER_PRODUCTS } from './charger-products';

const NAMES: Record<string, string> = { apple: 'Apple', samsung: 'Samsung' };
const CATS: Record<string, string> = { charger: 'شارژر', cable: 'کابل و مبدل' };

const brandId = (s: string) =>
  get<{ id: number }>('SELECT id FROM brands WHERE slug = ?', s)?.id
  ?? Number(run('INSERT INTO brands (slug, name, sort) VALUES (?,?,?)', s, NAMES[s], 0).lastInsertRowid);
const catId = (s: string) =>
  get<{ id: number }>('SELECT id FROM categories WHERE slug = ?', s)?.id
  ?? Number(run('INSERT INTO categories (slug, name, sort) VALUES (?,?,?)', s, CATS[s], 0).lastInsertRowid);

let added = 0;
let updated = 0;
db.transaction(() => {
  for (const p of CHARGER_PRODUCTS) {
    const images = JSON.stringify([`/demo/chargers/${p.img}.jpg`]);
    const ex = get<{ id: number }>('SELECT id FROM products WHERE slug = ?', p.slug);
    if (ex) {
      run('UPDATE products SET images = ? WHERE id = ?', images, ex.id);
      updated++;
      continue;
    }
    run(
      `INSERT INTO products (slug, name, brand_id, category_id, short_desc, description, type, sku, price, stock, images, specs, badge, featured, created_at)
       VALUES (?,?,?,?,?,?, 'simple', ?,?,?,?,?,?,0, datetime('now', ?))`,
      p.slug, p.name, brandId(p.brand), catId(p.cat), p.short, p.desc, p.sku, p.price, p.stock, images,
      JSON.stringify(p.specs.map(([k, v]) => ({ k, v }))), p.badge ?? null, `-${p.daysAgo} days`);
    added++;
  }
})();
console.log(`✓ ${added} محصول جدید اضافه شد، ${updated} محصول موجود با عکس جدید به‌روز شد.`);
