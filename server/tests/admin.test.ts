import { createHmac } from 'node:crypto';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig, validateConfig } from '../src/config';
import { openDb } from '../src/db';
import { createGameServer } from '../src/server';

const TOKEN = '123:ADMIN-TEST';
const sign = (id: number) => {
  const f: Record<string, string> = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: 'U' + id }) };
  const check = Object.entries(f).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const hash = createHmac('sha256', createHmac('sha256', 'WebAppData').update(TOKEN).digest()).update(check).digest('hex');
  return new URLSearchParams({ ...f, hash }).toString();
};
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);

let srv: ReturnType<typeof createGameServer>;
let base = '';
let saved: any = null;
const dataDir = mkdtempSync(join(tmpdir(), 'miras-'));
beforeAll(async () => {
  srv = createGameServer({ db: openDb(), cfg: loadConfig(), auth: { botToken: TOKEN, devAuth: false }, adminIds: [42], dataDir, saveCfg: (c) => { saved = c; } });
  await new Promise<void>((r) => srv.http.listen(0, r));
  base = `http://127.0.0.1:${(srv.http.address() as AddressInfo).port}`;
});
afterAll(() => srv.close());

const call = (id: number, path: string, body?: object | Buffer, ct = 'application/json') =>
  fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'x-init-data': sign(id), 'content-type': ct }, body: body instanceof Buffer ? new Uint8Array(body) : body && JSON.stringify(body) });

describe('admin', () => {
  it('non-admin is forbidden, admin is allowed', async () => {
    expect((await call(43, '/api/admin/overview')).status).toBe(403);
    expect((await call(43, '/api/admin/config')).status).toBe(403);
    expect((await call(42, '/api/admin/overview')).status).toBe(200);
    const me = await (await call(42, '/api/me')).json() as any;
    expect(me.profile.isAdmin).toBe(true);
  });

  it('edits a card live, persists it, and rejects bad data', async () => {
    const cfg = await (await call(42, '/api/admin/config')).json() as any;
    const card = { ...cfg.cards[0], hp: 777, name: 'سرباز قوی' };
    expect((await call(42, '/api/admin/card', { card })).status).toBe(200);
    expect(saved.cards[0].hp).toBe(777);
    expect((await (await fetch(base + '/api/config')).json() as any).cards[0].hp).toBe(777);
    expect((await call(42, '/api/admin/card', { card: { ...card, hp: -5 } })).status).toBe(400);
    expect((await call(42, '/api/admin/card', { card: { ...card, id: 'Bad Id' } })).status).toBe(400);
    expect((await call(42, '/api/admin/card', { card: { ...card, ability: { id: 'nope' } } })).status).toBe(400);
  });

  it('adds a card, uploads an image, rejects fake images, removes the image', async () => {
    const card = { id: 'ninja', name: 'نینجا', rarity: 'rare', hp: 90, atk: 22, shield: 0 };
    expect((await call(42, '/api/admin/card', { card })).status).toBe(200);
    expect((await call(42, '/api/admin/card-image?cardId=ninja', Buffer.from('<svg onload=alert(1)>'), 'image/png')).status).toBe(400);
    const r = await call(42, '/api/admin/card-image?cardId=ninja', PNG, 'image/png');
    expect(r.status).toBe(200);
    const url = ((await r.json()) as any).cards.find((c: any) => c.id === 'ninja').image as string;
    expect(url).toMatch(/^\/uploads\/cards\/ninja\.png\?v=\d+$/);
    const img = await fetch(base + url.split('?')[0]);
    expect(img.status).toBe(200);
    expect(img.headers.get('content-type')).toBe('image/png');
    expect((await fetch(base + '/uploads/cards/..%2f..%2fetc%2fpasswd')).status).toBe(404);
    expect((await call(43, '/api/admin/card-image?cardId=ninja', PNG, 'image/png')).status).toBe(403);
    await call(42, '/api/admin/card-image/delete', { cardId: 'ninja' });
    expect(existsSync(join(dataDir, 'uploads', 'cards', 'ninja.png'))).toBe(false);
  });

  it('cannot delete a card players own; can delete an unowned one', async () => {
    await call(42, '/api/me'); // کاربر ۴۲ دک اولیه را دارد
    expect((await call(42, '/api/admin/card/delete', { id: 'soldier' })).status).toBe(400);
    expect((await call(42, '/api/admin/card/delete', { id: 'ninja' })).status).toBe(200);
  });

  it('gift, search and ban work; banned users are locked out', async () => {
    await call(44, '/api/me');
    const users = ((await (await call(42, '/api/admin/users?q=U44')).json()) as any).users;
    expect(users).toHaveLength(1);
    const id = users[0].id;
    expect((await call(42, '/api/admin/gift', { userId: id, coins: 500, cardId: 'phoenix' })).status).toBe(200);
    const prof = (await (await call(44, '/api/me')).json() as any).profile;
    expect(prof.coins).toBe(600);
    expect(prof.cards.find((c: any) => c.id === 'phoenix')).toBeTruthy();
    await call(42, '/api/admin/ban', { userId: id, banned: true });
    expect((await call(44, '/api/me')).status).toBe(403);
  });
});

