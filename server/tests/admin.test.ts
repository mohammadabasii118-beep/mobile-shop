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
    expect((await call(42, '/api/admin/card', { card: { ...card, abilities: [{ id: 'nope' }] } })).status).toBe(400);
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
    expect((await call(42, '/api/admin/card/delete', { id: 'giv' })).status).toBe(400);
    expect((await call(42, '/api/admin/card/delete', { id: 'ninja' })).status).toBe(200);
  });

  it('gift, search and ban work; banned users are locked out', async () => {
    await call(44, '/api/me');
    const users = ((await (await call(42, '/api/admin/users?q=U44')).json()) as any).users;
    expect(users).toHaveLength(1);
    const id = users[0].id;
    expect((await call(42, '/api/admin/gift', { userId: id, coins: 500, cardId: 'sohrab' })).status).toBe(200);
    const prof = (await (await call(44, '/api/me')).json() as any).profile;
    expect(prof.coins).toBe(600);
    expect(prof.cards.find((c: any) => c.id === 'sohrab')).toBeTruthy();
    await call(42, '/api/admin/ban', { userId: id, banned: true });
    expect((await call(44, '/api/me')).status).toBe(403);
  });
});

describe('player management', () => {
  it('returns full player details and manages coins (add, subtract, set, clamp, validate)', async () => {
    await call(60, '/api/me');
    const id = (((await (await call(42, '/api/admin/users?q=U60')).json()) as any).users[0]).id as number;
    expect((await call(43, `/api/admin/user?id=${id}`)).status).toBe(403);
    const d = ((await (await call(42, `/api/admin/user?id=${id}`)).json()) as any).user;
    expect(d).toMatchObject({ tgId: 60, coins: 100, banned: false, level: 1 });
    expect(d.cards).toHaveLength(3);
    const coins = async (b: object) => ((await (await call(42, '/api/admin/coins', { userId: id, ...b })).json()) as any);
    expect((await coins({ delta: 50 })).user.coins).toBe(150);
    expect((await coins({ delta: -30 })).user.coins).toBe(120);
    expect((await coins({ delta: -99999 })).user.coins).toBe(0);   // هیچ‌وقت منفی نمی‌شود
    expect((await coins({ set: 777 })).user.coins).toBe(777);
    // الماس سرخ: همه ۵۰ شروع می‌کنند؛ کم/زیاد و تنظیم دقیق؛ هیچ‌وقت منفی نمی‌شود
    const gems = async (b: object) => (await (await call(42, '/api/admin/balance', { userId: id, currency: 'gems', ...b })).json() as any);
    expect((await gems({ delta: 25 })).user.gems).toBe(75);
    expect((await gems({ delta: -99999 })).user.gems).toBe(0);
    expect((await gems({ set: 50 })).user.gems).toBe(50);
    expect((await call(42, '/api/admin/balance', { userId: id, currency: 'gems', delta: 0.5 })).status).toBe(400);
    expect((await call(42, '/api/admin/balance', { userId: id, currency: 'hack', delta: 5 })).status).toBe(400);
    expect((await call(43, '/api/admin/balance', { userId: id, currency: 'gems', delta: 5 })).status).toBe(403);
    expect((await call(42, '/api/admin/coins', { userId: id, delta: 1.5 })).status).toBe(400);
    expect((await call(42, '/api/admin/coins', { userId: id, set: -1 })).status).toBe(400);
    expect((await call(42, '/api/admin/coins', { userId: id, delta: 'abc' })).status).toBe(400);
    expect((await call(43, '/api/admin/coins', { userId: id, delta: 5 })).status).toBe(403);
    expect((await call(42, '/api/admin/user?id=99999')).status).toBe(400);
    const list = ((await (await call(42, '/api/admin/users?q=U60')).json()) as any).users[0];
    expect(list).toHaveProperty('avatar');
  });
});

