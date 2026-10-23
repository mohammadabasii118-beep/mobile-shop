import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { openDb } from '../src/db';
import { boxSpeedupCost, resolveCard } from '@game/shared';
import { Game, GameError } from '../src/game';

const cfg = loadConfig();
let t = 1_000_000;
let rngVal = 0.5;
let game: Game;
let uid: number;
beforeEach(() => {
  t = 1_000_000;
  rngVal = 0.5;
  game = new Game({ db: openDb(), cfg, now: () => t, rng: () => rngVal });
  uid = game.upsertUser({ tgId: 1, name: 'T', avatar: null });
});

describe('game economy', () => {
  it('new player starts with 5 cards and that deck', () => {
    const p = game.profile(uid);
    expect(p.deck).toEqual(cfg.startingDeck);
    expect(p.cards).toHaveLength(5);
    expect(p.level).toBe(1);
  });

  it('deck must be 3 distinct owned cards', () => {
    expect(() => game.setDeck(uid, ['giv', 'giv', 'bijan'])).toThrow(GameError);
    expect(() => game.setDeck(uid, ['giv', 'bijan', 'sohrab'])).toThrow(GameError);
    game.setDeck(uid, ['arash', 'bijan', 'giv']);
    expect(game.profile(uid).deck).toEqual(['arash', 'bijan', 'giv']);
  });

  it('box: 4 slots, one opening at a time, server timer', () => {
    for (let i = 0; i < 4; i++) expect(game.grantBox(uid).box).toBe(i);
    expect(game.grantBox(uid)).toEqual({ box: null, type: null, noSlot: true });
    game.startBox(uid, 0);
    expect(() => game.startBox(uid, 1)).toThrow(GameError);
    expect(() => game.openBox(uid, 0)).toThrow(/زمانش/);
    t += cfg.box.types.bronze.durationSeconds * 1000 - 1;
    expect(() => game.openBox(uid, 0)).toThrow(GameError);
    t += 1;
    const r = game.openBox(uid, 0);
    expect(r.coins).toBeGreaterThanOrEqual(cfg.box.types.bronze.contents.multi.coins[0]);
    expect(game.profile(uid).boxes).toHaveLength(3);
    game.startBox(uid, 1); // حالا می‌شه یکی دیگه شروع کرد
  });

  it('box rewards: coins, xp, level-up, card chance', () => {
    game.grantBox(uid);
    game.startBox(uid, 0);
    t += cfg.box.types.bronze.durationSeconds * 1000;
    rngVal = 0.0; // epic roll, max... min coins
    const r = game.openBox(uid, 0);
    expect(r.cards).toHaveLength(1);
    expect(cfg.cards.find((c) => c.id === r.cards[0].id)!.rarity).toBe('epic');
    const p = game.profile(uid);
    expect(p.coins).toBe(100 + cfg.box.types.bronze.contents.multi.coins[0]);
    expect(p.xp).toBe(0); // جعبه دیگر XP نمی‌دهد
    expect(game.addXp(uid, 100000)).toBeGreaterThan(1);
  });

  it('box contents differ by source: a box won in solo (dungeon) uses the solo table, online uses the online table', () => {
    const custom = JSON.parse(JSON.stringify(cfg));
    custom.box.types.bronze.contents.solo.coins = [11, 11];
    custom.box.types.bronze.contents.multi.coins = [77, 77];
    const g2 = new Game({ db: openDb(), cfg: custom, now: () => t, rng: () => rngVal });
    const u = g2.upsertUser({ tgId: 31, name: 'S', avatar: null });
    g2.grantBox(u, 'bronze', 'solo'); g2.grantBox(u, 'bronze', 'multi');
    expect(g2.profile(u).boxes.map((b) => b.source)).toEqual(['solo', 'multi']);
    g2.startBox(u, 0); t += custom.box.types.bronze.durationSeconds * 1000;
    expect(g2.openBox(u, 0).coins).toBe(11);
    g2.startBox(u, 1); t += custom.box.types.bronze.durationSeconds * 1000;
    expect(g2.openBox(u, 1).coins).toBe(77);
  });

  it('gems open a box instantly: 2 gems per started 10 minutes remaining (12 min = 4, 25 min = 6, 60 min = 12)', () => {
    expect([boxSpeedupCost(1, cfg.box.speedup), boxSpeedupCost(10 * 60_000, cfg.box.speedup), boxSpeedupCost(12 * 60_000, cfg.box.speedup),
      boxSpeedupCost(20 * 60_000, cfg.box.speedup), boxSpeedupCost(25 * 60_000, cfg.box.speedup), boxSpeedupCost(60 * 60_000, cfg.box.speedup), boxSpeedupCost(0, cfg.box.speedup)]).toEqual([2, 2, 4, 4, 6, 12, 0]);
    game.grantBox(uid, 'bronze');
    expect(() => game.speedupBox(uid, 0)).toThrow(/در حال باز شدن نیست/);       // هنوز شروع نشده
    game.startBox(uid, 0);
    const total = cfg.box.types.bronze.durationSeconds * 1000;
    t += total - 25 * 60_000;                                                    // ۲۵ دقیقه مانده
    const db = (game as any).d.db;
    db.prepare('UPDATE users SET gems = 5').run();
    expect(() => game.speedupBox(uid, 0)).toThrow(/الماس کافی/);                 // ۶ لازم، ۵ دارد
    expect(game.profile(uid).gems).toBe(5);
    db.prepare('UPDATE users SET gems = 10').run();
    expect(game.speedupBox(uid, 0)).toEqual({ cost: 6 });
    expect(game.profile(uid).gems).toBe(4);
    expect(game.profile(uid).boxes[0].state).toBe('ready');
    expect(() => game.speedupBox(uid, 0)).toThrow(/آماده/);
    expect(game.openBox(uid, 0).type).toBe('bronze');
  });

  it('three box types: own timer and own contents; winners get the box type of the pit / by chance', () => {
    // نوع جعبه، مدت و محتوای خودش را دارد
    game.grantBox(uid, 'gold');
    const gold = cfg.box.types.gold;
    expect(game.profile(uid).boxes[0]).toMatchObject({ type: 'gold', totalMs: gold.durationSeconds * 1000 });
    game.startBox(uid, 0);
    t += gold.durationSeconds * 1000 - 1;
    expect(() => game.openBox(uid, 0)).toThrow(GameError);
    t += 1;
    rngVal = 0.5;
    const r = game.openBox(uid, 0);
    expect(r.type).toBe('gold');
    expect(r.coins).toBeGreaterThanOrEqual(gold.contents.multi.coins[0]);
    expect(r.coins).toBeLessThanOrEqual(gold.contents.multi.coins[1]);
    expect(r.cards.length).toBeGreaterThanOrEqual(gold.contents.multi.cardCountRange[0]);
    // شانس جعبه‌ی جایزه با هر برد (سولو/آنلاین جدا): پیش‌فرض ۷۰ برنزی، ۲۵ نقره‌ای، ۵ طلایی
    rngVal = 0.0; expect(game.rewardBoxType('solo')).toBe('bronze');
    rngVal = 0.8; expect(game.rewardBoxType('solo')).toBe('silver');
    rngVal = 0.999; expect(game.rewardBoxType('solo')).toBe('gold');
    rngVal = 0.8; expect(game.rewardBoxType('multi')).toBe('silver');
  });

  it('box drop chances are set per mode and may leave room for "no box"', () => {
    const custom = { ...cfg, box: { ...cfg.box, drops: { solo: { bronze: 10, silver: 0, gold: 0 }, multi: { bronze: 0, silver: 0, gold: 100 } } } };
    const g2 = new Game({ db: openDb(), cfg: custom, now: () => t, rng: () => rngVal });
    const id = g2.upsertUser({ tgId: 7, name: 'X', avatar: null });
    rngVal = 0.05; expect(g2.rewardBoxType('solo')).toBe('bronze');
    rngVal = 0.5; expect(g2.rewardBoxType('solo')).toBeNull();           // ۹۰٪ بدون جعبه
    rngVal = 0.0; expect(g2.rewardBoxType('multi')).toBe('gold');
    rngVal = 0.999; expect(g2.rewardBoxType('multi')).toBe('gold');
    // برد بدون جعبه: چیزی ساخته نمی‌شود و «اسلات پر» هم نیست
    rngVal = 0.5;
    expect(g2.recordResult(id, true, 'solo', 0)).toEqual({ box: null, type: null, noSlot: false });
    expect(g2.profile(id).boxes).toHaveLength(0);
    rngVal = 0.05;
    expect(g2.recordResult(id, true, 'solo', 1)).toMatchObject({ box: 0, type: 'bronze' });
    expect(g2.recordResult(id, true, 'multi')).toMatchObject({ type: 'gold' });  // آنلاین
  });

  it('card stats come from the explicit per-level table (no growth formula)', () => {
    const giv = cfg.cards.find((c) => c.id === 'giv')!;
    const custom = { ...giv, levels: [{ hp: 500, atk: 50, shield: 5 }, { hp: 600, atk: 60, shield: 6 }] };
    expect(resolveCard(custom, 1).hp).toBe(giv.hp);
    expect(resolveCard(custom, 2)).toMatchObject({ hp: 500, atk: 50, shield: 5, level: 2 });
    expect(resolveCard(custom, 3).hp).toBe(600);
    expect(resolveCard(custom, 6).hp).toBe(600);          // بعد از آخرین ردیف: آخرین ردیف
    expect(resolveCard({ ...giv, levels: undefined }, 4).hp).toBe(giv.hp); // بدون جدول: بدون رشد
  });

  it('upgrade cost depends on the card type (ساده / معمولی / کمیاب)', () => {
    const db = (game as any).d.db;
    db.prepare("INSERT INTO user_cards (user_id, card_id, copies) VALUES (?, 'gordafarid', 1), (?, 'sohrab', 1)").run(uid, uid);
    db.prepare('UPDATE users SET coins = 150').run();
    // ساده: ۲ کارت و ۵۰ سکه — معمولی: ۲ کارت و ۱۰۰ — کمیاب: ۱ کارت و ۲۰۰
    expect(cfg.upgrade.byRarity.common[0]).toMatchObject({ copies: 2, coins: 50 });
    expect(cfg.upgrade.byRarity.rare[0]).toMatchObject({ copies: 2, coins: 100 });
    expect(cfg.upgrade.byRarity.epic[0]).toMatchObject({ copies: 1, coins: 200 });
    expect(() => game.upgradeCard(uid, 'gordafarid')).toThrow(/تعداد کارت/);   // ۱ از ۲
    expect(() => game.upgradeCard(uid, 'sohrab')).toThrow(/سکه/);         // ۱۵۰ از ۲۰۰
    db.prepare("UPDATE user_cards SET copies = 2 WHERE card_id = 'gordafarid'").run();
    game.upgradeCard(uid, 'gordafarid');
    const p = game.profile(uid);
    expect(p.cards.find((c) => c.id === 'gordafarid')).toMatchObject({ level: 2, copies: 0 });
    expect(p.coins).toBe(50);
  });

  it('upgrade needs duplicates and coins', () => {
    expect(() => game.upgradeCard(uid, 'giv')).toThrow(/تعداد کارت/);
    const db = (game as any).d.db;
    db.prepare('UPDATE user_cards SET copies = 5 WHERE card_id = ?').run('giv');
    db.prepare('UPDATE users SET coins = 10').run();
    expect(() => game.upgradeCard(uid, 'giv')).toThrow(/سکه/);
    db.prepare('UPDATE users SET coins = 500').run();
    game.upgradeCard(uid, 'giv');
    const p = game.profile(uid);
    expect(p.cards.find((c) => c.id === 'giv')).toMatchObject({ level: 2, copies: 3 });
    expect(p.coins).toBe(450);
    expect(game.deckUnits(uid)[0].hp).toBe(189);
  });

  it('only winners get boxes; results are counted', () => {
    expect(game.recordResult(uid, false, 'solo')).toBeNull();
    expect(game.recordResult(uid, true, 'solo', 0)).toEqual({ box: 0, type: 'bronze', noSlot: false });
    const p = game.profile(uid);
    expect([p.wins, p.losses, p.soloStage]).toEqual([1, 1, 1]);
    // تک‌نفره هیچ سکه/XP/کاپی نمی‌دهد
    expect([p.coins, p.xp, p.trophies]).toEqual([100, 0, 0]);
  });

  it('online: win = +10 trophies, +5 xp, +70 coins (plus box chance); loss = -6 trophies, never below 0', () => {
    rngVal = 0.999; // بدون جعبه‌ی بیش‌ازحد: فقط ببینیم سکه/XP/کاپ
    const win = game.recordResult(uid, true, 'multi');
    expect(win).toMatchObject({ coins: 70, xp: 5, trophies: 10 });
    let p = game.profile(uid);
    expect([p.trophies, p.coins, p.xp]).toEqual([10, 170, 5]);
    expect(game.recordResult(uid, false, 'multi')).toMatchObject({ trophies: -6 });
    expect(game.profile(uid).trophies).toBe(4);
    game.recordResult(uid, false, 'multi');
    expect(game.profile(uid).trophies).toBe(0);   // 4 - 6 → 0
    p = game.profile(uid);
    expect([p.wins, p.losses]).toEqual([1, 2]);
  });

  it('upgrading a card gives xp from the upgrade table', () => {
    const db = (game as any).d.db;
    db.prepare('UPDATE user_cards SET copies = 5 WHERE card_id = ?').run('giv');
    db.prepare('UPDATE users SET coins = 500').run();
    const r = game.upgradeCard(uid, 'giv');
    expect(r.xp).toBe(cfg.upgrade.byRarity.common[0].xp);
    expect(game.profile(uid).xp).toBe(cfg.upgrade.byRarity.common[0].xp);
  });

  it('leaderboard is sorted by trophies and marks me', () => {
    const b = game.upsertUser({ tgId: 2, name: 'B', avatar: null });
    const c = game.upsertUser({ tgId: 3, name: 'C', avatar: null });
    (game as any).d.db.prepare('UPDATE users SET trophies = ? WHERE id = ?').run(30, b);
    (game as any).d.db.prepare('UPDATE users SET trophies = ? WHERE id = ?').run(50, c);
    const rows = game.leaderboard(b);
    expect(rows.map((r) => [r.name, r.trophies, r.rank])).toEqual([['C', 50, 1], ['B', 30, 2], ['T', 0, 3]]);
    expect(rows.find((r) => r.me)!.name).toBe('B');
  });

  it('every player starts with 50 red gems', () => {
    expect(game.profile(uid).gems).toBe(50);
  });

  it('new players start with 5 common starter cards', () => {
    const p = game.profile(uid);
    expect(p.cards.map((c) => c.id).sort()).toEqual(['arash', 'bijan', 'giv', 'goodarz', 'tus']);
    expect(p.deck).toEqual(['giv', 'bijan', 'arash', 'goodarz', 'tus']);
    expect(p.cards.every((c) => cfg.cards.find((x) => x.id === c.id)!.rarity === 'common')).toBe(true);
  });

  it('migrateCards removes cards that no longer exist and refills the deck from the starters', () => {
    const db = (game as any).d.db;
    db.prepare("INSERT INTO user_cards (user_id, card_id, copies) VALUES (?, 'old_card', 3)").run(uid);
    db.prepare("UPDATE deck SET card_id = 'old_card' WHERE user_id = ? AND slot = 0").run(uid);
    game.migrateCards();
    const p = game.profile(uid);
    expect(p.cards.some((c) => c.id === 'old_card')).toBe(false);
    expect(p.deck.length).toBeGreaterThanOrEqual(3);
    expect(new Set(p.deck).size).toBe(p.deck.length);
    expect(p.deck.every((id) => p.cards.some((c) => c.id === id))).toBe(true);
  });

  it('deck may have 3 to 5 cards; new cards fill free deck slots automatically', () => {
    const db = (game as any).d.db;
    for (const c of ['kaveh', 'sohrab', 'gordafarid']) db.prepare('INSERT OR IGNORE INTO user_cards (user_id, card_id) VALUES (?,?)').run(uid, c);
    game.setDeck(uid, ['giv', 'bijan', 'arash', 'kaveh', 'sohrab']);
    expect(game.profile(uid).deck).toHaveLength(5);
    expect(game.deckUnits(uid)).toHaveLength(5);
    expect(() => game.setDeck(uid, ['giv', 'bijan', 'arash', 'kaveh', 'sohrab', 'gordafarid'])).toThrow();
    expect(() => game.setDeck(uid, ['giv', 'bijan'])).toThrow();
    game.setDeck(uid, ['giv', 'bijan', 'arash']);
    expect(game.deckUnits(uid)).toHaveLength(3);
  });

  it('player search shows the relation; referral link makes friends (even before the first login)', () => {
    const other = game.upsertUser({ tgId: 777001, name: 'دوست', avatar: null });
    expect(game.searchPlayer(uid, other).relation).toBe('none');
    expect(game.searchPlayer(uid, uid).relation).toBe('self');
    expect(() => game.searchPlayer(uid, 99999)).toThrow();
    game.addFriend(uid, other);
    expect(game.searchPlayer(uid, other).relation).toBe('outgoing');
    expect(game.searchPlayer(other, uid).relation).toBe('incoming');
    // رفرال قبل از اولین ورود: بعد از ساخته شدن کاربر خودکار دوست می‌شوند
    game.refStart(888002, uid);
    const fresh = game.upsertUser({ tgId: 888002, name: 'تازه', avatar: null });
    expect(game.areFriends(uid, fresh)).toBe(true);
    // رفرال برای کاربر موجود: فوری
    game.refStart(777001, uid);
    expect(game.areFriends(uid, other)).toBe(true);
    game.refStart(888003, 424242); // دعوت‌کننده‌ی ناموجود نادیده گرفته می‌شود
    expect(game.friendsState(game.upsertUser({ tgId: 888003, name: 'x', avatar: null })).friends).toHaveLength(0);
  });

  it('old unconfirmed orders (window opened only) are hidden after the update', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ord-'));
    const file = join(dir, 'x.db');
    const db1 = openDb(file);
    db1.prepare('INSERT INTO users (tg_id, name, avatar, created_at) VALUES (1, ?, null, 0)').run('A');
    const ins = db1.prepare("INSERT INTO orders (user_id, pack_id, gems, toman, method, status, note, created_at) VALUES (1, 'g1', 50, 49000, ?, 'pending', ?, 0)");
    ins.run('stars', null); ins.run('card', null); ins.run('card', 'کد ۱۲۳');
    db1.close();
    const g = new Game({ db: openDb(file), cfg, now: () => t, rng: () => rngVal });
    expect(g.adminOrders().map((o) => [o.method, o.note])).toEqual([['card', 'کد ۱۲۳']]);
  });

  describe('shop', () => {
    it('buys a weekly card offer with the single currency set for the slot, once per week, adding the right copies', () => {
      const db = (game as any).d.db;
      db.prepare('UPDATE users SET coins = 1000, gems = 100').run();
      const giv = cfg.shop.cards[0], sohrab = cfg.shop.cards[5];
      expect([giv.currency, sohrab.currency]).toEqual(['coins', 'gems']);
      // کارتی که دارم: count نسخه به تعداد اضافه می‌شود
      expect(game.buyShopCard(uid, 0)).toMatchObject({ cardId: giv.cardId, count: giv.count, isNew: false });
      expect(game.profile(uid).coins).toBe(1000 - giv.price);
      expect(game.profile(uid).gems).toBe(100);                                  // ارز دیگر دست نمی‌خورد
      expect(game.profile(uid).cards.find((c) => c.id === giv.cardId)!.copies).toBe(giv.count);
      expect(() => game.buyShopCard(uid, 0)).toThrow(/این هفته/);                // یک‌بار در هفته
      // کارت جدید با الماس: خودِ کارت + بقیه به‌عنوان تعداد
      expect(game.buyShopCard(uid, 5)).toMatchObject({ cardId: sohrab.cardId, isNew: true });
      expect(game.profile(uid).gems).toBe(100 - sohrab.price);
      expect(game.profile(uid).cards.find((c) => c.id === sohrab.cardId)).toMatchObject({ level: 1, copies: sohrab.count - 1 });
      // فردا هنوز بسته است؛ بعد از یک هفته دوباره می‌شود
      t += 24 * 3600 * 1000;
      expect(game.shopState(uid).bought).toContain(0);
      t += 7 * 24 * 3600 * 1000;
      expect(game.shopState(uid).bought).toEqual([]);
      game.buyShopCard(uid, 0);
      // موجودی کافی نیست
      db.prepare('UPDATE users SET coins = 0, gems = 0').run();
      expect(() => game.buyShopCard(uid, 1)).toThrow(/سکه/);
      expect(() => game.buyShopCard(uid, 5)).toThrow(/الماس/);
      expect(() => game.buyShopCard(uid, 9)).toThrow(GameError);
    });

    it('coin packs: priced in gems (instant) or in toman (card-to-card order, delivered by the admin)', () => {
      (game as any).d.db.prepare('UPDATE users SET gems = 30').run();
      const pk = cfg.shop.coinPacks[0];
      expect(pk.currency).toBe('gems');
      game.buyCoinPack(uid, pk.id);
      const p = game.profile(uid);
      expect([p.gems, p.coins]).toEqual([30 - pk.price, 100 + pk.coins]);
      expect(() => game.buyCoinPack(uid, 'nope')).toThrow(GameError);
      (game as any).d.db.prepare('UPDATE users SET gems = 0').run();
      expect(() => game.buyCoinPack(uid, pk.id)).toThrow(/الماس/);
      // بسته‌ای که با تومان فروخته می‌شود: با الماس نمی‌شود خرید، سفارش کارت‌به‌کارت می‌سازد و تحویلش سکه اضافه می‌کند
      const tomanPack = { id: 'ct', coins: 2000, currency: 'toman' as const, price: 30000 };
      const g = new Game({ db: openDb(), cfg: { ...cfg, shop: { ...cfg.shop, card: { enabled: true, number: '6037991234567890', holder: 'x', bank: 'y' }, coinPacks: [...cfg.shop.coinPacks, tomanPack] } }, now: () => t, rng: () => rngVal });
      const u = g.upsertUser({ tgId: 11, name: 'V', avatar: null });
      expect(() => g.buyCoinPack(u, 'ct')).toThrow(/با الماس فروخته/);
      const o = g.createOrder(u, 'ct', 'card', 'کد ۱');
      expect(o).toMatchObject({ coins: 2000, gems: 0, toman: 30000 });
      expect(() => g.createOrder(u, 'ct', 'stars')).toThrow(/استار/);
      g.adminOrderAction(o.id, 'deliver');
      expect(g.profile(u)).toMatchObject({ coins: 100 + 2000, gems: 50 });
      expect(g.adminOrders()[0]).toMatchObject({ coins: 2000, gems: 0 });
    });

    it('card-to-card orders: pending with a note until the admin delivers (once), cap of 5 pending', () => {
      const g = new Game({ db: openDb(), cfg: { ...cfg, shop: { ...cfg.shop, card: { enabled: true, number: '6037991234567890', holder: 'علی', bank: 'ملی' } } }, now: () => t, rng: () => rngVal });
      const u = g.upsertUser({ tgId: 9, name: 'U', avatar: null });
      const pk = cfg.shop.gemPacks[0];
      expect(g.adminOrders()).toHaveLength(0);                             // باز کردن پنجره‌ی خرید چیزی نمی‌سازد
      expect(() => g.createOrder(u, pk.id, 'card', '   ')).toThrow(GameError);   // بدون کد پیگیری ثبت نمی‌شود
      expect(g.adminOrders()).toHaveLength(0);
      const o = g.createOrder(u, pk.id, 'card', '۱۲۳۴۵۶ <b>');             // «پرداخت کردم» + کد پیگیری
      expect(o).toMatchObject({ gems: pk.gems, toman: pk.toman, stars: 0 });
      expect(g.profile(u).gems).toBe(50);                                  // هنوز چیزی اضافه نشده
      expect(g.adminOrders()[0]).toMatchObject({ id: o.id, status: 'pending', tgId: 9, method: 'card', note: '۱۲۳۴۵۶ b' });
      g.adminOrderAction(o.id, 'deliver');
      expect(g.profile(u).gems).toBe(50 + pk.gems);
      expect(() => g.adminOrderAction(o.id, 'deliver')).toThrow(/قبلاً/);        // دوبار تحویل نمی‌شود
      expect(g.profile(u).gems).toBe(50 + pk.gems);
      const o2 = g.createOrder(u, pk.id, 'card', 'x');
      g.adminOrderAction(o2.id, 'cancel');
      expect(g.profile(u).gems).toBe(50 + pk.gems);
      for (let i = 0; i < 5; i++) g.createOrder(u, pk.id, 'card', 'y');
      expect(() => g.createOrder(u, pk.id, 'card', 'y')).toThrow(/سفارش/);
      expect(() => game.createOrder(uid, pk.id, 'card', 'z')).toThrow(/فعال نیست/);   // کارت در تنظیمات پیش‌فرض خاموش است
    });

    it('telegram stars: invoice order is paid automatically exactly once, with checks', () => {
      const pk = cfg.shop.gemPacks[0];
      const o = game.createOrder(uid, pk.id, 'stars');
      expect(o).toMatchObject({ gems: pk.gems, stars: pk.stars, toman: 0 });
      // تا پرداخت نشده، نه در پنل دیده می‌شود نه در «سفارش‌های اخیر» بازیکن
      expect(game.adminOrders()).toHaveLength(0);
      expect(game.shopState(uid).orders).toHaveLength(0);
      // قبل از پرداخت: مبلغ و صاحب سفارش چک می‌شود
      expect(game.starsPreCheck(o.id, 1, pk.stars)).toBeNull();
      expect(game.starsPreCheck(o.id, 999, pk.stars)).toMatch(/حساب دیگری/);
      expect(game.starsPreCheck(o.id, 1, pk.stars + 1)).toMatch(/مبلغ/);
      expect(game.starsPreCheck(12345, 1, pk.stars)).toMatch(/پیدا نشد/);
      // پرداخت اشتباه: چیزی تحویل نمی‌شود
      expect(game.completeStarsPayment(o.id, 999, pk.stars, 'chg-bad')).toBe('invalid');
      expect(game.completeStarsPayment(o.id, 1, 1, 'chg-bad2')).toBe('invalid');
      expect(game.profile(uid).gems).toBe(50);
      // پرداخت درست: یک‌بار
      expect(game.completeStarsPayment(o.id, 1, pk.stars, 'chg-1')).toBe('delivered');
      expect(game.profile(uid).gems).toBe(50 + pk.gems);
      expect(game.adminOrders()[0]).toMatchObject({ id: o.id, status: 'delivered', method: 'stars' });   // بعد از پرداخت دیده می‌شود
      expect(game.shopState(uid).orders[0]).toMatchObject({ id: o.id, status: 'delivered' });
      expect(game.completeStarsPayment(o.id, 1, pk.stars, 'chg-1')).toBe('duplicate');   // تلگرام دوباره بفرستد
      expect(game.completeStarsPayment(o.id, 1, pk.stars, 'chg-2')).toBe('invalid');     // سفارش تحویل‌شده
      expect(game.profile(uid).gems).toBe(50 + pk.gems);
      expect(game.starsPreCheck(o.id, 1, pk.stars)).toMatch(/قبلاً/);
      // سفارش استارِ پرداخت‌نشده بعد از یک ساعت لغو می‌شود، ولی اگر بعدش پرداخت شد باز تحویل می‌شود
      const o2 = game.createOrder(uid, pk.id, 'stars');
      t += 3_700_000;
      game.createOrder(uid, pk.id, 'stars');
      expect(game.adminOrders().find((x) => x.id === o2.id)).toBeUndefined();         // پرداخت‌نشده‌ی منقضی هیچ‌وقت دیده نمی‌شود
      expect(game.completeStarsPayment(o2.id, 1, pk.stars, 'chg-3')).toBe('delivered'); // ولی اگر بعدش واقعاً پرداخت شد، تحویل می‌شود
      expect(game.adminOrders().find((x) => x.id === o2.id)).toMatchObject({ status: 'delivered' });
      expect(() => game.adminOrderAction(game.createOrder(uid, pk.id, 'stars').id, 'deliver')).toThrow(/قبلاً/); // سفارش پرداخت‌نشده در پنل دستی تحویل نمی‌شود
    });
  });
});

