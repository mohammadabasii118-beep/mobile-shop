import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, saveConfig } from './config';
import { openDb } from './db';
import { createGameServer } from './server';

const botToken = process.env.BOT_TOKEN;
const isProd = process.env.NODE_ENV === 'production';
const devAuth = process.env.DEV_AUTH === '1' || (!isProd && !botToken);
if (isProd && !botToken) throw new Error('در حالت production باید BOT_TOKEN تنظیم شود');
if (isProd && devAuth) throw new Error('DEV_AUTH در production مجاز نیست');

const port = Number(process.env.PORT ?? 3000);
const dataDir = process.env.DATA_DIR ?? fileURLToPath(new URL('../../data', import.meta.url));
mkdirSync(dataDir, { recursive: true });
const adminIds = (process.env.ADMIN_IDS ?? '').split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
const db = openDb(process.env.DB_PATH ?? join(dataDir, 'game.db'));
const { http } = createGameServer({
  db, cfg: loadConfig(), auth: { botToken, devAuth }, dataDir, adminIds, saveCfg: (c) => saveConfig(c),
  staticDir: fileURLToPath(new URL('../../client/dist', import.meta.url)),
});
http.listen(port, () => {
  console.log(`سرور «میراث» روی http://localhost:${port} بالا آمد ${devAuth ? '(حالت توسعه: ورود آزمایشی و پنل مدیریت برای همه باز است)' : `(ادمین‌ها: ${adminIds.join(', ') || 'هیچ‌کس'})`}`);
});
