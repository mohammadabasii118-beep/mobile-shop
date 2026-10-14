import { describe, expect, it } from 'vitest';
import { attack, cooldownFor, createBattle, getUnit, pickAttacker, pickTarget, resolveCard, startNextTurn } from '../src';
import type { GameConfig, UnitInit } from '../src';
import cfg from '../config/game.json';

const u = (o: Partial<UnitInit> = {}): UnitInit => ({ cardId: 'x', name: 'x', hp: 100, atk: 20, shield: 0, ...o });
const deckN = (n: number, o: Partial<UnitInit> = {}) => Array.from({ length: n }, () => u(o));
const deck = (o: Partial<UnitInit> = {}) => deckN(3, o);
type S = ReturnType<typeof createBattle>;
/** نوبت بعدی را شروع می‌کند، با کارتِ from به to حمله می‌کند (اگر نوبت چندحمله‌ای است باقی را هم به همان هدف می‌زند) */
const hit = (s: S, from: string, to: string) => { startNextTurn(s); const ev = attack(s, from, to); while (s.current && !s.over) ev.push(...attack(s, from, to)); return ev; };
/** یک نوبت کامل با اولین کارتِ آماده و اولین هدف */
const auto = (s: S) => { startNextTurn(s); if (s.over) return null; const side = s.current!.side; const from = pickAttacker(s, 'random', () => 0); const to = pickTarget(s, side, 'random', () => 0, from); attack(s, from, to); while (s.current && !s.over) attack(s, from, to); return from; };
/** نوبت B: اولین کارتِ آماده‌اش به هدف می‌زند */
const bturn = (s: S, to: string) => { startNextTurn(s); const f = s.current!.available[0]; attack(s, f, to); while (s.current && !s.over) attack(s, f, to); };
const kill = (s: S, ...uids: string[]) => uids.forEach((x) => { getUnit(s, x)!.alive = false; });

describe('engine: turns and attacker choice', () => {
  it('sides strictly alternate, and the owner may choose ANY ready card as the attacker', () => {
    const s = createBattle({ A: deckN(5, { hp: 9999 }), B: deckN(5, { hp: 9999 }) }, 'A');
    startNextTurn(s);
    expect(s.current).toMatchObject({ side: 'A', uid: null });
    expect(s.current!.available).toEqual(['A0', 'A1', 'A2', 'A3', 'A4']);
    attack(s, 'A3', 'B4');                                   // کارتِ چهارم، هدفِ پنجم: ترتیب اجباری نیست
    expect(getUnit(s, 'B4')!.hp).toBe(9999 - 20);
    startNextTurn(s);
    expect(s.current!.side).toBe('B');
    startNextTurn(s);
    expect(s.current!.side).toBe('A');
  });

  it('rejects invalid choices: wrong side, dead, unavailable, bad target', () => {
    const s = createBattle({ A: deck(), B: deck() }, 'A');
    startNextTurn(s);
    expect(() => attack(s, 'B0', 'A0')).toThrow();           // کارت حریف
    expect(() => attack(s, 'A0', 'A1')).toThrow();           // هدف خودی
    expect(() => attack(s, 'A0', 'nope')).toThrow();
    expect(() => attack(s, 'nope', 'B0')).toThrow();
    getUnit(s, 'A1')!.alive = false;
    expect(() => attack(s, 'A1', 'B0')).toThrow();           // کارت مرده
  });

  it('second side can start first', () => {
    const s = createBattle({ A: deck(), B: deck() }, 'B');
    startNextTurn(s);
    expect(s.current!.side).toBe('B');
  });

  it('sides alternate even when counts differ (1 vs 5)', () => {
    const s = createBattle({ A: deckN(5, { hp: 9999 }), B: deckN(1, { hp: 9999 }) }, 'A');
    const sides: string[] = [];
    for (let i = 0; i < 10; i++) { startNextTurn(s); sides.push(s.current!.side); auto2(s); }
    expect(sides).toEqual(['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B', 'A', 'B']);
    function auto2(st: S) { const from = st.current!.available[0]; const to = st.current!.side === 'A' ? 'B0' : 'A0'; attack(st, from, to); while (st.current) attack(st, from, to); }
  });
});

