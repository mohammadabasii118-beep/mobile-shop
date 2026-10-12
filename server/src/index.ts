import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfigWithOverride, saveConfig } from './config';
import { openDb } from './db';
import { startBot } from './bot';
import { backupToAdmins, scheduleDailyBackup } from './backup';
import { versionTag } from './version';
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
const configPath = join(dataDir, 'game.json'); // تنظیمات ویرایش‌شده از پنل مدیریت؛ با آپدیت کد پاک نمی‌شود
const db = openDb(process.env.DB_PATH ?? join(dataDir, 'game.db'));
const staticDir = fileURLToPath(new URL('../../client/dist', import.meta.url));
const cfg = loadConfigWithOverride(configPath);
const { http } = createGameServer({
  db, cfg, auth: { botToken, devAuth }, dataDir, adminIds, telegramApi: process.env.TELEGRAM_API, saveCfg: (c) => saveConfig(c, configPath),
  staticDir,
});
// بکاپ روزانه: فقط برای ادمین‌ها (ADMIN_IDS) در پیام خصوصی ربات فرستاده می‌شود؛ خاموش‌کردن: BACKUP=off
const backupOpts = { db, dataDir, codeDir: fileURLToPath(new URL('../../', import.meta.url)) };
if (botToken && isProd && adminIds.length && process.env.BACKUP !== 'off') scheduleDailyBackup({ ...backupOpts, token: botToken, adminIds, apiBase: process.env.TELEGRAM_API, hourUtc: Number(process.env.BACKUP_HOUR_UTC ?? 3) });
if (botToken && process.env.WEBAPP_URL) startBot({
  token: botToken, webAppUrl: `${process.env.WEBAPP_URL}${process.env.WEBAPP_URL.includes('?') ? '&' : '?'}v=${versionTag(staticDir)}`, welcomeText: () => cfg.ui?.welcome,
  onBackup: async (fromId, chatId) => {
    if (!adminIds.includes(fromId)) return 'این دستور فقط برای ادمین‌هاست.';
    const ok = await backupToAdmins({ ...backupOpts, token: botToken, adminIds, apiBase: process.env.TELEGRAM_API, chatIds: [chatId] });
    return ok ? '✅ بکاپ فرستاده شد.' : '❌ ارسال بکاپ نشد؛ لاگ سرور را ببین.';
  },
});
else if (botToken) console.log('[bot] WEBAPP_URL تنظیم نشده؛ ربات به /start جواب نمی‌دهد.');
http.listen(port, () => {
  console.log(`سرور «میراث» روی http://localhost:${port} بالا آمد ${devAuth ? '(حالت توسعه: ورود آزمایشی و پنل مدیریت برای همه باز است)' : `(ادمین‌ها: ${adminIds.join(', ') || 'هیچ‌کس'})`}`);
});
