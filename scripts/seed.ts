/**
 * داده‌ی اولیه: مدیر، ویژگی‌ها، دسته‌ها، برندها، محصولات (ساده و متغیر)، بنرها، کوپن و (اختیاری) سفارش‌های نمونه.
 *
 *   npm run seed                 داده‌ی نمونه‌ی کامل
 *   npm run seed -- --empty      فقط مدیر، تنظیمات و ویژگی‌های پایه (برای شروع فروشگاه واقعی)
 *   npm run seed:reset           پاک‌سازی همه‌ی داده‌ها و ساخت دوباره
 */
import { db, run, get, all } from '../src/lib/db';
import { hashPassword } from '../src/lib/password';
import { generateCombos, effectivePrice } from '../src/lib/variations';

const reset = process.argv.includes('--reset');
const empty = process.argv.includes('--empty');

if (reset) {
  db.pragma('foreign_keys = OFF');
  for (const t of ['inventory_log', 'payments', 'order_items', 'orders', 'reviews', 'coupons', 'banners', 'variations', 'product_attributes', 'products', 'attribute_terms', 'attributes', 'categories', 'brands', 'settings', 'users']) {
    db.exec(`DELETE FROM ${t}; DELETE FROM sqlite_sequence WHERE name = '${t}';`);
  }
  db.pragma('foreign_keys = ON');
  console.log('✓ داده‌ها پاک شد');
}

if (get<{ n: number }>('SELECT COUNT(*) n FROM users')!.n > 0 && !reset) {
  console.log('پایگاه داده قبلاً مقداردهی شده است. برای شروع دوباره: npm run seed:reset');
  process.exit(0);
}