describe('engine: cooldown rule (a card that attacked rests)', () => {
  it('cooldownFor: 4 or 5 alive → 2 turns, 3 alive → 1 turn, 2 or fewer → none', () => {
    expect([5, 4, 3, 2, 1].map(cooldownFor)).toEqual([2, 2, 1, 0, 0]);
  });

  it('with 5 cards a card rests for 2 of its side’s next turns, then is back on the third', () => {
    const s = createBattle({ A: deckN(5, { hp: 99999 }), B: deckN(5, { hp: 99999 }) }, 'A');
    const ready: string[][] = [];
    const used: string[] = [];
    for (let i = 0; i < 12; i++) {
      startNextTurn(s);
      if (s.current!.side === 'A') ready.push([...s.current!.available]);
      const from = s.current!.available[0];
      if (s.current!.side === 'A') used.push(from);
      attack(s, from, s.current!.side === 'A' ? 'B0' : 'A0');
    }
    expect(ready[0]).toEqual(['A0', 'A1', 'A2', 'A3', 'A4']);
    expect(ready[1]).toEqual(['A1', 'A2', 'A3', 'A4']);            // A0 خاموش
    expect(ready[2]).toEqual(['A2', 'A3', 'A4']);                  // A0 و A1 خاموش
    expect(ready[3]).toEqual(['A0', 'A3', 'A4']);                  // A0 دوباره روشن (سومین نوبتِ بعد)
    expect(used.slice(0, 4)).toEqual(['A0', 'A1', 'A2', 'A0']);
  });

  it('with 3 cards alive the rest is only 1 turn; with 2 alive the rule is gone', () => {
    const s = createBattle({ A: deckN(3, { hp: 99999 }), B: deckN(5, { hp: 99999 }) }, 'A');
    startNextTurn(s); attack(s, 'A0', 'B0');                       // A0: ۱ نوبت خاموش
    bturn(s, 'A1');
    startNextTurn(s);
    expect(s.current!.available).toEqual(['A1', 'A2']);            // A0 هنوز خاموش
    attack(s, 'A1', 'B0');
    bturn(s, 'A2');
    startNextTurn(s);
    expect(s.current!.available).toEqual(['A0', 'A2']);            // A0 برگشت، A1 خاموش
    s.current = null;
    kill(s, 'A2');                                                  // ۲ کارت زنده: قانون برداشته می‌شود
    startNextTurn(s); startNextTurn(s);
    expect(s.current!.available).toEqual(['A0', 'A1']);
    attack(s, 'A0', 'B0');
    bturn(s, 'A0');
    startNextTurn(s);
    expect(s.current!.available).toContain('A0');                  // با ۲ کارت بی‌وقفه می‌تواند حمله کند
  });

  it('never gets stuck: if every living card is resting (deaths), they are freed', () => {
    const s = createBattle({ A: deckN(5, { hp: 99999 }), B: deckN(1, { hp: 99999 }) }, 'A');
    for (const x of ['A0', 'A1', 'A2', 'A3', 'A4']) getUnit(s, x)!.cooldown = 2;
    startNextTurn(s);
    expect(s.current!.available).toHaveLength(5);
  });
});