describe('referrals (subordinates)', () => {
  it('counts a new player once, only after channel confirmation; no double counting via re-join / unfriend; existing users never count; admin can adjust', () => {
    const g = new Game({ db: openDb(), cfg, now: () => 1000, rng: () => 0.5 });
    const inviter = g.upsertUser({ tgId: 9001, name: 'I', avatar: null });
    g.refStart(9002, inviter);                                   // قبل از اولین ورود
    const kid = g.upsertUser({ tgId: 9002, name: 'K', avatar: null });
    expect(g.areFriends(inviter, kid)).toBe(true);
    expect(g.refCount(inviter)).toBe(0);                         // هنوز عضو کانال تأیید نشده
    g.setChannelOk(kid);
    expect(g.refCount(inviter)).toBe(1);
    g.setChannelOk(kid); g.countReferral(kid);                   // تکرار: همان ۱
    expect(g.refCount(inviter)).toBe(1);
    g.removeFriend(inviter, kid);                                // حذف دوست = بی‌اثر
    g.refStart(9002, inviter);                                   // لینک دوباره‌ی همان کاربر (حالا کاربر قدیمی است)
    g.upsertUser({ tgId: 9002, name: 'K', avatar: null });
    expect(g.refCount(inviter)).toBe(1);
    // کاربر قدیمی با لینک شخص دیگر: فقط دوست می‌شود، زیرمجموعه نیست
    const other = g.upsertUser({ tgId: 9003, name: 'O', avatar: null });
    g.refStart(9002, other);
    expect(g.refCount(other)).toBe(0);
    g.setChannelOk(kid);
    expect(g.refCount(other)).toBe(0);
    // اولین لینک برنده است
    g.refStart(9004, inviter); g.refStart(9004, other);
    const k2 = g.upsertUser({ tgId: 9004, name: 'K2', avatar: null });
    g.setChannelOk(k2);
    expect([g.refCount(inviter), g.refCount(other)]).toEqual([2, 0]);
    // خودش را دعوت نکند
    g.refStart(9005, 9999999);
    // رتبه‌بندی
    const lb = g.refLeaderboard(other);
    expect(lb.rows.map((r) => [r.id, r.refs])).toEqual([[inviter, 2]]);
    expect([lb.myRank, lb.myCount]).toEqual([0, 0]);
    // ادمین: کم/زیاد و تنظیم دقیق
    g.adminBalance(other, 'refs', { delta: 5 });
    expect(g.refCount(other)).toBe(5);
    g.adminBalance(inviter, 'refs', { set: 10 });
    expect(g.refCount(inviter)).toBe(10);
    g.adminBalance(inviter, 'refs', { delta: -100 });
    expect(g.refCount(inviter)).toBe(0);
    g.adminBalance(other, 'trophies', { delta: 12 });
    expect(g.profile(other).trophies).toBe(12);
    g.adminBalance(other, 'trophies', { set: 3 });
    expect(g.profile(other).trophies).toBe(3);
    expect(() => g.adminBalance(other, 'refs', { delta: 1.5 })).toThrow();
  });
});

