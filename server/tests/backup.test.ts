import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeBackup } from '../src/backup';
import { openDb } from '../src/db';

describe('backup', () => {
  it('contains everything: code, node_modules, db snapshot, uploads and settings', async () => {
    const root = mkdtempSync(join(tmpdir(), 'bk-'));
    const code = join(root, 'app'), data = join(code, 'data');
    mkdirSync(join(code, 'node_modules'), { recursive: true });
    mkdirSync(join(data, 'uploads'), { recursive: true });
    writeFileSync(join(code, 'hello.ts'), 'x'); writeFileSync(join(code, 'node_modules', 'big.js'), 'y');
    writeFileSync(join(data, 'uploads', 'a.png'), 'img'); writeFileSync(join(data, 'game.json'), '{}');
    const db = openDb(join(data, 'game.db'));
    db.prepare('INSERT INTO users (tg_id, name, avatar, created_at) VALUES (1, ?, null, 0)').run('علی');
    const b = await makeBackup({ db, dataDir: data, codeDir: code });
    expect(b.files).toHaveLength(1);
    const list = execFileSync('tar', ['-tzf', b.files[0].file]).toString();
    b.cleanup();
    expect(list).toContain('code/hello.ts');
    expect(list).toContain('data/game.db');
    expect(list).toContain('data/uploads/a.png');
    expect(list).toContain('data/game.json');
    expect(list).toContain('code/node_modules/big.js');
    expect(list).toContain('README-RESTORE.txt');
    expect(list).not.toContain('code/data/');
  });

  it('splits an oversized backup into parts that join back into one valid archive (nothing dropped)', async () => {
    const root = mkdtempSync(join(tmpdir(), 'bk-'));
    const code = join(root, 'app'), data = join(code, 'data');
    mkdirSync(data, { recursive: true });
    writeFileSync(join(code, 'noise.bin'), randomBytes(300_000)); // فشرده نمی‌شود
    const db = openDb(join(data, 'game.db'));
    const b = await makeBackup({ db, dataDir: data, codeDir: code, partBytes: 100_000 });
    expect(b.files.length).toBeGreaterThan(2);
    expect(b.files.every((f) => statSync(f.file).size <= 100_000)).toBe(true);
    const joined = join(root, 'joined.tar.gz');
    writeFileSync(joined, Buffer.concat(b.files.map((f) => readFileSync(f.file))));
    const list = execFileSync('tar', ['-tzf', joined]).toString();
    b.cleanup();
    expect(list).toContain('code/noise.bin');
    expect(list).toContain('data/game.db');
  });
});
