import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
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
    const list = execFileSync('tar', ['-tzf', b.file]).toString();
    b.cleanup();
    expect(list).toContain('./hello.ts');
    expect(list).toContain('data-backup/game.db');
    expect(list).toContain('data-backup/uploads/a.png');
    expect(list).toContain('data-backup/game.json');
    expect(list).toContain('./node_modules/big.js');
    expect(list).not.toContain('./data/');
  });
});
