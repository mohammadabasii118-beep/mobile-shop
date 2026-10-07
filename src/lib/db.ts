import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  login TEXT NOT NULL UNIQUE,
  email TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin','customer')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS brands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  logo TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  art TEXT,
  image TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

-- ویژگی‌های سراسری (مثل ووکامرس): رنگ، برند گوشی، مدل گوشی، طول کابل، ...
-- parent_attribute_id: عضوهای این ویژگی زیرمجموعه‌ی عضوهای ویژگی دیگر هستند (مدل گوشی ← برند گوشی)
CREATE TABLE IF NOT EXISTS attributes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'select' CHECK (type IN ('select','color')),
  parent_attribute_id INTEGER REFERENCES attributes(id) ON DELETE SET NULL,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS attribute_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attribute_id INTEGER NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  value TEXT,
  parent_term_id INTEGER REFERENCES attribute_terms(id) ON DELETE SET NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  UNIQUE (attribute_id, slug)
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  short_desc TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'simple' CHECK (type IN ('simple','variable')),
  sku TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  sale_price INTEGER,
  stock INTEGER NOT NULL DEFAULT 0,
  images TEXT NOT NULL DEFAULT '[]',
  specs TEXT NOT NULL DEFAULT '[]',
  badge TEXT CHECK (badge IN ('new','best','promo') OR badge IS NULL),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','draft')),
  featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status, created_at);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);

CREATE TABLE IF NOT EXISTS product_attributes (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  attribute_id INTEGER NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
  term_ids TEXT NOT NULL DEFAULT '[]',
  for_variations INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, attribute_id)
);

CREATE TABLE IF NOT EXISTS variations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  sale_price INTEGER,
  stock INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  attrs TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled'))
);
CREATE INDEX IF NOT EXISTS idx_variations_product ON variations(product_id);

CREATE TABLE IF NOT EXISTS banners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  position TEXT NOT NULL DEFAULT 'hero' CHECK (position IN ('hero','promo')),
  layout TEXT NOT NULL DEFAULT 'split' CHECK (layout IN ('split','cover')),
  theme TEXT NOT NULL DEFAULT 'night' CHECK (theme IN ('night','light','brand')),
  badge TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  cta_text TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  image TEXT,
  image_mobile TEXT,
  art TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT,
  ends_at TEXT
);

CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('percent','fixed')),
  value INTEGER NOT NULL,
  max_discount INTEGER,
  min_total INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER,
  used INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT,
  ends_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT UNIQUE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  province TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL,
  postal_code TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','shipped','delivered','cancelled','returned')),
  payment_method TEXT NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod','online')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','failed','refunded')),
  subtotal INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  shipping INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  coupon_code TEXT,
  tracking_code TEXT NOT NULL DEFAULT '',
  admin_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  variation_id INTEGER REFERENCES variations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  variation_label TEXT NOT NULL DEFAULT '',
  sku TEXT,
  price INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  image TEXT
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed','refunded')),
  ref TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  driver TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  min_amount INTEGER NOT NULL DEFAULT 0,
  max_amount INTEGER NOT NULL DEFAULT 0,
  config TEXT NOT NULL DEFAULT '{}',
  builtin INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inventory_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variation_id INTEGER,
  delta INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0,
  show_home INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

/** ستون‌های افزوده‌شده بعد از انتشار اول + روش‌های پرداخت پیش‌فرض (بدون پاک‌کردن چیزی) */
function migrate(d: Database.Database) {
  const cols = (t: string) => (d.pragma(`table_info(${t})`) as { name: string }[]).map((c) => c.name);
  if (!cols('orders').includes('pay_code')) d.exec('ALTER TABLE orders ADD COLUMN pay_code TEXT');
  if (!cols('payments').includes('meta')) d.exec('ALTER TABLE payments ADD COLUMN meta TEXT');
  const flag = (k: string, def: number) => {
    const r = d.prepare('SELECT value FROM settings WHERE key = ?').get(k) as { value: string } | undefined;
    return r ? (r.value === '1' ? 1 : 0) : def;
  };
  const ins = d.prepare('INSERT OR IGNORE INTO payment_methods (code, driver, title, description, enabled, sort, builtin) VALUES (?,?,?,?,?,?,1)');
  ins.run('cod', 'cod', 'پرداخت در محل', 'مبلغ را هنگام تحویل بپردازید', flag('pay_cod', 1), 1);
  ins.run('card', 'card', 'کارت به کارت', 'واریز به شماره کارت فروشگاه و ثبت کد پیگیری', 0, 2);
  ins.run('snapp', 'snapp', 'اسنپ‌پی', 'خرید اقساطی با اسنپ‌پی', 0, 3);
  ins.run('torob', 'torob', 'ترب‌پی', 'خرید اقساطی با ترب‌پی', 0, 4);
  ins.run('bale', 'bale', 'بله‌پی', 'پرداخت با کیف پول بله', 0, 5);
  ins.run('test', 'test', 'پرداخت آنلاین (آزمایشی)', 'درگاه شبیه‌ساز؛ پولی کسر نمی‌شود', flag('pay_online', 1), 9);
}

function open() {
  const d = new Database(path.join(DATA_DIR, 'shop.db'));
  d.pragma('journal_mode = WAL');
  d.pragma('foreign_keys = ON');
  d.pragma('busy_timeout = 5000');
  d.exec(SCHEMA);
  migrate(d);
  return d;
}

const g = globalThis as unknown as { __caselineDb?: Database.Database };
export const db: Database.Database = g.__caselineDb ?? (g.__caselineDb = open());

export function all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}
export function get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}
export function run(sql: string, ...params: unknown[]) {
  return db.prepare(sql).run(...params);
}
export function tx<T>(fn: () => T): T {
  return db.transaction(fn)();
}
/** placeholders for IN (...) */
export function qs(n: number) {
  return Array.from({ length: n }, () => '?').join(',');
}
