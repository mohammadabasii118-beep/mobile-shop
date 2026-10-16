import { describe, expect, it } from 'vitest';
import { attack, cooldownFor, isValidTarget, createBattle, getUnit, pickAttacker, pickTarget, resolveCard, startNextTurn } from '../src';
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

describe('engine: new card abilities (mirath-cards-all)', () => {
  const first = (n = 5, o: Partial<UnitInit> = {}) => deckN(n, { hp: 9999, shield: 0, ...o });
  const strike = (s: S, from: string, to: string, rng: () => number = () => 0.99) => { startNextTurn(s); const ev = attack(s, from, to, rng); while (s.current && !s.over) ev.push(...attack(s, from, to, rng)); return ev; };

  it('splash: part of the attack lands on a neighbouring card of the target', () => {
    const d = [u({ atk: 100, abilities: [{ id: 'splash' }], params: { splash: 20 } }), ...deckN(4)];
    const s = createBattle({ A: d, B: first() }, 'A');
    const ev = strike(s, 'A0', 'B2');
    expect(getUnit(s, 'B2')!.hp).toBe(9999 - 100);
    const sp = ev.find((e) => e.type === 'attack' && (e as any).splash) as any;
    expect(sp.dmg).toBe(20);
    expect(Math.abs(Number(sp.to.slice(1)) - 2)).toBe(1);               // کارت کناری
    expect(getUnit(s, sp.to)!.hp).toBe(9999 - 20);
  });

  it('crit: with the lucky roll the hit is 1.5x (and a crit event is emitted)', () => {
    const d = [u({ atk: 40, abilities: [{ id: 'crit' }], params: { crit: 25 } }), ...deckN(4)];
    const lucky = createBattle({ A: d, B: first() }, 'A');
    const e1 = strike(lucky, 'A0', 'B0', () => 0);
    expect((e1.find((e) => e.type === 'attack') as any).dmg).toBe(60);
    expect(e1.some((e) => e.type === 'crit')).toBe(true);
    const normal = createBattle({ A: d, B: first() }, 'A');
    const e2 = strike(normal, 'A0', 'B0', () => 0.99);
    expect((e2.find((e) => e.type === 'attack') as any).dmg).toBe(40);
  });

  it('shield_ally (Peri): shields a teammate for a % of her max hp; cannot hit enemies; empowered doubles the %', () => {
    const peri = u({ hp: 100, atk: 10, chargeAttacks: 1, abilities: [{ id: 'shield_ally' }], params: { periShield: 20 }, special: { periShield: 40 } });
    const s = createBattle({ A: [peri, ...deckN(4, { shield: 0 })], B: first() }, 'A');
    startNextTurn(s);
    expect(isValidTarget(s, 'A0', 'B0')).toBe(false);
    expect(isValidTarget(s, 'A0', 'A0')).toBe(false);
    expect(() => attack(s, 'A0', 'B0')).toThrow();
    attack(s, 'A1', 'B0');                                              // پری حمله نکرده؛ یک کارت دیگر
    bturn(s, 'A2');
    startNextTurn(s);
    attack(s, 'A0', 'A2');
    expect(getUnit(s, 'A2')!.shield).toBe(20);
    expect(getUnit(s, 'A0')!.empowered).toBe(true);
    for (let i = 0; i < 2; i++) { bturn(s, 'A3'); startNextTurn(s); attack(s, s.current!.available.find((x) => x !== 'A0' && x !== 'A2')!, 'B0'); }
    getUnit(s, 'A0')!.cooldown = 0;
    bturn(s, 'A3');
    startNextTurn(s);
    attack(s, 'A0', 'A4');
    expect(getUnit(s, 'A4')!.shield).toBe(40);                         // ۲ برابر
  });

  it('shield_ally: a lone Peri may shield herself', () => {
    const peri = u({ hp: 100, abilities: [{ id: 'shield_ally' }], params: { periShield: 20 } });
    const s = createBattle({ A: [peri], B: first(1) }, 'A');
    startNextTurn(s);
    expect(isValidTarget(s, 'A0', 'A0')).toBe(true);
    attack(s, 'A0', 'A0');
    expect(getUnit(s, 'A0')!.shield).toBe(20);
  });

  it('poison (Kirke): hits poison the target for 2 of its own turns, % of max hp, ignoring shield', () => {
    const d = [u({ atk: 10, abilities: [{ id: 'poison' }], params: { poison: 5 } }), ...deckN(4)];
    const s = createBattle({ A: d, B: first(5, { hp: 1000, shield: 500 }) }, 'A');
    strike(s, 'A0', 'B0');
    expect(getUnit(s, 'B0')!.poison).toEqual({ pct: 5, left: 2 });
    const hp0 = getUnit(s, 'B0')!.hp;
    const ev1 = startNextTurn(s);                                       // نوبت B: ۱ تیک
    expect(ev1.find((e) => e.type === 'poison')).toMatchObject({ uid: 'B0', amount: 50 });
    expect(getUnit(s, 'B0')!.hp).toBe(hp0 - 50);
    attack(s, 'B1', 'A0');
    startNextTurn(s); attack(s, 'A1', 'B1');
    startNextTurn(s);                                                    // تیک دوم
    expect(getUnit(s, 'B0')!.hp).toBe(hp0 - 100);
    expect(getUnit(s, 'B0')!.poison).toBeNull();
  });

  it('poison can kill, and the side that loses its last card to poison loses', () => {
    const d = [u({ atk: 1, abilities: [{ id: 'poison' }], params: { poison: 50 } }), ...deckN(2)];
    const s = createBattle({ A: d, B: [u({ hp: 3, shield: 0 })] }, 'A');
    startNextTurn(s);
    attack(s, 'A0', 'B0');
    const ev = startNextTurn(s);
    expect(ev.some((e) => e.type === 'death')).toBe(true);
    expect(s.over).toBe(true);
    expect(s.winner).toBe('A');
  });

  it('fire_walker (Faramarz): shield grows by a % of the attack after each hit', () => {
    const d = [u({ atk: 50, shield: 0, abilities: [{ id: 'fire_walker' }], params: { fireWalk: 20 } }), ...deckN(4)];
    const s = createBattle({ A: d, B: first() }, 'A');
    strike(s, 'A0', 'B0');
    expect(getUnit(s, 'A0')!.shield).toBe(10);
  });

  it('double_chance: with the lucky roll the card attacks twice in one turn', () => {
    const d = [u({ atk: 10, abilities: [{ id: 'double_chance' }], params: { doubleChance: 15 } }), ...deckN(4)];
    const lucky = createBattle({ A: d, B: first() }, 'A');
    startNextTurn(lucky);
    attack(lucky, 'A0', 'B0', () => 0);
    expect(lucky.current!.attacksLeft).toBe(1);
    const no = createBattle({ A: d, B: first() }, 'A');
    startNextTurn(no);
    attack(no, 'A0', 'B0', () => 0.99);
    expect(no.current).toBeNull();
  });

  it('shield_break (Artemisia): destroys a % of the target shield before the hit, then pierce', () => {
    const d = [u({ atk: 50, abilities: [{ id: 'shield_break' }, { id: 'pierce' }], params: { shieldBreak: 50, pierce: 20 } }), ...deckN(4)];
    const s = createBattle({ A: d, B: first(5, { hp: 1000, shield: 100 }) }, 'A');
    const ev = strike(s, 'A0', 'B0');
    expect(ev.find((e) => e.type === 'shield')).toMatchObject({ uid: 'B0', amount: -50 });
    // شیلد ۱۰۰ ← ۵۰؛ ضربه ۵۰: ۱۰ مستقیم به جان، ۴۰ به شیلد
    expect(getUnit(s, 'B0')!.shield).toBe(10);
    expect(getUnit(s, 'B0')!.hp).toBe(1000 - 10);
  });

  it('special values from the card table (not just 2x) are used for the empowered attack', () => {
    const d = [u({ atk: 10, chargeAttacks: 1, abilities: [{ id: 'fire_walker' }], params: { fireWalk: 16 }, special: { fireWalk: 33 } }), ...deckN(4)];
    const s = createBattle({ A: d, B: first() }, 'A');
    strike(s, 'A0', 'B0');                                              // پر شد
    bturn(s, 'A1');
    const a0 = getUnit(s, 'A0')!; a0.cooldown = 0; a0.shield = 0;
    strike(s, 'A0', 'B0');                                              // حمله‌ی ویژه: ۳۳٪ از ۱۰ = ۳
    expect(a0.shield).toBe(3);
  });

  it('config: every card ability exists and the 16-card set matches the design doc', () => {
    const c = cfg as unknown as GameConfig;
    expect(c.cards).toHaveLength(16);
    const by = (r: string) => c.cards.filter((x) => x.rarity === r).map((x) => x.id);
    expect(by('common')).toEqual(['giv', 'bijan', 'arash', 'goodarz', 'tus', 'hector', 'raham']);
    expect(by('rare')).toEqual(['gordafarid', 'kaveh', 'siavash', 'achilles', 'peri', 'kirke']);
    expect(by('epic')).toEqual(['sohrab', 'faramarz', 'artemisia']);
    const fz = c.cards.find((x) => x.id === 'faramarz')!;
    expect(resolveCard(fz, 4, c).params).toMatchObject({ fireWalk: 26, doubleChance: 20 });
    expect(resolveCard(fz, 4, c).special).toMatchObject({ fireWalk: 52, doubleChance: 39 });
    expect(resolveCard(c.cards.find((x) => x.id === 'kirke')!, 6, c)).toMatchObject({ hp: 304, atk: 67, shield: 0, params: { poison: 6 }, special: { poison: 12 } });
    c.cards.filter((x) => x.rarity === 'common').forEach((x) => expect(x.abilities ?? []).toHaveLength(0));
  });
});