describe('validateConfig', () => {
  it('rejects chances above 100% and wrong upgrade table length', () => {
    const c = loadConfig();
    expect(() => validateConfig({ ...c, box: { ...c.box, types: { ...c.box.types, gold: { ...c.box.types.gold, contents: { ...c.box.types.gold.contents, solo: { ...c.box.types.gold.contents.solo, cardChance: { common: 0.6, rare: 0.3, epic: 0.2 } } } } } } })).toThrow(/۱۰۰/);
    expect(() => validateConfig({ ...c, box: { ...c.box, drops: { ...c.box.drops, solo: { bronze: 60, silver: 30, gold: 20 } } } })).toThrow(/۱۰۰/);
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

describe('shop admin', () => {
  it('payment methods: card details validated, stars optional, orders listed/delivered once', async () => {
    const pub = await (await fetch(base + '/api/config')).json() as any;
    expect(pub.shop.cards).toHaveLength(6);
    const withCard = (card: object) => ({ ...pub, channel: { ...pub.channel, required: false }, shop: { ...pub.shop, card } });
    // کارت فعال بدون شماره‌ی درست رد می‌شود
    expect((await call(42, '/api/admin/config', { config: withCard({ enabled: true, number: '12', holder: 'x', bank: 'y' }) })).status).toBe(400);
    expect((await call(43, '/api/admin/config', { config: withCard({ enabled: true, number: '6037 9912 3456 7890', holder: 'x', bank: 'y' }) })).status).toBe(403);
    expect((await call(42, '/api/admin/config', { config: withCard({ enabled: true, number: '6037 9912 3456 7890', holder: 'علی رضایی', bank: 'ملی' }) })).status).toBe(200);
    // اسلات با کارت ناشناخته یا بدون قیمت یا با ارز نامعتبر، و بسته‌ی بدون هیچ قیمتی رد می‌شود
    const bad1 = JSON.parse(JSON.stringify(pub)); bad1.shop.cards[0].cardId = 'nope';
    expect((await call(42, '/api/admin/config', { config: bad1 })).status).toBe(400);
    const bad2 = JSON.parse(JSON.stringify(pub)); bad2.shop.cards[0].price = 0;
    expect((await call(42, '/api/admin/config', { config: bad2 })).status).toBe(400);
    const bad4 = JSON.parse(JSON.stringify(pub)); bad4.shop.cards[0].currency = 'rial';
    expect((await call(42, '/api/admin/config', { config: bad4 })).status).toBe(400);
    const bad3 = JSON.parse(JSON.stringify(pub)); bad3.shop.gemPacks[0].toman = 0; bad3.shop.gemPacks[0].stars = 0;
    expect((await call(42, '/api/admin/config', { config: bad3 })).status).toBe(400);
    // سفارش کارت‌به‌کارت: مشخصات کارت برمی‌گردد، یادداشت پیگیری، تحویل فقط یک‌بار
    const me = await (await call(45, '/api/me')).json() as any;
    expect((await call(45, '/api/shop/order', { id: pub.shop.gemPacks[0].id })).status).toBe(400);   // بدون کد پیگیری ثبت نمی‌شود
    expect(((await (await call(42, '/api/admin/orders')).json()) as any).orders.filter((o: any) => o.tgId === 45)).toHaveLength(0);
    const ord = await (await call(45, '/api/shop/order', { id: pub.shop.gemPacks[0].id, note: 'پیگیری ۱۲۳۴' })).json() as any;
    const list = await (await call(42, '/api/admin/orders?status=pending')).json() as any;
    expect(list.orders.find((o: any) => o.id === ord.order.id)).toMatchObject({ name: me.profile.name, status: 'pending', note: 'پیگیری ۱۲۳۴', method: 'card' });
    expect((await call(43, '/api/admin/order', { id: ord.order.id, action: 'deliver' })).status).toBe(403);
    expect((await call(42, '/api/admin/order', { id: ord.order.id, action: 'deliver' })).status).toBe(200);
    expect((await call(42, '/api/admin/order', { id: ord.order.id, action: 'deliver' })).status).toBe(400);
    const after = await (await call(45, '/api/me')).json() as any;
    expect(after.profile.gems).toBe(me.profile.gems + pub.shop.gemPacks[0].gems);
  });
});

describe('config override (survives code updates)', () => {
  it('migrates single-table box contents into solo and online tables and adds the speedup setting', async () => {
    const { writeFileSync } = await import('node:fs');
    const { loadConfigWithOverride } = await import('../src/config');
    const base = loadConfig();
    const file = join(dataDir, 'override-box.json');
    const old: any = JSON.parse(JSON.stringify(base));
    for (const t of Object.values(old.box.types) as any[]) { t.coins = [5, 6]; t.cardCountRange = [1, 2]; t.cardChance = { common: 0.5, rare: 0.1, epic: 0.01 }; delete t.contents; }
    delete old.box.speedup;
    writeFileSync(file, JSON.stringify(old));
    const m = loadConfigWithOverride(file);
    expect(m.box.types.bronze.contents.solo).toEqual({ coins: [5, 6], cardCountRange: [1, 2], cardChance: { common: 0.5, rare: 0.1, epic: 0.01 } });
    expect(m.box.types.gold.contents.multi.coins).toEqual([5, 6]);
    expect(m.box.speedup).toEqual(base.box.speedup);
  });

  it('migrates the old two-price shop shape to one currency and one price', async () => {
    const { writeFileSync } = await import('node:fs');
    const { loadConfigWithOverride } = await import('../src/config');
    const base = loadConfig();
    const file = join(dataDir, 'override-shop.json');
    const old: any = JSON.parse(JSON.stringify(base));
    old.shop.cards = old.shop.cards.map((o: any, i: number) => ({ cardId: o.cardId, count: o.count, priceGems: i === 0 ? 7 : 0, priceCoins: 123 }));
    old.shop.coinPacks = [{ id: 'c1', coins: 900, gems: 15 }];
    writeFileSync(file, JSON.stringify(old));
    const m = loadConfigWithOverride(file);
    expect(m.shop.cards[0]).toMatchObject({ currency: 'gems', price: 7 });      // الماس اگر بود
    expect(m.shop.cards[1]).toMatchObject({ currency: 'coins', price: 123 });   // وگرنه سکه
    expect(m.shop.coinPacks[0]).toEqual({ id: 'c1', coins: 900, currency: 'gems', price: 15 });
  });

  it('migrates old saved settings: box xp removed, upgrade xp and online rewards filled from base', async () => {
    const { writeFileSync } = await import('node:fs');
    const { loadConfigWithOverride } = await import('../src/config');
    const base = loadConfig();
    const file = join(dataDir, 'override-xp.json');
    const old: any = JSON.parse(JSON.stringify(base));
    delete old.online;
    for (const t of Object.values(old.box.types) as any[]) t.xp = [30, 60];
    for (const rows of Object.values(old.upgrade.byRarity) as any[][]) for (const r of rows) delete r.xp;
    old.upgrade.byRarity.rare[0].copies = 30; // تغییر ادمین حفظ می‌شود
    writeFileSync(file, JSON.stringify(old));
    const m = loadConfigWithOverride(file);
    expect(m.online).toEqual(base.online);
    expect((m.box.types.bronze as any).xp).toBeUndefined();
    expect(m.upgrade.byRarity.rare[0]).toMatchObject({ copies: 30, xp: base.upgrade.byRarity.rare[0].xp });
  });

  it('replaces cards, starting deck and solo when the saved content is from an older contentVersion', async () => {
    const { writeFileSync } = await import('node:fs');
    const { loadConfigWithOverride } = await import('../src/config');
    const base = loadConfig();
    const file = join(dataDir, 'override-old.json');
    const old: any = JSON.parse(JSON.stringify(base));
    delete old.contentVersion;
    old.cards = [{ id: 'soldier', name: 'سرباز', rarity: 'common', hp: 110, atk: 18, shield: 10 }, ...base.cards.slice(1).map((c) => ({ ...c, id: 'old_' + c.id }))];
    old.cards.push({ ...base.cards[0], image: '/uploads/cards/giv.png' });
    old.startingDeck = ['soldier', 'old_bijan', 'old_arash'];
    writeFileSync(file, JSON.stringify(old));
    const merged = loadConfigWithOverride(file);
    expect(merged.cards.map((c) => c.id)).toEqual(base.cards.map((c) => c.id));
    expect(merged.startingDeck).toEqual(['giv', 'bijan', 'arash']);
    expect(merged.cards[0].image).toBe('/uploads/cards/giv.png'); // عکس کارت هم‌شناسه حفظ می‌شود
    expect(merged.contentVersion).toBe(base.contentVersion);
  });

  it('rev migration: old saved config gets 15s turns, 5-card decks, new solo stages and chargeAttacks (admin card edits kept)', async () => {
    const { writeFileSync } = await import('node:fs');
    const { loadConfigWithOverride } = await import('../src/config');
    const base = loadConfig();
    const file = join(dataDir, 'override-rev.json');
    const old: any = JSON.parse(JSON.stringify(base));
    delete old.rev; delete old.deckSize; old.turnSeconds = 10; old.cards[0].hp = 321;
    old.cards.forEach((c: any) => { delete c.chargeAttacks; });
    old.solo.pits[0].stages[0].deck = [['giv', 1], ['bijan', 1], ['arash', 1]];
    writeFileSync(file, JSON.stringify(old));
    const m = loadConfigWithOverride(file);
    expect(m.turnSeconds).toBe(15);
    expect(m.deckSize).toBe(5);
    expect(m.rev).toBe(2);
    expect(m.cards[0].hp).toBe(321);
    expect(m.cards.find((c) => c.id === 'sohrab')!.chargeAttacks).toBe(4);
    expect(m.solo.pits[2].stages[0].deck).toHaveLength(5);
    // بعد از مهاجرت، تغییر ادمین دیگر برنمی‌گردد
    m.turnSeconds = 20; writeFileSync(file, JSON.stringify(m));
    expect(loadConfigWithOverride(file).turnSeconds).toBe(20);
  });

  it('validateConfig rejects bad chargeAttacks and deckSize', () => {
    const c: any = JSON.parse(JSON.stringify(loadConfig()));
    c.cards[0].chargeAttacks = -1;
    expect(() => validateConfig(c)).toThrow(/قدرت ویژه/);
    c.cards[0].chargeAttacks = 3; c.deckSize = 7;
    expect(() => validateConfig(c)).toThrow(/۳ و ۵/);
  });

  it('uses the saved admin config, fills new keys from the base, and migrates the old solo shape', async () => {
    const { writeFileSync } = await import('node:fs');
    const { loadConfigWithOverride } = await import('../src/config');
    const base = loadConfig();
    const file = join(dataDir, 'override.json');
    // ساختار قدیمی: بدون pits و بدون fees، با یک کارت ویرایش‌شده
    const old: any = JSON.parse(JSON.stringify(base));
    delete old.fees; old.solo = { stages: [] }; old.cards[0].hp = 321;
    old.box = { ...old.box, drops: { soloByPit: ['bronze'], multiChance: { bronze: 7, silver: 2, gold: 1 } } }; // شکل قدیمی
    old.upgrade = { maxLevel: base.upgrade.maxLevel, levels: base.upgrade.byRarity.common }; // جدول ارتقای قدیمی (یکی برای همه)
    writeFileSync(file, JSON.stringify(old));
    const merged = loadConfigWithOverride(file);
    expect(merged.cards[0].hp).toBe(321);       // ویرایش ادمین حفظ شد
    expect(merged.fees).toEqual(base.fees);      // کلید جدید از پایه
    expect(merged.solo.pits).toHaveLength(3);    // گودال‌ها از پایه
    expect(merged.box.drops.multi).toEqual({ bronze: 70, silver: 20, gold: 10 }); // وزن‌های قدیمی به درصد
    expect(merged.box.drops.solo).toEqual(base.box.drops.solo);
    expect(merged.upgrade.byRarity.epic).toEqual(base.upgrade.byRarity.common); // جدول قدیمی برای هر سه نوع
    writeFileSync(file, '{ not json');
    expect(loadConfigWithOverride(file).cards[0].hp).toBe(base.cards[0].hp); // فایل خراب → پایه
    expect(loadConfigWithOverride(join(dataDir, 'nope.json')).cards[0].hp).toBe(base.cards[0].hp);
  });
});
