import { spawn } from 'node:child_process';
import { createGzip } from 'node:zlib';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { getBool, getNumber, getSetting, setSetting } from '../settings/service';
import { adminChatIds } from '../notifications/service';
import { audit } from '../admin/audit';

/** Telegram bots can upload at most 50 MB per file. */
export const MAX_BACKUP_BYTES = 49 * 1024 * 1024;

export type BackupSender = (chatId: bigint, file: Buffer, name: string, caption: string) => Promise<void>;
let sender: BackupSender | undefined;
export const setBackupSender = (s: BackupSender | undefined) => { sender = s; };

/** pg_dump (plain SQL, gzipped). Restore with:  gunzip -c db_X.sql.gz | docker compose exec -T db psql -U vpn vpnbot */
export async function dumpDatabase(databaseUrl = env().DATABASE_URL): Promise<Buffer> {
  const u = new URL(databaseUrl);
  const args = ['--no-owner', '-h', u.hostname, '-p', u.port || '5432', '-U', decodeURIComponent(u.username), u.pathname.slice(1)];
  const child = spawn('pg_dump', args, { env: { ...process.env, PGPASSWORD: decodeURIComponent(u.password) } });
  let err = '';
  child.stderr.on('data', (d) => { err += String(d); });
  const exited = new Promise<number>((resolve, reject) => {
    child.on('error', (e) => reject(new Error(`pg_dump is not available in this container (${e.message})`)));
    child.on('close', (code) => resolve(code ?? 1));
  });
  const gz = createGzip();
  child.stdout.pipe(gz);
  const chunks: Buffer[] = [];
  const gzipped = new Promise<Buffer>((resolve, reject) => {
    gz.on('data', (c: Buffer) => chunks.push(c));
    gz.on('end', () => resolve(Buffer.concat(chunks)));
    gz.on('error', reject);
  });
  const [code, buf] = await Promise.all([exited, gzipped]);
  if (code !== 0) throw new Error(`pg_dump failed (${code}): ${err.slice(0, 300)}`);
  if (buf.length < 200) throw new Error('the dump is empty');
  return buf;
}

const tehranDay = (d = new Date()) => new Date(d.getTime() + 3.5 * 3_600_000).toISOString().slice(0, 10);
const tehranHour = (d = new Date()) => new Date(d.getTime() + 3.5 * 3_600_000).getUTCHours();

/** Dump now and send it to every super admin. Returns how many admins received it. */
export async function sendBackupNow(actor = 'system'): Promise<{ sent: number; bytes: number; name: string }> {
  if (!sender) throw new Error('the bot is not connected to Telegram');
  const file = await dumpDatabase();
  if (file.length > MAX_BACKUP_BYTES) throw new Error(`the backup is ${(file.length / 1048576).toFixed(0)} MB; Telegram accepts at most 50 MB`);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const name = `db_${stamp}.sql.gz`;
  const caption = `💾 بکاپ دیتابیس\n${(file.length / 1024).toFixed(0)} KB · ${stamp}\n\nبازگردانی:\ngunzip -c ${name} | docker compose exec -T db psql -U vpn vpnbot\n\n⚠️ شامل اطلاعات کاربران است؛ در جای امن نگه دارید. رسیدها و فایل .env در این بکاپ نیستند.`;
  let sent = 0;
  for (const chatId of await adminChatIds(['SUPER_ADMIN'])) {
    try { await sender(chatId, file, name, caption); sent++; } catch (e: any) { logger.warn({ chatId: String(chatId), err: String(e?.message) }, 'backup send failed'); }
  }
  if (!sent) throw new Error('could not deliver the backup to any admin');
  await audit({ actor, action: 'backup.telegram', target: 'System', targetId: name, metadata: { bytes: file.length, sent } });
  return { sent, bytes: file.length, name };
}

/** Scheduler job: once a day (Tehran time, at/after `backup.hour`) when `backup.telegram` is on. */
export async function runBackupTick(now = new Date()) {
  if (!(await getBool('backup.telegram'))) return;
  if (tehranHour(now) < (await getNumber('backup.hour'))) return;
  const today = tehranDay(now);
  if ((await getSetting('backup.lastDay')) === today) return;
  await setSetting('backup.lastDay', today); // claimed first: a failure retries tomorrow, never in a tight loop
  try { await sendBackupNow(); } catch (e: any) {
    logger.error({ err: String(e?.message) }, 'daily backup failed');
    const { notifyAdmins } = await import('../notifications/service');
    await notifyAdmins('backup_failed', `⚠️ بکاپ خودکار انجام نشد: ${String(e?.message).slice(0, 200)}`);
  }
}