describe('weekly tasks', () => {
  const mk = () => { let t = Date.UTC(2026, 9, 24, 12); let r = 0.37; const g = new Game({ db: openDb(), cfg, now: () => t, rng: () => { r = (r * 9301 + 0.4973) % 1; return r; } }); return { g, adv: (d: number) => { t += d * 86_400_000; }, u: (id: number) => g.upsertUser({ tgId: id, name: 'T' + id, avatar: null }) }; };

  it('creates 10 tasks: every type present, rewards add up to 2000 coins / 20 gems / 200 xp / 2 boxes, no repeats of last week', () => {
    const { g, adv, u } = mk();
    const me = u(1);
    const w1 = g.taskState(me);
    expect(w1.tasks).toHaveLength(10);
    expect(new Set(w1.tasks.map((t) => t.type)).size).toBe(6);
    const sum = (k: string) => w1.tasks.filter((t) => t.reward.kind === k).reduce((s, t) => s + t.reward.amount, 0);
    expect([sum('coins'), sum('gems'), sum('xp'), sum('box')]).toEqual([2000, 20, 200, 2]);
    expect(w1.tasks.filter((t) => t.reward.kind === 'box').every((t) => t.reward.box === 'bronze' || t.reward.box === 'silver')).toBe(true);
    const ids1 = (g as any).d.db.prepare('SELECT tpl FROM weekly_tasks WHERE week = ?').all(g.taskWeek()).map((r: any) => r.tpl);
    adv(7);
    const w2 = g.taskState(me);
    expect(w2.week).toBe(w1.week + 1);
    const ids2 = (g as any).d.db.prepare('SELECT tpl FROM weekly_tasks WHERE week = ?').all(g.taskWeek()).map((r: any) => r.tpl);
    expect(ids2.filter((x: string) => ids1.includes(x))).toHaveLength(0);
  });

  it('progress, claiming (once only), streaks, coin spending, unclaimed rewards burn on a new week', () => {
    const { g, adv, u } = mk();
    const me = u(2);
    const db = (g as any).d.db;
    const setTasks = (rows: [string, number, any][]) => rows.forEach(([type, target, reward], slot) => db.prepare('UPDATE weekly_tasks SET type = ?, target = ?, reward = ?, tpl = ? WHERE week = ? AND slot = ?').run(type, target, JSON.stringify(reward), 'x', g.taskWeek(), slot));
    g.taskState(me);
    setTasks([['solo_win', 2, { kind: 'coins', amount: 100 }], ['online_win', 1, { kind: 'gems', amount: 5 }], ['open_box', 1, { kind: 'xp', amount: 30 }], ['upgrade_card', 1, { kind: 'box', amount: 1, box: 'silver' }], ['spend_coins', 40, { kind: 'coins', amount: 50 }], ['win_streak', 3, { kind: 'coins', amount: 10 }]]);
    g.recordResult(me, true, 'solo', 0);
    g.recordResult(me, false, 'solo');                                  // رشته قطع شد
    g.recordResult(me, true, 'solo', 1);
    g.recordResult(me, true, 'multi');
    g.recordResult(me, true, 'multi');
    const s = g.taskState(me).tasks;
    expect(s[0]).toMatchObject({ progress: 2, claimed: false });        // ۲ برد سولو
    expect(s[1].progress).toBe(1);                                      // هدف ۱ (کپ شده)
    expect(s[5].progress).toBe(3);                                      // ۳ برد پشت‌هم (۱ + ۲ آنلاین بعد از باخت)
    expect(g.chargeEntry(me, 10)).toBe(true);
    expect(g.taskState(me).tasks[4].progress).toBe(10);
    expect(() => g.claimTask(me, 4)).toThrow(/تمام نشده/);
    const before = g.profile(me);
    g.claimTask(me, 0);
    expect(g.profile(me).coins).toBe(before.coins + 100);
    expect(() => g.claimTask(me, 0)).toThrow(/قبلاً/);
    expect(g.profile(me)).toMatchObject({ winStreak: 3, bestStreak: 3, wins: 4, losses: 1 });
    // ادمین: تسکِ نگرفته عوض می‌شود (نوع جدید: پیشرفت صفر)، تسکِ گرفته‌شده برای این بازیکن ثابت می‌ماند
    g.adminSaveTask(0, { type: 'open_box', target: 9, reward: { kind: 'gems', amount: 3 } });
    g.adminSaveTask(1, { type: 'online_win', target: 5, reward: { kind: 'xp', amount: 10 } });
    const t2 = g.taskState(me).tasks;
    expect(t2[0]).toMatchObject({ type: 'solo_win', target: 2, claimed: true, reward: { kind: 'coins', amount: 100 } });
    expect(t2[1]).toMatchObject({ target: 5, progress: 2 });            // همان نوع: پیشرفت می‌ماند
    g.adminSaveTask(1, { type: 'solo_win', target: 5, reward: { kind: 'xp', amount: 10 } });
    expect(g.taskState(me).tasks[1].progress).toBe(0);                  // نوع عوض شد: صفر
    expect(() => g.adminSaveTask(1, { type: 'nope', target: 5, reward: { kind: 'xp', amount: 10 } })).toThrow();
    expect(() => g.adminSaveTask(1, { type: 'solo_win', target: 0, reward: { kind: 'xp', amount: 10 } })).toThrow();
    expect(() => g.adminSaveTask(11, { type: 'solo_win', target: 1, reward: { kind: 'xp', amount: 10 } })).toThrow();
    // جعبه: ارتقا → تسک ۳
    expect(g.taskState(me).tasks[3].progress).toBe(0);
    // هفته‌ی بعد: همه صفر، قدیمی‌ها سوخته
    adv(7);
    const w = g.taskState(me);
    expect(w.tasks.every((t) => t.progress === 0 && !t.claimed)).toBe(true);
  });

  it('opening boxes and a failing event never break the game; reroll swaps templates', () => {
    const { g, u } = mk();
    const me = u(3);
    const db = (g as any).d.db;
    expect(() => g.taskEvent(me, 'open_box', NaN)).not.toThrow();
    g.taskState(me);
    const before = g.adminTasks().tasks.map((t) => t.tpl);
    g.adminRerollTasks(2);
    const after = g.adminTasks().tasks.map((t) => t.tpl);
    expect(after[2]).not.toBe(before[2]);
    expect(after.filter((x, i) => i !== 2)).toEqual(before.filter((_, i) => i !== 2));
    g.adminRerollTasks();
    expect(g.adminTasks().tasks).toHaveLength(10);
    // نمونه‌ی تکراری ممنوع
    expect(new Set(g.adminTasks().tasks.map((t) => t.tpl)).size).toBe(10);
    db.prepare('UPDATE users SET coins = 5000').run();
    expect(() => g.upgradeCard(me, 'giv')).toThrow(GameError);          // کارت کافی نیست؛ ولی تسک‌ها سالم می‌مانند
    expect(g.taskState(me).tasks).toHaveLength(10);
  });
});

describe('weekly tasks variety', () => {
  it('never more than 2 tasks of one type in a week (over many weeks)', () => {
    let t = Date.UTC(2026, 9, 24, 12); let r = 0.11;
    const g = new Game({ db: openDb(), cfg, now: () => t, rng: () => { r = (r * 7919 + 0.2113) % 1; return r; } });
    const me = g.upsertUser({ tgId: 1, name: 'T', avatar: null });
    for (let w = 0; w < 12; w++) {
      const ts = g.taskState(me).tasks;
      const by: Record<string, number> = {};
      ts.forEach((x) => { by[x.type] = (by[x.type] ?? 0) + 1; });
      expect(Math.max(...Object.values(by))).toBeLessThanOrEqual(2);
      expect(ts).toHaveLength(10);
      t += 7 * 86_400_000;
    }
  });
});
