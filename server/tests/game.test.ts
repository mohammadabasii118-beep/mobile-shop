import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { openDb } from '../src/db';
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
    expect(game.grantBox(uid)).toEqual({ box: null, noSlot: true });
    game.startBox(uid, 0);
    expect(() => game.startBox(uid, 1)).toThrow(GameError);
    expect(() => game.openBox(uid, 0)).toThrow(/زمانش/);
    t += cfg.box.durationSeconds * 1000 - 1;
    expect(() => game.openBox(uid, 0)).toThrow(GameError);
    t += 1;
    const r = game.openBox(uid, 0);
    expect(r.coins).toBeGreaterThanOrEqual(cfg.box.coins[0]);
    expect(game.profile(uid).boxes).toHaveLength(3);
    game.startBox(uid, 1); // حالا می‌شه یکی دیگه شروع کرد
  });

  it('box rewards: coins, xp, level-up, card chance', () => {
    game.grantBox(uid);
    game.startBox(uid, 0);
    t += cfg.box.durationSeconds * 1000;
    rngVal = 0.0; // epic roll, max... min coins
    const r = game.openBox(uid, 0);
    expect(r.cards).toHaveLength(1);
    expect(cfg.cards.find((c) => c.id === r.cards[0].id)!.rarity).toBe('epic');
    const p = game.profile(uid);
    expect(p.coins).toBe(100 + cfg.box.coins[0]);
    expect(p.xp).toBe(cfg.box.xp[0]);
    expect(game.addXp(uid, 100000)).toBeGreaterThan(1);
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
    expect(game.recordResult(uid, true, 0)).toEqual({ box: 0, noSlot: false });
    const p = game.profile(uid);
    expect([p.wins, p.losses, p.soloStage]).toEqual([1, 1, 1]);
  });
});
