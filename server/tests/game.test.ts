import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { openDb } from '../src/db';
import { resolveCard } from '@game/shared';
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
    expect(r.coins).toBeGreaterThanOrEqual(cfg.box.types.bronze.coins[0]);
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
    expect(p.coins).toBe(100 + cfg.box.types.bronze.coins[0]);
    expect(p.xp).toBe(0); // جعبه دیگر XP نمی‌دهد
    expect(game.addXp(uid, 100000)).toBeGreaterThan(1);
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
    expect(r.coins).toBeGreaterThanOrEqual(gold.coins[0]);
    expect(r.coins).toBeLessThanOrEqual(gold.coins[1]);
    expect(r.cards.length).toBeGreaterThanOrEqual(gold.cardCountRange[0]);
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

  describe('shop', () => {
    it('buys a daily card offer with coins or gems, once per day, adding the right copies', () => {
      const db = (game as any).d.db;
      db.prepare('UPDATE users SET coins = 1000, gems = 100').run();
      const [giv, , , , , sohrab] = cfg.shop.cards;
      // کارتی که دارم: count نسخه به تعداد اضافه می‌شود
      const r1 = game.buyShopCard(uid, 0, 'coins');
      expect(r1).toMatchObject({ cardId: giv.cardId, count: giv.count, isNew: false });
      expect(game.profile(uid).coins).toBe(1000 - giv.priceCoins);
      expect(game.profile(uid).cards.find((c) => c.id === giv.cardId)!.copies).toBe(giv.count);
      expect(() => game.buyShopCard(uid, 0, 'gems')).toThrow(/امروز/);          // یک‌بار در روز
      // کارت جدید: خودِ کارت + بقیه به‌عنوان تعداد
      const r2 = game.buyShopCard(uid, 5, 'gems');
      expect(r2).toMatchObject({ cardId: sohrab.cardId, isNew: true });
      expect(game.profile(uid).gems).toBe(100 - sohrab.priceGems);
      expect(game.profile(uid).cards.find((c) => c.id === sohrab.cardId)).toMatchObject({ level: 1, copies: sohrab.count - 1 });
      // فردا دوباره می‌شود
      t += 24 * 3600 * 1000;
      expect(game.shopState(uid).bought).toEqual([]);
      game.buyShopCard(uid, 0, 'coins');
      // موجودی کافی نیست
      db.prepare('UPDATE users SET coins = 0, gems = 0').run();
      expect(() => game.buyShopCard(uid, 1, 'coins')).toThrow(/سکه/);
      expect(() => game.buyShopCard(uid, 1, 'gems')).toThrow(/الماس/);
      expect(() => game.buyShopCard(uid, 9, 'gems')).toThrow(GameError);
    });

    it('coin packs cost gems', () => {
      (game as any).d.db.prepare('UPDATE users SET gems = 30').run();
      const pk = cfg.shop.coinPacks[0];
      game.buyCoinPack(uid, pk.id);
      const p = game.profile(uid);
      expect([p.gems, p.coins]).toEqual([30 - pk.gems, 100 + pk.coins]);
      expect(() => game.buyCoinPack(uid, 'nope')).toThrow(GameError);
      (game as any).d.db.prepare('UPDATE users SET gems = 0').run();
      expect(() => game.buyCoinPack(uid, pk.id)).toThrow(/الماس/);
    });

    it('gem orders: pending until the admin delivers (once), cap of 5 pending, gateway link placeholders', () => {
      const pk = cfg.shop.gemPacks[0];
      const o = game.createOrder(uid, pk.id);
      expect(o).toMatchObject({ gems: pk.gems, toman: pk.toman });
      expect(game.profile(uid).gems).toBe(50);                       // هنوز چیزی اضافه نشده
      expect(game.adminOrders()[0]).toMatchObject({ id: o.id, status: 'pending', tgId: 1 });
      game.adminOrderAction(o.id, 'deliver');
      expect(game.profile(uid).gems).toBe(50 + pk.gems);
      expect(() => game.adminOrderAction(o.id, 'deliver')).toThrow(/قبلاً/);   // دوبار تحویل نمی‌شود
      expect(game.profile(uid).gems).toBe(50 + pk.gems);
      const o2 = game.createOrder(uid, pk.id);
      game.adminOrderAction(o2.id, 'cancel');
      expect(game.profile(uid).gems).toBe(50 + pk.gems);
      for (let i = 0; i < 5; i++) game.createOrder(uid, pk.id);
      expect(() => game.createOrder(uid, pk.id)).toThrow(/سفارش/);
      const g2 = new Game({ db: openDb(), cfg: { ...cfg, shop: { ...cfg.shop, gatewayUrl: 'https://pay.example/go?o={order}&a={amount}&u={user}' } }, now: () => t, rng: () => rngVal });
      expect(g2.gatewayLink({ id: 7, gems: 50, toman: 49000 }, 123)).toBe('https://pay.example/go?o=7&a=49000&u=123');
      expect(game.gatewayLink({ id: 7, gems: 50, toman: 49000 }, 123)).toBeNull();
    });
  });
});
