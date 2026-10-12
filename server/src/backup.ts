import { execFile } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Db } from './db';

const run = promisify(execFile);
/** سقف ارسال فایل توسط ربات تلگرام ۵۰ مگابایت است */
export const TG_MAX_BYTES = 49 * 1024 * 1024;

export interface BackupOpts { db: Db; dataDir: string; codeDir: string; /** پوشه‌ی موقت (پیش‌فرض: tmp سیستم) */ tmp?: string }

/** اگر بکاپ از این بزرگ‌تر شود، به چند تکه‌ی کوچک‌تر تقسیم می‌شود (هیچ چیزی کم نمی‌شود) */
export const PART_BYTES = 45 * 1024 * 1024;

const RESTORE_GUIDE = `بکاپ «میراث»
==============
code/   ← کد برنامه (با node_modules و build)
data/   ← game.db (کاربرها)، game.json (تنظیمات پنل)، uploads/ (عکس‌ها)

برگرداندن روی سرور:
 1) سرویس را خاموش کن:        systemctl stop miras
 2) محتوای code/ را در /opt/miras بریز (یا فقط install.sh را دوباره اجرا کن؛ کد از گیت‌هاب می‌آید)
 3) محتوای data/ را در /opt/miras/data بریز (جایگزین فایل‌های قبلی)
 4) روشن کن:                  systemctl start miras
فایل /etc/miras.env (توکن ربات) داخل بکاپ نیست؛ توکن را از BotFather بگیر.
`;

export interface BackupFile { file: string; name: string }

/**
 * یک بکاپ کامل tar.gz می‌سازد: همه‌ی کد (با node_modules و build) + دیتابیس (نسخه‌ی سازگار) + عکس‌ها و تنظیمات پنل.
 * فایل env سرور (توکن ربات) عمداً داخلش نیست.
 * اگر از سقف تلگرام (۵۰ مگابایت) بزرگ‌تر شود، چیزی حذف نمی‌شود؛ فایل به تکه‌های ۴۵ مگابایتی تقسیم می‌شود.
 */
