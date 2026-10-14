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
  it('new player starts with 3 cards and that deck', () => {
    const p = game.profile(uid);
    expect(p.deck).toEqual(cfg.startingDeck);
    expect(p.cards).toHaveLength(3);
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

  it('new players start with only the 3 common starter cards', () => {
    const p = game.profile(uid);
    expect(p.cards.map((c) => c.id).sort()).toEqual(['arash', 'bijan', 'giv']);
    expect(p.deck).toEqual(['giv', 'bijan', 'arash']);
  });

  it('migrateCards removes cards that no longer exist and refills the deck from the starters', () => {
    const db = (game as any).d.db;
    db.prepare("INSERT INTO user_cards (user_id, card_id, copies) VALUES (?, 'old_card', 3)").run(uid);
    db.prepare("UPDATE deck SET card_id = 'old_card' WHERE user_id = ? AND slot = 0").run(uid);
    game.migrateCards();
    const p = game.profile(uid);
    expect(p.cards.some((c) => c.id === 'old_card')).toBe(false);
    expect(p.deck).toHaveLength(3);
    expect(new Set(p.deck).size).toBe(3);
    expect(p.deck.every((id) => p.cards.some((c) => c.id === id))).toBe(true);
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
    it('buys a daily card offer with the single currency set for the slot, once per day, adding the right copies', () => {
      const db = (game as any).d.db;
      db.prepare('UPDATE users SET coins = 1000, gems = 100').run();
      const giv = cfg.shop.cards[0], sohrab = cfg.shop.cards[5];
      expect([giv.currency, sohrab.currency]).toEqual(['coins', 'gems']);
      // کارتی که دارم: count نسخه به تعداد اضافه می‌شود
      expect(game.buyShopCard(uid, 0)).toMatchObject({ cardId: giv.cardId, count: giv.count, isNew: false });
      expect(game.profile(uid).coins).toBe(1000 - giv.price);
      expect(game.profile(uid).gems).toBe(100);                                  // ارز دیگر دست نمی‌خورد
      expect(game.profile(uid).cards.find((c) => c.id === giv.cardId)!.copies).toBe(giv.count);
      expect(() => game.buyShopCard(uid, 0)).toThrow(/امروز/);                  // یک‌بار در روز
      // کارت جدید با الماس: خودِ کارت + بقیه به‌عنوان تعداد
      expect(game.buyShopCard(uid, 5)).toMatchObject({ cardId: sohrab.cardId, isNew: true });
      expect(game.profile(uid).gems).toBe(100 - sohrab.price);
      expect(game.profile(uid).cards.find((c) => c.id === sohrab.cardId)).toMatchObject({ level: 1, copies: sohrab.count - 1 });
      // فردا دوباره می‌شود
      t += 24 * 3600 * 1000;
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