db.transaction(() => {
  /* ───── کاربران ───── */
  const adminLogin = process.env.ADMIN_LOGIN || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  run('INSERT INTO users (name, login, password_hash, role) VALUES (?,?,?,?)', 'مدیر فروشگاه', adminLogin, hashPassword(adminPass), 'admin');
  if (!empty) run('INSERT INTO users (name, login, password_hash, role) VALUES (?,?,?,?)', 'مشتری نمونه', '09120000000', hashPassword('demo1234'), 'customer');

  /* ───── ویژگی‌های سراسری ───── */
  const attr = (slug: string, name: string, type: 'select' | 'color', parent: string | null, sort: number) =>
    Number(run('INSERT INTO attributes (slug, name, type, parent_attribute_id, sort) VALUES (?,?,?,?,?)', slug, name, type,
      parent ? get<{ id: number }>('SELECT id FROM attributes WHERE slug = ?', parent)!.id : null, sort).lastInsertRowid);
  const term = (attrSlug: string, slug: string, name: string, value: string | null = null, parentTerm: string | null = null, sort = 0) => {
    const a = get<{ id: number }>('SELECT id FROM attributes WHERE slug = ?', attrSlug)!.id;
    const pt = parentTerm ? get<{ id: number }>('SELECT t.id FROM attribute_terms t JOIN attributes x ON x.id = t.attribute_id WHERE t.slug = ? AND x.slug = \'phone-brand\'', parentTerm)?.id ?? null : null;
    run('INSERT INTO attribute_terms (attribute_id, slug, name, value, parent_term_id, sort) VALUES (?,?,?,?,?,?)', a, slug, name, value, pt, sort);
  };

  attr('phone-brand', 'برند گوشی', 'select', null, 1);
  attr('phone-model', 'مدل گوشی', 'select', 'phone-brand', 2);
  attr('color', 'رنگ', 'color', null, 3);
  attr('length', 'طول کابل', 'select', null, 4);
  attr('capacity', 'ظرفیت', 'select', null, 5);

  [['apple', 'Apple'], ['samsung', 'Samsung'], ['xiaomi', 'Xiaomi']].forEach(([s, n], i) => term('phone-brand', s, n, null, null, i));
  const models: [string, string, string][] = [
    ['iphone-15-pro-max', 'iPhone 15 Pro Max', 'apple'], ['iphone-15-pro', 'iPhone 15 Pro', 'apple'], ['iphone-15', 'iPhone 15', 'apple'], ['iphone-14', 'iPhone 14', 'apple'],
    ['galaxy-s24-ultra', 'Galaxy S24 Ultra', 'samsung'], ['galaxy-s24', 'Galaxy S24', 'samsung'], ['galaxy-a55', 'Galaxy A55', 'samsung'],
    ['redmi-note-13-pro', 'Redmi Note 13 Pro', 'xiaomi'], ['redmi-note-13', 'Redmi Note 13', 'xiaomi'], ['poco-x6', 'POCO X6', 'xiaomi'],
  ];
  models.forEach(([s, n, b], i) => term('phone-model', s, n, null, b, i));
  const colors: [string, string, string][] = [
    ['black', 'مشکی', '#17181c'], ['white', 'سفید', '#f3f4f6'], ['blue', 'آبی', '#2f6bff'], ['pink', 'صورتی', '#f2a7c3'],
    ['green', 'سبز', '#3f8f6b'], ['sand', 'شنی', '#d8c3a5'], ['clear', 'شفاف', '#dbe4ee'],
  ];
  colors.forEach(([s, n, v], i) => term('color', s, n, v, null, i));
  [['1m', '۱ متر'], ['1-5m', '۱٫۵ متر'], ['2m', '۲ متر']].forEach(([s, n], i) => term('length', s, n, null, null, i));
  [['64gb', '۶۴ گیگابایت'], ['128gb', '۱۲۸ گیگابایت'], ['256gb', '۲۵۶ گیگابایت']].forEach(([s, n], i) => term('capacity', s, n, null, null, i));

  /* ───── تنظیمات ───── */
  run("INSERT INTO settings (key, value) VALUES ('store_name', 'Caseline')");

  if (empty) {
    run('INSERT INTO categories (slug, name, sort) VALUES (?,?,?)', 'accessories', 'لوازم جانبی', 1);
    return;
  }

  /* ───── دسته‌ها و برندها ───── */
  const cats: [string, string, string][] = [
    ['case', 'قاب و کاور', 'p-case'], ['glass', 'گلس و محافظ', 'p-glass'], ['cable', 'کابل و مبدل', 'p-cable'], ['charger', 'شارژر', 'p-charger'],
    ['powerbank', 'پاوربانک', 'p-bank'], ['audio', 'هندزفری و هدفون', 'p-buds'], ['holder', 'هولدر', 'p-holder'], ['storage', 'فلش و حافظه', 'p-flash'],
  ];
  cats.forEach(([s, n, a], i) => run('INSERT INTO categories (slug, name, art, sort) VALUES (?,?,?,?)', s, n, a, i));
  ['Apple', 'Samsung', 'Xiaomi', 'Anker', 'Baseus', 'Belkin', 'SanDisk', 'JBL'].forEach((n, i) => run('INSERT INTO brands (slug, name, sort) VALUES (?,?,?)', n.toLowerCase(), n, i));

  const catId = (s: string) => get<{ id: number }>('SELECT id FROM categories WHERE slug = ?', s)!.id;
  const brandId = (s: string) => get<{ id: number }>('SELECT id FROM brands WHERE slug = ?', s)!.id;
  const termId = (a: string, t: string) => get<{ id: number }>('SELECT t.id FROM attribute_terms t JOIN attributes x ON x.id = t.attribute_id WHERE x.slug = ? AND t.slug = ?', a, t)!.id;
  const termName = (a: string, t: string) => get<{ name: string }>('SELECT t.name FROM attribute_terms t JOIN attributes x ON x.id = t.attribute_id WHERE x.slug = ? AND t.slug = ?', a, t)!.name;
  const termVal = (t: string) => colors.find((c) => c[0] === t)?.[2] ?? null;

  type P = {
    slug: string; name: string; brand: string; cat: string; short: string; desc: string; price: number; sale?: number; stock?: number;
    art: string; badge?: 'new' | 'best' | 'promo'; featured?: boolean; sku: string; specs?: [string, string][]; daysAgo?: number;
  };
  const addSimple = (p: P) => {
    const id = Number(run(
      `INSERT INTO products (slug, name, brand_id, category_id, short_desc, description, type, sku, price, sale_price, stock, images, specs, badge, featured, created_at)
       VALUES (?,?,?,?,?,?, 'simple', ?,?,?,?,?,?,?,?, datetime('now', ?))`,
      p.slug, p.name, brandId(p.brand), catId(p.cat), p.short, p.desc, p.sku, p.price, p.sale ?? null, p.stock ?? 20,
      JSON.stringify([`art:${p.art}`]), JSON.stringify((p.specs ?? []).map(([k, v]) => ({ k, v }))), p.badge ?? null, p.featured ? 1 : 0, `-${p.daysAgo ?? 40} days`).lastInsertRowid);
    return id;
  };
  type VarSpec = { attrs: { slug: string; terms: string[] }[]; price: (a: Record<string, string>) => number; sale?: (a: Record<string, string>) => number | null; stock: (a: Record<string, string>, i: number) => number; art?: (a: Record<string, string>) => string };
  const addVariable = (p: P, vs: VarSpec) => {
    const id = Number(run(
      `INSERT INTO products (slug, name, brand_id, category_id, short_desc, description, type, sku, price, images, specs, badge, featured, created_at)
       VALUES (?,?,?,?,?,?, 'variable', ?,?,?,?,?,?, datetime('now', ?))`,
      p.slug, p.name, brandId(p.brand), catId(p.cat), p.short, p.desc, p.sku, p.price,
      JSON.stringify([`art:${p.art}`]), JSON.stringify((p.specs ?? []).map(([k, v]) => ({ k, v }))), p.badge ?? null, p.featured ? 1 : 0, `-${p.daysAgo ?? 40} days`).lastInsertRowid);
    const genAttrs = vs.attrs.map((a, i) => {
      const row = get<{ id: number; parent_attribute_id: number | null }>('SELECT id, parent_attribute_id FROM attributes WHERE slug = ?', a.slug)!;
      const terms = a.terms.map((t) => ({ id: termId(a.slug, t), slug: t, parent_term_id: get<{ parent_term_id: number | null }>('SELECT parent_term_id FROM attribute_terms WHERE id = ?', termId(a.slug, t))!.parent_term_id }));
      run('INSERT INTO product_attributes (product_id, attribute_id, term_ids, for_variations, sort) VALUES (?,?,?,1,?)', id, row.id, JSON.stringify(terms.map((t) => t.id)), i);
      return { id: row.id, slug: a.slug, parent_attribute_id: row.parent_attribute_id, terms };
    });
    generateCombos(genAttrs).forEach((combo, i) => {
      const price = vs.price(combo);
      const sale = vs.sale?.(combo) ?? null;
      const sku = `${p.sku}-${Object.values(combo).join('-')}`.toUpperCase();
      run('INSERT INTO variations (product_id, sku, price, sale_price, stock, image, attrs) VALUES (?,?,?,?,?,?,?)', id, sku, price, sale, vs.stock(combo, i), vs.art ? `art:${vs.art(combo)}` : null, JSON.stringify(combo));
    });
    return id;
  };

  const tint = (c: Record<string, string>) => `p-case@${termVal(c.color) ?? '#d8c3a5'}`;

  addVariable({
    slug: 'magsafe-silicone-case', name: 'قاب سیلیکونی MagSafe', brand: 'apple', cat: 'case', sku: 'MS-CASE', price: 1490000, featured: true, badge: 'best', art: 'p-case', daysAgo: 60,
    short: 'سیلیکون نرم با آهنربای MagSafe و آستر میکروفایبر؛ مخصوص گوشی‌های آیفون.',
    desc: 'قاب سیلیکونی با لبه‌های برجسته برای محافظت از دوربین و صفحه، آهنربای داخلی هم‌تراز با شارژر MagSafe و سطح نرم و ضدلک.\n\nقبل از خرید، مدل گوشی خود را انتخاب کنید تا فقط رنگ‌های موجود برای همان مدل نمایش داده شود.',
    specs: [['جنس', 'سیلیکون + آستر میکروفایبر'], ['سازگاری با MagSafe', 'دارد'], ['گارانتی', '۷ روز تعویض']],
  }, {
    attrs: [{ slug: 'phone-brand', terms: ['apple'] }, { slug: 'phone-model', terms: ['iphone-15-pro-max', 'iphone-15-pro', 'iphone-15', 'iphone-14'] }, { slug: 'color', terms: ['black', 'white', 'blue', 'pink', 'sand'] }],
    price: (c) => (c['phone-model'] === 'iphone-15-pro-max' ? 1690000 : c['phone-model'] === 'iphone-14' ? 1290000 : 1490000),
    sale: (c) => (c['phone-model'] === 'iphone-14' ? 1090000 : null),
    stock: (c, i) => (c.color === 'pink' && c['phone-model'] === 'iphone-14' ? 0 : 4 + ((i * 7) % 25)),
    art: tint,
  });

  addVariable({
    slug: 'armor-clear-case', name: 'قاب شفاف ضدضربه Armor', brand: 'baseus', cat: 'case', sku: 'ARM-CASE', price: 590000, featured: true, art: 'p-case', badge: 'new', daysAgo: 5,
    short: 'قاب شفاف با گوشه‌های ضربه‌گیر؛ برای آیفون، گلکسی و شیائومی.',
    desc: 'قاب شفاف ضدزردشدگی با لبه‌ی برجسته‌ی دوربین و گوشه‌های ایرکوشن. برند و مدل گوشی را انتخاب کنید.',
    specs: [['جنس', 'TPU + PC'], ['ضدضربه', 'تا ارتفاع ۲ متر']],
  }, {
    attrs: [{ slug: 'phone-brand', terms: ['apple', 'samsung', 'xiaomi'] }, { slug: 'phone-model', terms: models.map((m) => m[0]) }, { slug: 'color', terms: ['clear', 'black'] }],
    price: (c) => (c['phone-brand'] === 'apple' ? 650000 : c['phone-brand'] === 'samsung' ? 590000 : 450000),
    sale: (c) => (c['phone-brand'] === 'xiaomi' ? 390000 : null),
    stock: (_c, i) => 3 + ((i * 5) % 20),
    art: tint,
  });

  addVariable({
    slug: 'tempered-glass-antistatic', name: 'گلس آنتی‌استاتیک تمام‌صفحه', brand: 'baseus', cat: 'glass', sku: 'GLS', price: 240000, featured: true, art: 'p-glass', daysAgo: 30,
    short: 'سختی ۹H، پوشش ضدلک و ضداستاتیک؛ مخصوص هر مدل.',
    desc: 'گلس نیمه‌شفاف با لبه‌ی گرد و پوشش ضداثر انگشت. همراه کیت نصب (دستمال، چسب گردوغبار).',
    specs: [['سختی', '9H'], ['ضخامت', '۰٫۳۳ میلی‌متر'], ['محتویات بسته', 'گلس، کیت نصب']],
  }, {
    attrs: [{ slug: 'phone-brand', terms: ['apple', 'samsung', 'xiaomi'] }, { slug: 'phone-model', terms: models.map((m) => m[0]) }],
    price: (c) => (c['phone-model'].includes('ultra') || c['phone-model'].includes('max') ? 290000 : 240000),
    sale: (c) => (c['phone-model'] === 'galaxy-s24-ultra' ? 260000 : null),
    stock: (c, i) => (c['phone-model'] === 'galaxy-s24-ultra' ? 0 : 10 + ((i * 3) % 40)),
  });

  addVariable({
    slug: 'usb-c-cable-fast', name: 'کابل USB-C به USB-C شارژ سریع ۱۰۰ وات', brand: 'anker', cat: 'cable', sku: 'CBL-CC', price: 420000, art: 'p-cable', daysAgo: 70,
    short: 'کابل بافته‌شده با پشتیبانی از شارژ ۱۰۰ وات و انتقال داده‌ی ۴۸۰Mbps.',
    desc: 'کابل نایلونی مقاوم، مناسب شارژ سریع لپ‌تاپ، تبلت و گوشی.',
    specs: [['توان', '۱۰۰ وات'], ['نوع کانکتور', 'USB-C به USB-C']],
  }, {
    attrs: [{ slug: 'length', terms: ['1m', '1-5m', '2m'] }],
    price: (c) => (c.length === '1m' ? 420000 : c.length === '1-5m' ? 490000 : 560000), stock: () => 40,
  });

  addSimple({ slug: 'lightning-mfi-cable', name: 'کابل Lightning به USB-C مدل MFi', brand: 'belkin', cat: 'cable', sku: 'LTN-MFI', price: 980000, sale: 890000, art: 'p-cable', stock: 30, daysAgo: 55,
    short: 'کابل دارای گواهی MFi اپل با روکش بافته‌شده.', desc: 'کابل رسمی با تراشه‌ی MFi؛ بدون پیام «این لوازم پشتیبانی نمی‌شود».', specs: [['طول', '۱ متر'], ['گواهی', 'MFi']] });
  addSimple({ slug: 'anker-nano-65w', name: 'شارژر دیواری ۶۵ وات GaN مدل Nano', brand: 'anker', cat: 'charger', sku: 'ANK-65', price: 2390000, sale: 1790000, art: 'p-charger', badge: 'new', featured: true, stock: 18, daysAgo: 3,
    short: 'کوچک‌تر از شارژر لپ‌تاپ؛ دو پورت USB-C و یک USB-A.', desc: 'فناوری GaN، شارژ هم‌زمان لپ‌تاپ و گوشی با سرعت کامل.', specs: [['توان خروجی', '۶۵ وات'], ['پورت‌ها', '۲×USB-C + ۱×USB-A'], ['فناوری', 'GaN II']] });
  addSimple({ slug: 'apple-20w-charger', name: 'شارژر ۲۰ وات اصلی اپل', brand: 'apple', cat: 'charger', sku: 'APL-20', price: 1350000, art: 'p-charger', stock: 12, daysAgo: 80,
    short: 'آداپتور رسمی ۲۰ وات USB-C.', desc: 'شارژ سریع آیفون و آیپد.', specs: [['توان', '۲۰ وات']] });
  addSimple({ slug: 'baseus-20000-powerbank', name: 'پاوربانک ۲۰٬۰۰۰ میلی‌آمپر ساعت ۶۵ وات', brand: 'baseus', cat: 'powerbank', sku: 'BSE-20K', price: 3150000, sale: 2650000, art: 'p-bank', featured: true, stock: 3, daysAgo: 45,
    short: 'قابل حمل در پرواز، نمایشگر دیجیتال و شارژ لپ‌تاپ.', desc: 'ظرفیت ۲۰٬۰۰۰ میلی‌آمپر ساعت با خروجی ۶۵ وات.', specs: [['ظرفیت', '۲۰٬۰۰۰ mAh'], ['خروجی', '۶۵ وات']] });
  addSimple({ slug: 'xiaomi-10000-powerbank', name: 'پاوربانک ۱۰٬۰۰۰ میلی‌آمپر ساعت', brand: 'xiaomi', cat: 'powerbank', sku: 'XMI-10K', price: 1450000, art: 'p-bank', stock: 25, daysAgo: 90,
    short: 'سبک و جیبی با شارژ ۲۲٫۵ وات.', desc: 'مناسب سفرهای کوتاه و شارژ روزانه.', specs: [['ظرفیت', '۱۰٬۰۰۰ mAh']] });
  addVariable({ slug: 'galaxy-buds-fe', name: 'هندزفری بی‌سیم Galaxy Buds FE', brand: 'samsung', cat: 'audio', sku: 'GBF', price: 4290000, art: 'p-buds', badge: 'new', daysAgo: 8,
    short: 'نویزکنسلینگ فعال و ۸ ساعت پخش.', desc: 'گیرنده‌ی بلوتوث ۵٫۳ با کیفیت صدای متعادل.', specs: [['اتصال', 'بلوتوث ۵٫۳'], ['نویزکنسلینگ', 'ANC']] },
  { attrs: [{ slug: 'color', terms: ['black', 'white', 'blue'] }], price: () => 4290000, stock: () => 15 });
  addSimple({ slug: 'jbl-tune-520bt', name: 'هدفون بی‌سیم JBL Tune 520BT', brand: 'jbl', cat: 'audio', sku: 'JBL-520', price: 3350000, art: 'p-buds', stock: 0, daysAgo: 100,
    short: 'باس عمیق و ۵۷ ساعت پخش.', desc: 'هدفون روی‌گوش سبک با میکروفون.', specs: [['پخش', '۵۷ ساعت']] });
  addSimple({ slug: 'orbit-car-holder', name: 'هولدر مگنتی خودرو مدل Orbit', brand: 'baseus', cat: 'holder', sku: 'ORB', price: 690000, sale: 590000, art: 'p-holder', badge: 'promo', stock: 60, daysAgo: 35,
    short: 'نصب روی دریچه کولر با آهنربای قدرتمند.', desc: 'سازگار با قاب‌های MagSafe و صفحه‌ی آهنربایی.', specs: [['نصب', 'دریچه کولر']] });
  addVariable({ slug: 'sandisk-usb-flash', name: 'فلش مموری USB 3.2', brand: 'sandisk', cat: 'storage', sku: 'SDK', price: 880000, art: 'p-flash', daysAgo: 50,
    short: 'سرعت خواندن تا ۴۰۰ مگابایت بر ثانیه.', desc: 'فلش با بدنه‌ی فشرده و حلقه‌ی آویز.', specs: [['رابط', 'USB 3.2 Gen 1']] },
  { attrs: [{ slug: 'capacity', terms: ['64gb', '128gb', '256gb'] }], price: (c) => (c.capacity === '64gb' ? 590000 : c.capacity === '128gb' ? 880000 : 1490000), stock: () => 35 });
  addSimple({ slug: 'usbc-hdmi-adapter', name: 'مبدل USB-C به HDMI 4K', brand: 'baseus', cat: 'cable', sku: 'HDMI4K', price: 1250000, art: 'p-cable', stock: 14, daysAgo: 65,
    short: 'اتصال گوشی یا لپ‌تاپ به تلویزیون با کیفیت 4K.', desc: 'خروجی 4K@60Hz.', specs: [['خروجی', '4K@60Hz']] });
  addSimple({ slug: 'samsung-akg-earphones', name: 'هندزفری سیمی AKG سامسونگ', brand: 'samsung', cat: 'audio', sku: 'AKG', price: 520000, art: 'p-buds', stock: 28, daysAgo: 75,
    short: 'صدای دقیق با تنظیم AKG.', desc: 'کانکتور USB-C.', specs: [['اتصال', 'USB-C']] });
  addSimple({ slug: 'airpods-pro-2', name: 'ایرپادز پرو نسل ۲', brand: 'apple', cat: 'audio', sku: 'APP2', price: 11900000, art: 'p-buds', featured: true, stock: 6, daysAgo: 20,
    short: 'نویزکنسلینگ فعال و کیس MagSafe.', desc: 'چیپ H2 و کنترل لمسی.', specs: [['چیپ', 'H2']] });

  /* ───── بنرها ───── */
  const banner = (b: { position?: string; layout?: string; theme: string; badge?: string; title: string; subtitle: string; cta: string; link: string; art: string; sort: number }) =>
    run('INSERT INTO banners (position, layout, theme, badge, title, subtitle, cta_text, link, art, sort) VALUES (?,?,?,?,?,?,?,?,?,?)',
      b.position ?? 'hero', b.layout ?? 'split', b.theme, b.badge ?? '', b.title, b.subtitle, b.cta, b.link, b.art, b.sort);
  banner({ theme: 'night', badge: 'جدید|شارژرهای GaN نسل پنجم', title: 'شارژ سریع‌تر.\n*حمل سبک‌تر.*', subtitle: 'شارژر ۶۵ وات اصل برای گوشی و لپ‌تاپ؛ با گارانتی اصالت و ارسال همان روز در تهران.', cta: 'مشاهده‌ی شارژرها', link: '/category/charger', art: 'p-charger', sort: 1 });
  banner({ theme: 'light', badge: 'جدید|انتخاب بر اساس مدل', title: 'قاب *مخصوص گوشی شما*', subtitle: 'برند و مدل گوشی را انتخاب کنید و فقط قاب‌ها و گلس‌های سازگار را ببینید.', cta: 'انتخاب مدل گوشی', link: '/shop?model=iphone-15-pro', art: 'p-case', sort: 2 });
  banner({ theme: 'brand', badge: 'پیشنهاد ویژه', title: 'تا ۲۵٪ تخفیف\n*پاوربانک و شارژر*', subtitle: 'موجودی محدود است؛ قیمت‌ها با پایان موجودی به حالت عادی برمی‌گردد.', cta: 'دیدن تخفیف‌ها', link: '/shop?sale=1', art: 'p-bank', sort: 3 });
  banner({ theme: 'night', badge: 'همه‌ی مدل‌ها', title: 'گلس *ضدضربه و ضداستاتیک*', subtitle: 'سختی ۹H برای آیفون، سامسونگ و شیائومی؛ مدل خود را انتخاب کنید.', cta: 'خرید گلس', link: '/category/glass', art: 'p-glass', sort: 4 });
  banner({ position: 'promo', theme: 'light', title: 'ملزومات Apple', subtitle: 'قاب MagSafe، کابل و شارژر اصل', cta: 'خرید لوازم Apple', link: '/shop?brand=apple', art: 'p-case', sort: 1 });
  banner({ position: 'promo', theme: 'night', title: 'دنیای Galaxy', subtitle: 'گلس، هندزفری و شارژر سامسونگ', cta: 'خرید لوازم Samsung', link: '/shop?brand=samsung', art: 'p-buds', sort: 2 });

  /* ───── کوپن‌ها ───── */
  run("INSERT INTO coupons (code, type, value, max_discount, min_total, note) VALUES ('WELCOME10', 'percent', 10, 300000, 500000, 'تخفیف خوش‌آمد')");
  run("INSERT INTO coupons (code, type, value, min_total, note) VALUES ('SAVE100', 'fixed', 100000, 1000000, 'صد هزار تومان تخفیف خرید بالای یک میلیون')");

  /* ───── نظرات ───── */
  const pid = (slug: string) => get<{ id: number }>('SELECT id FROM products WHERE slug = ?', slug)!.id;
  const rev = (slug: string | null, author: string, rating: number, body: string, home = 0) =>
    run('INSERT INTO reviews (product_id, author, rating, body, approved, show_home) VALUES (?,?,?,?,1,?)', slug ? pid(slug) : null, author, rating, body, home);
  rev('anker-nano-65w', 'مهدی رضایی', 5, 'شارژر ۶۵ وات رو برای لپ‌تاپ و گوشی گرفتم. هر دو رو هم‌زمان با سرعت کامل شارژ می‌کنه و خیلی کوچیکه. بسته‌بندی هم کاملاً اصل بود.', 1);
  rev('tempered-glass-antistatic', 'سارا احمدی', 5, 'گلس رو خودم نصب کردم، بدون حباب و لمس عالی. ارسال هم یک روزه رسید.', 1);
  rev('magsafe-silicone-case', 'علی کریمی', 4, 'آهنربا دقیقاً هم‌تراز شارژر مگ‌سیف می‌شه و دست‌ساز می‌خوره. فقط ای کاش رنگ‌بندی بیشتری داشت.', 1);
  rev('magsafe-silicone-case', 'نیلوفر صادقی', 5, 'اندازه‌ی قاب برای آیفون ۱۵ پرو کاملاً دقیقه.');
  rev('baseus-20000-powerbank', 'امیر حسینی', 5, 'برای سفر عالیه، دو بار گوشی و یک بار لپ‌تاپ رو شارژ کرد.');
  rev('armor-clear-case', 'پریسا نظری', 4, 'شفافیت خوبه و بعد از دو ماه هنوز زرد نشده.');
  rev('galaxy-buds-fe', 'کیان مرادی', 5, 'نویزکنسلینگ برای قیمتش عالیه.');
  rev('usb-c-cable-fast', 'رضا جعفری', 5, 'لپ‌تاپ رو با ۱۰۰ وات شارژ می‌کنه، بافت کابل هم مقاوم‌ه.');

  /* ───── سفارش‌های نمونه برای گزارش‌ها ───── */
  const prods = all<{ id: number; name: string; type: string; price: number; sale_price: number | null }>("SELECT id, name, type, price, sale_price FROM products WHERE status = 'published'");
  const names = ['علی رضایی', 'سارا محمدی', 'حسین کریمی', 'نگار احمدی', 'محمد حسینی', 'زهرا موسوی', 'امیر نوری', 'مریم صادقی'];
  const statuses = ['delivered', 'delivered', 'delivered', 'shipped', 'processing', 'pending', 'cancelled'];
  let seed = 42;
  const rnd = (n: number) => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed % n; };
  for (let d = 29; d >= 0; d--) {
    const count = 1 + rnd(4) + (d < 7 ? 1 : 0);
    for (let k = 0; k < count; k++) {
      const picks = Array.from({ length: 1 + rnd(3) }, () => prods[rnd(prods.length)]);
      let subtotal = 0;
      const lines: { p: (typeof prods)[number]; v: { id: number; price: number; sale_price: number | null; attrs: string } | null; qty: number; price: number }[] = [];
      for (const p of picks) {
        const v = p.type === 'variable' ? get<{ id: number; price: number; sale_price: number | null; attrs: string }>('SELECT id, price, sale_price, attrs FROM variations WHERE product_id = ? ORDER BY RANDOM() LIMIT 1', p.id) ?? null : null;
        const price = v ? effectivePrice(v.price, v.sale_price) : effectivePrice(p.price, p.sale_price);
        const qty = 1 + rnd(2);
        subtotal += price * qty;
        lines.push({ p, v, qty, price });
      }
      const ship = subtotal >= 1500000 ? 0 : 90000;
      const status = statuses[rnd(statuses.length)];
      const paid = status === 'cancelled' ? 'unpaid' : status === 'pending' ? 'unpaid' : 'paid';
      const when = `-${d} days`;
      const info = run(
        `INSERT INTO orders (customer_name, phone, province, city, address, status, payment_method, payment_status, subtotal, discount, shipping, total, admin_note, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,0,?,?, 'سفارش نمونه', datetime('now', ?, ?))`,
        names[rnd(names.length)], `0912${String(1000000 + rnd(8999999))}`, 'تهران', 'تهران', 'خیابان نمونه، پلاک ۱۲', status, rnd(3) ? 'online' : 'cod', paid, subtotal, ship, subtotal + ship, when, `+${rnd(600)} minutes`);
      const oid = Number(info.lastInsertRowid);
      run('UPDATE orders SET number = ? WHERE id = ?', String(100000 + oid), oid);
      for (const l of lines) {
        run('INSERT INTO order_items (order_id, product_id, variation_id, name, variation_label, price, qty) VALUES (?,?,?,?,?,?,?)', oid, l.p.id, l.v?.id ?? null, l.p.name,
          l.v ? Object.values(JSON.parse(l.v.attrs) as Record<string, string>).join(' · ') : '', l.price, l.qty);
      }
      run('INSERT INTO payments (order_id, method, amount, status, created_at) SELECT id, payment_method, total, ?, created_at FROM orders WHERE id = ?', paid === 'paid' ? 'success' : status === 'cancelled' ? 'failed' : 'pending', oid);
    }
  }
  void termName;
})();

console.log(`
✓ داده‌ی اولیه ساخته شد${empty ? ' (حالت خالی)' : ''}

  پنل مدیریت:  /admin
  نام کاربری:  ${process.env.ADMIN_LOGIN || 'admin'}
  رمز عبور:    ${process.env.ADMIN_PASSWORD || 'admin123'}   ← بعد از اولین ورود تغییر دهید (تنظیمات ← حساب من)
${empty ? '' : '\n  مشتری نمونه: 09120000000 / demo1234\n  کد تخفیف:    WELCOME10\n'}`);
