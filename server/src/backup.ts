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

/**
 * یک بکاپ کامل tar.gz می‌سازد: همه‌ی کد (با node_modules و build) + دیتابیس (نسخه‌ی سازگار) + عکس‌ها و تنظیمات پنل.
 * فایل env سرور (توکن ربات) عمداً داخلش نیست.
 * اگر حجمش از سقف تلگرام بیشتر شود، اول بدون node_modules/build و اگر باز هم بزرگ بود فقط «داده‌ها» را می‌فرستد.
 */
export async function makeBackup(o: BackupOpts): Promise<{ file: string; name: string; dataOnly: boolean; slim: boolean; cleanup: () => void }> {
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
    const stamp = new Date().toISOString().slice(0, 10);
    const full = join(work, `miras-backup-${stamp}.tar.gz`);
    const base = ['--exclude=./data', '--exclude=./.node', '--exclude=./.tmp'];
    const code = ['-C', o.codeDir, '.', '-C', work, 'data-backup'];
    await run('tar', ['-czf', full, ...base, ...code]);
    if (statSync(full).size <= TG_MAX_BYTES) return { file: full, name: `miras-backup-${stamp}.tar.gz`, dataOnly: false, slim: false, cleanup };
    const slim = join(work, `miras-backup-slim-${stamp}.tar.gz`);
    await run('tar', ['-czf', slim, ...base, '--exclude=./node_modules', '--exclude=./client/dist', ...code]);
    if (statSync(slim).size <= TG_MAX_BYTES) return { file: slim, name: `miras-backup-slim-${stamp}.tar.gz`, dataOnly: false, slim: true, cleanup };
    const dataOnly = join(work, `miras-data-${stamp}.tar.gz`);
    await run('tar', ['-czf', dataOnly, '-C', work, 'data-backup']);
    return { file: dataOnly, name: `miras-data-${stamp}.tar.gz`, dataOnly: true, slim: false, cleanup };
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

/** بکاپ بساز و فقط برای ادمین‌ها (یا چت‌های داده‌شده‌ی خودِ ادمین) بفرست. تعداد موفق را برمی‌گرداند. */
export async function backupToAdmins(o: BackupOpts & { token: string; adminIds: number[]; apiBase?: string; log?: (s: string) => void; chatIds?: number[] }): Promise<number> {
  const log = o.log ?? ((s: string) => console.log(`[backup] ${s}`));
  const b = await makeBackup(o);
  let ok = 0;
  try {
    const kb = Math.round(statSync(b.file).size / 1024);
    const cap = `💾 بکاپ «میراث» — ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC (${kb} KB)${b.dataOnly ? '\n⚠️ حجم از سقف تلگرام (۵۰ مگابایت) بیشتر بود؛ فقط داده‌ها (کاربرها، عکس‌ها، تنظیمات) فرستاده شد. کد روی گیت‌هاب هست.' : b.slim ? '\n⚠️ حجم کامل از سقف تلگرام بیشتر بود؛ بدون node_modules و build فرستاده شد.' : ''}`;
    for (const id of o.chatIds ?? o.adminIds) {
      try { await sendDocument(o.apiBase ?? 'https://api.telegram.org', o.token, id, b.file, b.name, cap); ok++; }
      catch (e) { log(`ارسال برای ${id} نشد: ${(e as Error).message} (ادمین باید یک‌بار به ربات /start بزند)`); }
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
