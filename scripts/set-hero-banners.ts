/**
 * جایگزینی اسلایدرهای صفحه‌ی اصلی با ۴ بنر تمام‌تصویر از عکس واقعی محصول.
 * فقط بنرهای «اسلایدر» عوض می‌شوند؛ بنرهای تبلیغاتی میانی، محصول‌ها و سفارش‌ها دست نمی‌خورند.
 * قابل اجرای چندباره.
 *
 *   npm run seed:hero
 */
import { db, run } from '../src/lib/db';
import { HERO_BANNERS } from './hero-banners';

db.transaction(() => {
  run("DELETE FROM banners WHERE position = 'hero'");
  HERO_BANNERS.forEach((b, i) => {
    run(
      `INSERT INTO banners (position, layout, theme, badge, title, subtitle, cta_text, link, image, image_mobile, art, sort, active)
       VALUES ('hero', 'cover', 'night', ?, ?, ?, ?, ?, ?, ?, NULL, ?, 1)`,
      b.badge, b.title, b.subtitle, b.cta, b.link, `/demo/hero/h${b.n}.webp`, `/demo/hero/m${b.n}.webp`, i + 1);
  });
})();
console.log(`✓ ${HERO_BANNERS.length} بنر اسلایدر با عکس واقعی ساخته شد.`);