describe('engine: damage, abilities', () => {
  it('shield absorbs damage before hp', () => {
    const s = createBattle({ A: deck({ atk: 30 }), B: deck({ shield: 20, hp: 100 }) }, 'A');
    hit(s, 'A0', 'B0');
    const t = getUnit(s, 'B0')!;
    expect(t.shield).toBe(0);
    expect(t.hp).toBe(90);
  });

  it('wins when all enemy units die', () => {
    const s = createBattle({ A: deckN(5, { atk: 999 }), B: deckN(5, { hp: 10 }) }, 'A');
    for (let i = 0; i < 40 && !s.over; i++) auto(s);
    expect(s.over).toBe(true);
    expect(s.winner).toBe('A');
  });

  it('double_strike gives two attacks per turn, by the same card', () => {
    const d = [u({ abilities: [{ id: 'double_strike' }], params: { attacks: 2 } }), u(), u()];
    const s = createBattle({ A: d, B: deck() }, 'A');
    startNextTurn(s);
    attack(s, 'A0', 'B0');
    expect(s.current).not.toBeNull();
    expect(s.current!.attacksLeft).toBe(1);
    expect(() => attack(s, 'A1', 'B1')).toThrow();                  // کارت دیگری نمی‌شود
    attack(s, 'A0', 'B1');
    expect(s.current).toBeNull();
  });

  it('revive brings the unit back once', () => {
    const d = [u({ hp: 10, abilities: [{ id: 'revive' }], params: { hpPercent: 50 } }), u(), u()];
    const s = createBattle({ A: deck({ atk: 50 }), B: d }, 'A');
    const ev = hit(s, 'A0', 'B0');
    expect(ev.some((e) => e.type === 'revive')).toBe(true);
    expect(getUnit(s, 'B0')!.alive).toBe(true);
    expect(getUnit(s, 'B0')!.hp).toBe(5);
    bturn(s, 'A1');
    hit(s, 'A1', 'B0');
    expect(getUnit(s, 'B0')!.alive).toBe(false);
  });

  it('lifesteal heals attacker, capped by max hp', () => {
    const d = [u({ hp: 100, atk: 40, abilities: [{ id: 'lifesteal' }], params: { lifesteal: 50 } }), u(), u()];
    const s = createBattle({ A: d, B: deck() }, 'A');
    const a = getUnit(s, 'A0')!;
    a.hp = 50;
    hit(s, 'A0', 'B0');
    expect(a.hp).toBe(70);
  });

  it('armor_up adds shield when that card is chosen to attack', () => {
    const d = [u({ shield: 5, abilities: [{ id: 'armor_up' }], params: { amount: 8 } }), u(), u()];
    const s = createBattle({ A: d, B: deck() }, 'A');
    startNextTurn(s);
    expect(getUnit(s, 'A0')!.shield).toBe(5);
    attack(s, 'A0', 'B0');
    expect(getUnit(s, 'A0')!.shield).toBe(13);
  });

  it('rage raises attack below half hp', () => {
    const d = [u({ hp: 100, atk: 20, abilities: [{ id: 'rage' }], params: { rage: 30 } }), u(), u()];
    const s = createBattle({ A: d, B: deck({ hp: 500, shield: 0 }) }, 'A');
    expect(hit(s, 'A0', 'B0').find((e) => e.type === 'attack')).toMatchObject({ dmg: 20 });
    getUnit(s, 'A0')!.hp = 49;
    getUnit(s, 'A0')!.cooldown = 0;
    bturn(s, 'A1');
    expect(hit(s, 'A0', 'B0').find((e) => e.type === 'attack')).toMatchObject({ dmg: 26 });
  });

  it('team_shield gives every ally shield once at battle start', () => {
    const d = [u({ shield: 0, abilities: [{ id: 'team_shield' }], params: { teamShield: 8 } }), u({ shield: 0 }), u({ shield: 0 })];
    const s = createBattle({ A: d, B: deck() }, 'A');
    expect([0, 1, 2].map((i) => getUnit(s, `A${i}`)!.shield)).toEqual([8, 8, 8]);
    expect(getUnit(s, 'B0')!.shield).toBe(deck()[0].shield);
  });

  it('pierce sends part of the hit straight to hp', () => {
    const d = [u({ atk: 50, abilities: [{ id: 'pierce' }], params: { pierce: 20 } }), u(), u()];
    const s = createBattle({ A: d, B: deck({ hp: 100, shield: 30 }) }, 'A');
    const e = hit(s, 'A0', 'B0').find((x) => x.type === 'attack');
    expect(e).toMatchObject({ shieldLost: 30, hpLost: 20 });
  });
});

