import { beforeEach, describe, expect, it } from 'vitest';
import { gunzipSync } from 'node:zlib';
import { makeProduct, resetDb, setup } from './helpers';
import { setSetting, getSetting } from '../src/modules/settings/service';
import { dumpDatabase, runBackupTick, sendBackupNow, setBackupSender } from '../src/modules/backup/service';
import { prisma } from '../src/db/client';

setup();
beforeEach(async () => { await resetDb(); setBackupSender(undefined); });

describe('telegram backup', () => {
  it('dumps the real database as gzipped SQL that contains the data', async () => {
    await makeProduct({ name: 'پلن-بکاپ-تست' });
    const sql = gunzipSync(await dumpDatabase(process.env.DATABASE_URL)).toString('utf8');
    expect(sql).toContain('CREATE TABLE public."Product"');
    expect(sql).toContain('پلن-بکاپ-تست');
  });

  it('sends the file to super admins only; the daily tick runs once per day and only when enabled', async () => {
    const got: { chat: bigint; name: string; size: number }[] = [];
    setBackupSender(async (chat, file, name) => { got.push({ chat, name, size: file.length }); });
    await prisma.admin.create({ data: { telegramId: 7_000_001n, role: 'SUPER_ADMIN', isActive: true } as any });
    await prisma.admin.create({ data: { telegramId: 7_000_002n, role: 'SUPPORT_ADMIN', isActive: true } as any });
    const r = await sendBackupNow('test');
    expect(r.sent).toBeGreaterThanOrEqual(1);
    expect(got.every((g) => g.chat !== 7_000_002n)).toBe(true);
    expect(got.some((g) => g.chat === 7_000_001n && g.name.endsWith('.sql.gz') && g.size > 200)).toBe(true);

    got.length = 0;
    await runBackupTick(); // disabled by default
    expect(got).toHaveLength(0);
    await setSetting('backup.telegram', 'true'); await setSetting('backup.hour', '0');
    await runBackupTick(); await runBackupTick();
    expect(got.length).toBeGreaterThanOrEqual(1);
    const once = got.length;
    await runBackupTick();
    expect(got.length).toBe(once); // not again the same day
    expect(await getSetting('backup.lastDay')).not.toBe('');
  });
});
