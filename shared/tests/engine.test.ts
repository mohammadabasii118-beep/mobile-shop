import { describe, expect, it } from 'vitest';
import { attack, createBattle, getUnit, pickTarget, resolveCard, startNextTurn } from '../src';
import type { GameConfig, UnitInit } from '../src';
import cfg from '../config/game.json';

const u = (o: Partial<UnitInit> = {}): UnitInit => ({ cardId: 'x', name: 'x', hp: 100, atk: 20, shield: 0, ...o });
const deck = (o: Partial<UnitInit> = {}) => [u(o), u(o), u(o)];

describe('engine', () => {
  /** n نوبت پشت‌سرهم را بازی می‌کند (بدون حمله) و uid کارت‌ها را برمی‌گرداند */
  const turnsOf = (s: ReturnType<typeof createBattle>, n: number) => {
    const seen: string[] = [];
    for (let i = 0; i < n; i++) { startNextTurn(s); seen.push(s.current!.uid); s.current = null; }
    return seen;
  };
  const kill = (s: ReturnType<typeof createBattle>, ...uids: string[]) => uids.forEach((u) => { getUnit(s, u)!.alive = false; });

  it('3v3: order is A0 B0 A1 B1 A2 B2, repeating', () => {
    const s = createBattle({ A: deck(), B: deck() }, 'A');
    expect(turnsOf(s, 8)).toEqual(['A0', 'B0', 'A1', 'B1', 'A2', 'B2', 'A0', 'B0']);
  });

  it('sides always alternate even when card counts differ (2 vs 3)', () => {
    const s = createBattle({ A: deck(), B: deck() }, 'A');
    kill(s, 'A2');
    const seq = turnsOf(s, 10);
    expect(seq.map((u) => u[0])).toEqual(['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B', 'A', 'B']);
    expect(seq).toEqual(['A0', 'B0', 'A1', 'B1', 'A0', 'B2', 'A1', 'B0', 'A0', 'B1']);
  });

  it('3 cards vs 1 card: strictly one turn each, never the same side twice in a row', () => {
    const s = createBattle({ A: deck(), B: deck() }, 'A');
    kill(s, 'B0', 'B1');
    const seq = turnsOf(s, 12);
    expect(seq.map((u) => u[0])).toEqual(['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B', 'A', 'B', 'A', 'B']);
    expect(seq.filter((u) => u === 'B2')).toHaveLength(6);
    expect(seq.filter((u) => u[0] === 'A')).toEqual(['A0', 'A1', 'A2', 'A0', 'A1', 'A2']);
  });

  it('alternation holds when the second side starts and when cards die mid-battle', () => {
    const s = createBattle({ A: deck(), B: deck() }, 'B');
    const seq: string[] = [];
    for (let i = 0; i < 14; i++) {
      if (i === 3) kill(s, 'B0');
      if (i === 6) kill(s, 'B1');
      startNextTurn(s); seq.push(s.current!.uid); s.current = null;
    }
    expect(seq.map((u) => u[0])).toEqual(Array.from({ length: 14 }, (_, i) => (i % 2 === 0 ? 'B' : 'A')));
  });

  it('second side can start first', () => {
    const s = createBattle({ A: deck(), B: deck() }, 'B');
    startNextTurn(s);
    expect(s.current!.uid).toBe('B0');
  });

  it('shield absorbs damage before hp', () => {
    const s = createBattle({ A: deck({ atk: 30 }), B: deck({ shield: 20, hp: 100 }) }, 'A');
    startNextTurn(s);
    attack(s, 'B0');
    const t = getUnit(s, 'B0')!;
    expect(t.shield).toBe(0);
    expect(t.hp).toBe(90);
  });

  it('rejects invalid targets', () => {
    const s = createBattle({ A: deck(), B: deck() }, 'A');
    startNextTurn(s);
    expect(() => attack(s, 'A1')).toThrow();
    expect(() => attack(s, 'nope')).toThrow();
  });

  it('wins when all three enemy units die', () => {
    const s = createBattle({ A: deck({ atk: 999 }), B: deck({ hp: 10 }) }, 'A');
    for (let i = 0; i < 10 && !s.over; i++) {
      startNextTurn(s);
      if (s.over) break;
      const side = getUnit(s, s.current!.uid)!.side;
      if (side === 'A') attack(s, pickTarget(s, 'A', 'smart', Math.random));
      else attack(s, pickTarget(s, 'B', 'random', Math.random));
    }
    expect(s.over).toBe(true);
    expect(s.winner).toBe('A');
  });

  it('double_strike gives two attacks per turn', () => {
    const d = [u({ ability: { id: 'double_strike', params: { attacks: 2 } } }), u(), u()];
    const s = createBattle({ A: d, B: deck() }, 'A');
    startNextTurn(s);
    expect(s.current!.attacksLeft).toBe(2);
    attack(s, 'B0');
    expect(s.current).not.toBeNull();
    attack(s, 'B1');
    expect(s.current).toBeNull();
  });

  it('revive brings the unit back once', () => {
    const d = [u({ hp: 10, ability: { id: 'revive', params: { hpPercent: 50 } } }), u(), u()];
    const s = createBattle({ A: deck({ atk: 50 }), B: d }, 'A');
    startNextTurn(s);
    const ev = attack(s, 'B0');
    expect(ev.some((e) => e.type === 'revive')).toBe(true);
    expect(getUnit(s, 'B0')!.alive).toBe(true);
    expect(getUnit(s, 'B0')!.hp).toBe(5);
    s.current = null; // next hit kills it for good
    startNextTurn(s); // B0 turn
    s.current = null;
    startNextTurn(s); // A1
    attack(s, 'B0');
    expect(getUnit(s, 'B0')!.alive).toBe(false);
  });

  it('lifesteal heals attacker, capped by max hp', () => {
    const d = [u({ hp: 100, atk: 40, ability: { id: 'lifesteal', params: { percent: 50 } } }), u(), u()];
    const s = createBattle({ A: d, B: deck() }, 'A');
    const a = getUnit(s, 'A0')!;
    a.hp = 50;
    startNextTurn(s);
    attack(s, 'B0');
    expect(a.hp).toBe(70);
  });

  it('armor_up adds shield at turn start', () => {
    const d = [u({ shield: 5, ability: { id: 'armor_up', params: { amount: 8 } } }), u(), u()];
    const s = createBattle({ A: d, B: deck() }, 'A');
    startNextTurn(s);
    expect(getUnit(s, 'A0')!.shield).toBe(13);
  });

  it('round cap decides winner by hp+shield', () => {
    const s = createBattle({ A: deck({ atk: 0, hp: 200 }), B: deck({ atk: 0, hp: 100 }) }, 'A');
    s.maxRounds = 5;
    let guard = 0;
    while (!s.over && guard++ < 100) {
      startNextTurn(s);
      if (s.over) break;
      const side = getUnit(s, s.current!.uid)!.side;
      attack(s, pickTarget(s, side, 'random', () => 0));
    }
    expect(s.over).toBe(true);
    expect(s.winner).toBe('A');
  });

  it('config levels scale stats and every config card/stage is valid', () => {
    const c = cfg as unknown as GameConfig;
    const soldier = c.cards.find((x) => x.id === 'soldier')!;
    expect(resolveCard(soldier, 1, c).hp).toBe(110);
    expect(resolveCard(soldier, 3, c).hp).toBe(132); // از جدول آمار لول‌ها
    const ids = new Set(c.cards.map((x) => x.id));
    c.startingDeck.forEach((id) => expect(ids.has(id)).toBe(true));
    c.solo.pits.forEach((pit) => pit.stages.forEach((st) => st.deck.forEach(([id]) => expect(ids.has(id)).toBe(true))));
    expect(c.solo.pits).toHaveLength(3);
    c.solo.pits.forEach((pit) => expect(pit.stages).toHaveLength(20));
    (['common', 'rare', 'epic'] as const).forEach((r) => expect(c.upgrade.byRarity[r].length).toBe(c.upgrade.maxLevel - 1));
  });
});
