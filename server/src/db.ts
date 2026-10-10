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
  try { db.exec("ALTER TABLE boxes ADD COLUMN type TEXT NOT NULL DEFAULT 'bronze'"); } catch { /* ستون از قبل هست */ }
  return db;
}
