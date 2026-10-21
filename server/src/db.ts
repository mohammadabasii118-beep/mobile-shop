import { createRequire } from 'node:module';

// node:sqlite از require لود می‌شه تا با ابزارهای تست هم سازگار باشه
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
export type Db = InstanceType<typeof DatabaseSync>;

export function openDb(path = ':memory:'): Db {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tg_id INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      avatar TEXT,
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      coins INTEGER NOT NULL DEFAULT 100,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      solo_stage INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_cards (
      user_id INTEGER NOT NULL,
      card_id TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      copies INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, card_id)
    );
    CREATE TABLE IF NOT EXISTS deck (
      user_id INTEGER NOT NULL,
      slot INTEGER NOT NULL,
      card_id TEXT NOT NULL,
      PRIMARY KEY (user_id, slot)
    );
    CREATE TABLE IF NOT EXISTS boxes (
      user_id INTEGER NOT NULL,
      slot INTEGER NOT NULL,
      state TEXT NOT NULL,          -- locked | opening
      ready_at INTEGER,             -- ms epoch (ساعت سرور)
      PRIMARY KEY (user_id, slot)
    );
  `);
  try { db.exec('ALTER TABLE users ADD COLUMN banned INTEGER NOT NULL DEFAULT 0'); } catch { /* ستون از قبل هست */ }
  db.exec(`
    CREATE TABLE IF NOT EXISTS shop_buys (
      user_id INTEGER NOT NULL, slot INTEGER NOT NULL, day INTEGER NOT NULL, sig TEXT NOT NULL,
      PRIMARY KEY (user_id, slot, day, sig)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      pack_id TEXT NOT NULL,
      gems INTEGER NOT NULL,
      toman INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',   -- pending | delivered | canceled
      created_at INTEGER NOT NULL,
      done_at INTEGER
    );
  `);
  try { db.exec("ALTER TABLE orders ADD COLUMN method TEXT NOT NULL DEFAULT 'card'"); } catch { /* ستون از قبل هست */ }
  try { db.exec('ALTER TABLE orders ADD COLUMN coins INTEGER NOT NULL DEFAULT 0'); } catch { /* ستون از قبل هست */ }
  try { db.exec('ALTER TABLE orders ADD COLUMN note TEXT'); } catch { /* ستون از قبل هست */ }
  try { db.exec('ALTER TABLE orders ADD COLUMN stars INTEGER NOT NULL DEFAULT 0'); } catch { /* ستون از قبل هست */ }
  try { db.exec('ALTER TABLE orders ADD COLUMN charge_id TEXT'); } catch { /* ستون از قبل هست */ }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS orders_charge ON orders(charge_id) WHERE charge_id IS NOT NULL');
  try { db.exec("ALTER TABLE boxes ADD COLUMN source TEXT NOT NULL DEFAULT 'multi'"); } catch { /* ستون از قبل هست */ }
  // سفارش‌های قدیمیِ «فقط پنجره‌ی خرید باز شده» (استارِ پرداخت‌نشده، یا کارت‌به‌کارتِ بدون کد پیگیری) دیگر دیده نمی‌شوند
  db.exec("UPDATE orders SET status = 'expired' WHERE status = 'pending' AND ((method = 'stars' AND charge_id IS NULL) OR (method = 'card' AND (note IS NULL OR note = '')))");
  // کاپ‌ها: فقط از نبردهای آنلاین کم و زیاد می‌شود
  try { db.exec('ALTER TABLE users ADD COLUMN trophies INTEGER NOT NULL DEFAULT 0'); } catch { /* ستون از قبل هست */ }
  // الماس سرخ: همه (قدیمی و جدید) با ۵۰ شروع می‌کنند
  try { db.exec('ALTER TABLE users ADD COLUMN gems INTEGER NOT NULL DEFAULT 50'); } catch { /* ستون از قبل هست */ }
  try { db.exec('ALTER TABLE users ADD COLUMN channel_ok INTEGER NOT NULL DEFAULT 0'); } catch { /* ستون از قبل هست */ }
  try { db.exec("ALTER TABLE boxes ADD COLUMN type TEXT NOT NULL DEFAULT 'bronze'"); } catch { /* ستون از قبل هست */ }
  // دوستان: یک ردیف برای هر درخواست (a = فرستنده، b = گیرنده)؛ بعد از پذیرفتن status = accepted
  db.exec(`CREATE TABLE IF NOT EXISTS friends (
    a INTEGER NOT NULL, b INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL,
    PRIMARY KEY (a, b)
  )`);
  // دعوت با لینک رفرال: اگر کاربر هنوز وارد بازی نشده، تا اولین ورود نگه داشته می‌شود
  db.exec('CREATE TABLE IF NOT EXISTS referrals (tg_id INTEGER PRIMARY KEY, referrer INTEGER NOT NULL)');
  // کدهای جایزه: rewards = JSON ({coins,gems,xp,cardId,cardCount,box}); هر بازیکن هر کد را فقط یک‌بار می‌تواند بزند
  db.exec(`CREATE TABLE IF NOT EXISTS redeem_codes (
    code TEXT PRIMARY KEY, rewards TEXT NOT NULL, max_uses INTEGER NOT NULL DEFAULT 0, used INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS redeem_uses (code TEXT NOT NULL, user_id INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (code, user_id));`);
  // زیرمجموعه: هر کاربر فقط یک‌بار و فقط وقتی «تازه» با لینک وارد شده یک ردیف می‌گیرد (کلید = خودِ کاربر، پس با حذف ربات/دوست یا ورود دوباره دوباره حساب نمی‌شود)؛ counted = بعد از تأیید عضویت کانال
  db.exec('CREATE TABLE IF NOT EXISTS referred (user_id INTEGER PRIMARY KEY, referrer INTEGER NOT NULL, at INTEGER NOT NULL, counted INTEGER NOT NULL DEFAULT 0)');
  db.exec('CREATE INDEX IF NOT EXISTS referred_by ON referred(referrer, counted)');
  try { db.exec('ALTER TABLE users ADD COLUMN ref_bonus INTEGER NOT NULL DEFAULT 0'); } catch { /* ستون از قبل هست */ }
  return db;
}
