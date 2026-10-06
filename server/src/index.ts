import { fileURLToPath } from 'node:url';
import { loadConfig } from './config';
import { openDb } from './db';
import { createGameServer } from './server';

const botToken = process.env.BOT_TOKEN;
const isProd = process.env.NODE_ENV === 'production';
const devAuth = process.env.DEV_AUTH === '1' || (!isProd && !botToken);
if (isProd && !botToken) throw new Error('در حالت production باید BOT_TOKEN تنظیم شود');
if (isProd && devAuth) throw new Error('DEV_AUTH در production مجاز نیست');

const port = Number(process.env.PORT ?? 3000);
const db = openDb(process.env.DB_PATH ?? fileURLToPath(new URL('../game.db', import.meta.url)));
const { http } = createGameServer({
  db, cfg: loadConfig(), auth: { botToken, devAuth },
  staticDir: fileURLToPath(new URL('../../client/dist', import.meta.url)),
});
http.listen(port, () => {
  console.log(`سرور روی http://localhost:${port} بالا آمد ${devAuth ? '(حالت توسعه: ورود آزمایشی فعال)' : ''}`);
});