export async function makeBackup(o: BackupOpts & { partBytes?: number }): Promise<{ files: BackupFile[]; totalBytes: number; summary: string; cleanup: () => void }> {
  const work = mkdtempSync(join(o.tmp ?? tmpdir(), 'miras-backup-'));
  const cleanup = () => rmSync(work, { recursive: true, force: true });
  try {
    const snap = join(work, 'data-backup');
    mkdirSync(snap);
    // نسخه‌ی یکپارچه‌ی دیتابیس (حتی وسط بازی امن است)
    o.db.exec(`VACUUM INTO '${join(snap, 'game.db').replace(/'/g, "''")}'`);
    for (const f of existsSync(o.dataDir) ? readdirSync(o.dataDir) : []) {
      if (f.startsWith('game.db') || f === 'backups') continue;
      cpSync(join(o.dataDir, f), join(snap, f), { recursive: true });
    }
    const name = `miras-backup-${new Date().toISOString().slice(0, 10)}.tar.gz`;
    const full = join(work, name);
    writeFileSync(join(work, 'README-RESTORE.txt'), RESTORE_GUIDE);
    // ساختار مرتب: code/ = کد برنامه، data/ = دیتابیس و عکس‌ها و تنظیمات پنل، README-RESTORE.txt = راهنمای برگرداندن
    await run('tar', ['-czf', full, '--exclude=./data', '--exclude=./.node', '--exclude=./.tmp', '--transform', 's,^\\./,code/,', '-C', o.codeDir, '.',
      '--transform', 's,^data-backup,data,', '-C', work, 'data-backup', 'README-RESTORE.txt']);
    const totalBytes = statSync(full).size;
    // خلاصه‌ی محتوا برای اینکه ادمین بتواند مطمئن شود چیزی جا نیفتاده
    const listing = (await run('tar', ['-tzf', full], { maxBuffer: 256 * 1024 * 1024 })).stdout.split('\n').filter(Boolean);
    const count = (re: RegExp) => listing.filter((x) => re.test(x) && !x.endsWith('/')).length;
    const users = Number((o.db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n);
    const summary = `داخلش: ${count(/^code\//)} فایل کد (${count(/^code\/node_modules\//)} فایل node_modules، ${count(/^code\/client\/dist\//)} فایل build) + دیتابیس ${users} بازیکن + ${count(/^data\/uploads\//)} عکس آپلودی`;
    const limit = o.partBytes ?? PART_BYTES;
    if (totalBytes <= limit) return { files: [{ file: full, name }], totalBytes, summary, cleanup };
    await run('split', ['-b', String(limit), '-d', '-a', '2', full, `${full}.part`]);
    const files = readdirSync(work).filter((f) => f.startsWith(`${name}.part`)).sort().map((f) => ({ file: join(work, f), name: f }));
    rmSync(full);
    return { files, totalBytes, summary, cleanup };
  } catch (e) { cleanup(); throw e; }
}

/** فایل را با ربات برای یک چت می‌فرستد */
export async function sendDocument(apiBase: string, token: string, chatId: number, file: string, name: string, caption: string) {
  const form = new FormData();
  form.set('chat_id', String(chatId));
  form.set('caption', caption);
  form.set('document', new Blob([new Uint8Array(readFileSync(file))]), name);
  const r = await fetch(`${apiBase}/bot${token}/sendDocument`, { method: 'POST', body: form, signal: AbortSignal.timeout(180_000) });
  const j: any = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(j.description ?? `HTTP ${r.status}`);
}

/** بکاپ بساز و فقط برای ادمین‌ها (یا چت‌های داده‌شده‌ی خودِ ادمین) بفرست. تعداد کسانی که همه‌ی تکه‌ها را گرفتند برمی‌گرداند. */
export async function backupToAdmins(o: BackupOpts & { token: string; adminIds: number[]; apiBase?: string; log?: (s: string) => void; chatIds?: number[]; partBytes?: number }): Promise<number> {
  const log = o.log ?? ((s: string) => console.log(`[backup] ${s}`));
  const b = await makeBackup(o);
  let ok = 0;
  try {
    const mb = (b.totalBytes / 1048576).toFixed(1);
    const when = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const n = b.files.length;
    for (const id of o.chatIds ?? o.adminIds) {
      try {
        for (const [i, f] of b.files.entries()) {
          const cap = n === 1
            ? `💾 بکاپ «میراث» — ${when} UTC (${mb} MB)\n${b.summary}`
            : `💾 بکاپ «میراث» — ${when} UTC (${mb} MB)\n${b.summary}\nقسمت ${i + 1} از ${n}${i === 0 ? '\n\nحجم از سقف تلگرام بیشتر است، پس چند تکه فرستاده شد. بعد از دانلود همه‌ی تکه‌ها در یک پوشه، به هم وصل کن.\nلینوکس/مک: cat miras-backup-*.tar.gz.part* > miras-backup.tar.gz\nویندوز (CMD): copy /b miras-backup-*.part* miras-backup.tar.gz' : ''}`;
          await sendDocument(o.apiBase ?? 'https://api.telegram.org', o.token, id, f.file, f.name, cap);
        }
        ok++;
      } catch (e) { log(`ارسال برای ${id} نشد: ${(e as Error).message} (ادمین باید یک‌بار به ربات /start بزند)`); }
    }
  } finally { b.cleanup(); }
  return ok;
}

/** هر ۱۰ دقیقه چک می‌کند؛ بعد از ساعت BACKUP_HOUR (UTC) اگر امروز نفرستاده، بکاپ می‌فرستد. تاریخ آخرین ارسال در فایل می‌ماند تا با ری‌استارت تکرار نشود. */
export function scheduleDailyBackup(o: BackupOpts & { token: string; adminIds: number[]; apiBase?: string; hourUtc?: number }) {
  const stampFile = join(o.dataDir, 'last-backup.txt');
  const tick = async () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    let last = '';
    try { last = readFileSync(stampFile, 'utf8').trim(); } catch { /* هنوز بکاپی نبوده */ }
    if (last === today || now.getUTCHours() < (o.hourUtc ?? 3)) return;
    try {
      const ok = await backupToAdmins(o);
      if (ok > 0) writeFileSync(stampFile, today);
    } catch (e) { console.log(`[backup] خطا: ${(e as Error).message}`); }
  };
  const t = setInterval(tick, 10 * 60 * 1000);
  setTimeout(tick, 30_000);
  return { stop: () => clearInterval(t) };
}