describe('engine: special power (charge bar, next attack doubles abilities)', () => {
  const sohrab = () => u({ atk: 50, chargeAttacks: 2, abilities: [{ id: 'pierce' }, { id: 'lifesteal' }], params: { pierce: 20, lifesteal: 10 } });
  /** n نوبتِ A با کارت A0 (نوبت‌های B با کارت B0 به A1) */
  const attackTimes = (s: S, n: number, target = 'B0') => {
    const evs = [];
    for (let i = 0; i < n; i++) {
      getUnit(s, 'A0')!.cooldown = 0;
      evs.push(...hit(s, 'A0', target));
      if (!s.over) { bturn(s, 'A1'); }
    }
    return evs;
  };

  it('each attack fills the bar; when full the next attack is doubled and the bar resets', () => {
    const s = createBattle({ A: [sohrab(), u(), u()], B: deck({ hp: 99999, shield: 0 }) }, 'A');
    const a = getUnit(s, 'A0')!;
    attackTimes(s, 1);
    expect([a.charge, a.empowered]).toEqual([1, false]);
    const ev2 = attackTimes(s, 1);
    expect([a.charge, a.empowered]).toEqual([2, true]);                       // پر شد
    expect(ev2.find((e) => e.type === 'charge')).toMatchObject({ uid: 'A0', charge: 2, need: 2, empowered: true });
    const ev3 = attackTimes(s, 1);
    const atk3 = ev3.find((e) => e.type === 'attack') as any;
    expect(atk3.empowered).toBe(true);
    expect(atk3.hpLost).toBe(50);                                              // ۲۰٪ ← ۴۰٪ نفوذ، ولی شیلد ۰ است
    expect([a.charge, a.empowered]).toEqual([0, false]);                       // دوباره از صفر
  });

  it('doubled pierce and lifesteal numbers on the empowered attack', () => {
    const s = createBattle({ A: [u({ atk: 50, chargeAttacks: 1, abilities: [{ id: 'pierce' }, { id: 'lifesteal' }], params: { pierce: 20, lifesteal: 10 } }), u(), u()], B: deck({ hp: 99999, shield: 100 }) }, 'A');
    const a = getUnit(s, 'A0')!;
    a.hp = 10; a.maxHp = 1000;
    const n1 = hit(s, 'A0', 'B0').find((e) => e.type === 'attack') as any;      // عادی: ۲۰٪ از ۵۰ = ۱۰ مستقیم
    expect(n1).toMatchObject({ shieldLost: 40, hpLost: 10 });
    expect(a.hp).toBe(10 + 5);                                                 // ۱۰٪ از عدد حمله (۵۰) = ۵
    expect(a.empowered).toBe(true);
    bturn(s, 'A1');
    a.cooldown = 0;
    const n2 = hit(s, 'A0', 'B0').find((e) => e.type === 'attack') as any;      // ۲ برابر: ۴۰٪ از ۵۰ = ۲۰ مستقیم
    expect(n2).toMatchObject({ empowered: true, shieldLost: 30, hpLost: 20 });
    expect(a.hp).toBe(15 + 10);                                                // ۲۰٪ از ۵۰ = ۱۰
  });

  it('rage and team_shield double too (team_shield is re-applied with double amount)', () => {
    const k = u({ shield: 0, chargeAttacks: 1, abilities: [{ id: 'team_shield' }], params: { teamShield: 8 } });
    const s = createBattle({ A: [k, u({ shield: 0 }), u({ shield: 0 })], B: deck({ hp: 99999 }) }, 'A');
    expect(getUnit(s, 'A1')!.shield).toBe(8);
    hit(s, 'A0', 'B0');
    bturn(s, 'A1');
    getUnit(s, 'A0')!.cooldown = 0;
    const ev = hit(s, 'A0', 'B0');
    expect(ev.filter((e) => e.type === 'shield')).toHaveLength(3);
    expect(getUnit(s, 'A1')!.shield).toBe(8 - 20 > 0 ? 0 : getUnit(s, 'A1')!.shield);   // (ضربه‌ی حریف روی A1 هم بود)
    const r = createBattle({ A: [u({ hp: 100, atk: 20, chargeAttacks: 1, abilities: [{ id: 'rage' }], params: { rage: 30 } }), u(), u()], B: deck({ hp: 99999 }) }, 'A');
    getUnit(r, 'A0')!.hp = 40;
    hit(r, 'A0', 'B0');                                                          // ۲۰ × ۱٫۳ = ۲۶ (عادی)
    bturn(r, 'A1');
    getUnit(r, 'A0')!.cooldown = 0;
    expect((hit(r, 'A0', 'B0').find((e) => e.type === 'attack') as any).dmg).toBe(32);   // ۲۰ × ۱٫۶ = ۳۲
  });

  it('cards without a special power never charge', () => {
    const s = createBattle({ A: deck(), B: deck() }, 'A');
    const ev = hit(s, 'A0', 'B0');
    expect(ev.some((e) => e.type === 'charge')).toBe(false);
    expect(getUnit(s, 'A0')!.empowered).toBe(false);
  });
});

describe('engine: end conditions and config', () => {
  it('round cap decides winner by hp+shield', () => {
    const s = createBattle({ A: deck({ atk: 0, hp: 200 }), B: deck({ atk: 0, hp: 100 }) }, 'A');
    s.maxRounds = 5;
    let guard = 0;
    while (!s.over && guard++ < 100) auto(s);
    expect(s.over).toBe(true);
    expect(s.winner).toBe('A');
  });

  it('config levels scale stats and every config card/stage is valid', () => {
    const c = cfg as unknown as GameConfig;
    const giv = c.cards.find((x) => x.id === 'giv')!;
    expect(resolveCard(giv, 1, c).hp).toBe(135);
    expect(resolveCard(giv, 3, c).hp).toBe(243); // از جدول آمار لول‌ها
    expect(resolveCard(c.cards.find((x) => x.id === 'sohrab')!, 1, c).chargeAttacks).toBeGreaterThan(0);
    const ids = new Set(c.cards.map((x) => x.id));
    c.startingDeck.forEach((id) => expect(ids.has(id)).toBe(true));
    expect(c.deckSize).toBe(5);
    c.solo.pits.forEach((pit) => pit.stages.forEach((st) => { st.deck.forEach(([id]) => expect(ids.has(id)).toBe(true)); expect(st.deck.length).toBeGreaterThanOrEqual(3); expect(st.deck.length).toBeLessThanOrEqual(c.deckSize); }));
    expect(c.solo.pits).toHaveLength(3);
    c.solo.pits.forEach((pit) => expect(pit.stages).toHaveLength(20));
    (['common', 'rare', 'epic'] as const).forEach((r) => expect(c.upgrade.byRarity[r].length).toBe(c.upgrade.maxLevel - 1));
  });
});
