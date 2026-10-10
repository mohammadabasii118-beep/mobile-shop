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
    expect(() => game.setDeck(uid, ['soldier', 'soldier', 'guard'])).toThrow(GameError);
    expect(() => game.setDeck(uid, ['soldier', 'guard', 'phoenix'])).toThrow(GameError);
    game.setDeck(uid, ['archer', 'guard', 'soldier']);
    expect(game.profile(uid).deck).toEqual(['archer', 'guard', 'soldier']);
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
    expect(p.xp).toBe(cfg.box.types.bronze.xp[0]);
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
    expect(g2.recordResult(id, true, 0)).toEqual({ box: null, type: null, noSlot: false });
    expect(g2.profile(id).boxes).toHaveLength(0);
    rngVal = 0.05;
    expect(g2.recordResult(id, true, 1)).toMatchObject({ box: 0, type: 'bronze' });
    expect(g2.recordResult(id, true)).toMatchObject({ type: 'gold' });  // مولتی‌پلیر
  });

  it('card stats come from the explicit per-level table (no growth formula)', () => {
    const soldier = cfg.cards.find((c) => c.id === 'soldier')!;
    const custom = { ...soldier, levels: [{ hp: 500, atk: 50, shield: 5 }, { hp: 600, atk: 60, shield: 6 }] };
    expect(resolveCard(custom, 1).hp).toBe(soldier.hp);
    expect(resolveCard(custom, 2)).toMatchObject({ hp: 500, atk: 50, shield: 5, level: 2 });
    expect(resolveCard(custom, 3).hp).toBe(600);
    expect(resolveCard(custom, 6).hp).toBe(600);          // بعد از آخرین ردیف: آخرین ردیف
    expect(resolveCard({ ...soldier, levels: undefined }, 4).hp).toBe(soldier.hp); // بدون جدول: بدون رشد
  });

  it('upgrade cost depends on the card type (ساده / معمولی / کمیاب)', () => {
    const db = (game as any).d.db;
    db.prepare("INSERT INTO user_cards (user_id, card_id, copies) VALUES (?, 'duelist', 1), (?, 'phoenix', 1)").run(uid, uid);
    db.prepare('UPDATE users SET coins = 150').run();
    // ساده: ۲ کارت و ۵۰ سکه — معمولی: ۲ کارت و ۱۰۰ — کمیاب: ۱ کارت و ۲۰۰
    expect(cfg.upgrade.byRarity.common[0]).toEqual({ copies: 2, coins: 50 });
    expect(cfg.upgrade.byRarity.rare[0]).toEqual({ copies: 2, coins: 100 });
    expect(cfg.upgrade.byRarity.epic[0]).toEqual({ copies: 1, coins: 200 });
    expect(() => game.upgradeCard(uid, 'duelist')).toThrow(/تعداد کارت/);   // ۱ از ۲
    expect(() => game.upgradeCard(uid, 'phoenix')).toThrow(/سکه/);         // ۱۵۰ از ۲۰۰
    db.prepare("UPDATE user_cards SET copies = 2 WHERE card_id = 'duelist'").run();
    game.upgradeCard(uid, 'duelist');
    const p = game.profile(uid);
    expect(p.cards.find((c) => c.id === 'duelist')).toMatchObject({ level: 2, copies: 0 });
    expect(p.coins).toBe(50);
  });

  it('upgrade needs duplicates and coins', () => {
    expect(() => game.upgradeCard(uid, 'soldier')).toThrow(/تعداد کارت/);
    const db = (game as any).d.db;
    db.prepare('UPDATE user_cards SET copies = 5 WHERE card_id = ?').run('soldier');
    db.prepare('UPDATE users SET coins = 10').run();
    expect(() => game.upgradeCard(uid, 'soldier')).toThrow(/سکه/);
    db.prepare('UPDATE users SET coins = 500').run();
    game.upgradeCard(uid, 'soldier');
    const p = game.profile(uid);
    expect(p.cards.find((c) => c.id === 'soldier')).toMatchObject({ level: 2, copies: 3 });
    expect(p.coins).toBe(450);
    expect(game.deckUnits(uid)[0].hp).toBe(121);
  });

  it('only winners get boxes; results are counted', () => {
    expect(game.recordResult(uid, false)).toBeNull();
    expect(game.recordResult(uid, true, 0)).toEqual({ box: 0, type: 'bronze', noSlot: false });
    const p = game.profile(uid);
    expect([p.wins, p.losses, p.soloStage]).toEqual([1, 1, 1]);
  });
});