describe('validateConfig', () => {
  it('rejects chances above 100% and wrong upgrade table length', () => {
    const c = loadConfig();
    expect(() => validateConfig({ ...c, box: { ...c.box, cardChance: { common: 0.6, rare: 0.3, epic: 0.2 } } })).toThrow(/۱۰۰/);
    expect(() => validateConfig({ ...c, upgrade: { ...c.upgrade, maxLevel: 9 } })).toThrow(/جدول ارتقا/);
  });
});

describe('banner', () => {
  it('uploads, serves and deletes the home banner; rejects fake images and non-admins', async () => {
    expect((await call(42, '/api/admin/banner', Buffer.from('not an image'), 'image/png')).status).toBe(400);
    expect((await call(43, '/api/admin/banner', PNG, 'image/png')).status).toBe(403);
    const r = await call(42, '/api/admin/banner', PNG, 'image/png');
    expect(r.status).toBe(200);
    const url = ((await r.json()) as any).ui.banner as string;
    expect(url).toMatch(/^\/uploads\/banner\.png\?v=\d+$/);
    expect(((await (await fetch(base + '/api/config')).json()) as any).ui.banner).toBe(url);
    const img = await fetch(base + url.split('?')[0]);
    expect(img.status).toBe(200);
    expect(img.headers.get('content-type')).toBe('image/png');
    await call(42, '/api/admin/banner/delete', {});
    expect((await fetch(base + url.split('?')[0])).status).toBe(404);
    expect(((await (await fetch(base + '/api/config')).json()) as any).ui?.banner).toBeUndefined();
  });
});

describe('config override (survives code updates)', () => {
  it('uses the saved admin config, fills new keys from the base, and migrates the old solo shape', async () => {
    const { writeFileSync } = await import('node:fs');
    const { loadConfigWithOverride } = await import('../src/config');
    const base = loadConfig();
    const file = join(dataDir, 'override.json');
    // ساختار قدیمی: بدون pits و بدون fees، با یک کارت ویرایش‌شده
    const old: any = JSON.parse(JSON.stringify(base));
    delete old.fees; old.solo = { stages: [] }; old.cards[0].hp = 321;
    writeFileSync(file, JSON.stringify(old));
    const merged = loadConfigWithOverride(file);
    expect(merged.cards[0].hp).toBe(321);       // ویرایش ادمین حفظ شد
    expect(merged.fees).toEqual(base.fees);      // کلید جدید از پایه
    expect(merged.solo.pits).toHaveLength(3);    // گودال‌ها از پایه
    writeFileSync(file, '{ not json');
    expect(loadConfigWithOverride(file).cards[0].hp).toBe(base.cards[0].hp); // فایل خراب → پایه
    expect(loadConfigWithOverride(join(dataDir, 'nope.json')).cards[0].hp).toBe(base.cards[0].hp);
  });
});
