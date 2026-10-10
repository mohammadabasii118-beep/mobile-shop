import { ABILITIES, type AbilityCtx } from './abilities';
import type { BattleEvent, BattleState, CardDef, CardStats, GameConfig, Rarity, Side, Unit, UnitInit } from './types';

export type Rng = () => number;

export const other = (s: Side): Side => (s === 'A' ? 'B' : 'A');

/** هزینه‌ی ارتقای کارتی از این نوع از لول `level` به لول بعد (undefined = حداکثر لول) */
export function upgradeStep(cfg: GameConfig, rarity: Rarity, level: number) {
  return cfg.upgrade.byRarity[rarity]?.[level - 1];
}

/** آمار کارت در یک لول (از جدول آمار خودِ کارت) */
export function cardStatsAt(def: CardDef, level: number): CardStats {
  const lv = def.levels ?? [];
  if (level <= 1 || lv.length === 0) return { hp: def.hp, atk: def.atk, shield: def.shield };
  return lv[Math.min(level - 2, lv.length - 1)];
}

/** کارت را با آمارِ لولش برای نبرد آماده می‌کند. (پارامتر سوم برای سازگاری با کدهای قبلی است و استفاده نمی‌شود) */
export function resolveCard(def: CardDef, level: number, _cfg?: unknown): UnitInit {
  const s = cardStatsAt(def, level);
  return { cardId: def.id, name: def.name, hp: s.hp, atk: s.atk, shield: s.shield, ability: def.ability, level };
}

export function createBattle(
  decks: Record<Side, UnitInit[]>,
  firstSide: Side,
  maxRounds = 100,
): BattleState {
  const units: Unit[] = [];
  for (const side of ['A', 'B'] as Side[]) {
    decks[side].forEach((u, slot) =>
      units.push({
        ...u,
        uid: `${side}${slot}`,
        side,
        slot,
        maxHp: u.hp,
        maxShield: u.shield,
        alive: true,
        abilityUsed: false,
      }),
    );
  }
  return {
    units,
    firstSide,
    nextSide: firstSide,
    lastSlot: { A: -1, B: -1 },
    turns: 0,
    round: 1,
    current: null,
    over: false,
    winner: null,
    maxRounds,
  };
}

export const getUnit = (s: BattleState, uid: string): Unit | undefined =>
  s.units.find((u) => u.uid === uid);

export const aliveUnits = (s: BattleState, side: Side): Unit[] =>
  s.units.filter((u) => u.side === side && u.alive);

const power = (s: BattleState, side: Side) =>
  aliveUnits(s, side).reduce((t, u) => t + u.hp + u.shield, 0);

function ctxFor(s: BattleState, unit: Unit, events: BattleEvent[]): AbilityCtx | null {
  if (!unit.ability) return null;
  return { state: s, unit, params: unit.ability.params ?? {}, emit: (e) => events.push(e) };
}

function finish(s: BattleState, winner: Side, reason: 'kills' | 'round_cap', events: BattleEvent[]) {
  s.over = true;
  s.winner = winner;
  s.current = null;
  events.push({ type: 'end', winner, reason });
}

/**
 * نوبت بعدی را شروع می‌کند. همیشه یکی‌درمیان: یک نوبت این طرف، یک نوبت طرف مقابل، حتی اگر تعداد کارت‌های زنده‌شان فرق کند.
 * هر طرف کارت‌های زنده‌اش را به ترتیب جایگاه می‌چرخد. بعد از صدا زدنش state.current پر می‌شود (یا بازی تمام می‌شود).
 */
export function startNextTurn(s: BattleState): BattleEvent[] {
  const events: BattleEvent[] = [];
  if (s.over) return events;
  // سقف مخفی دور: هر دور = یک نوبت از هر طرف. تساوی: نفر دوم برنده (جبران مزیت شروع)
  if (s.turns >= s.maxRounds * 2) {
    const a = power(s, 'A');
    const b = power(s, 'B');
    finish(s, a === b ? other(s.firstSide) : a > b ? 'A' : 'B', 'round_cap', events);
    return events;
  }
  const side = s.nextSide;
  const alive = aliveUnits(s, side).sort((x, y) => x.slot - y.slot);
  if (alive.length === 0) {
    finish(s, other(side), 'kills', events);
    return events;
  }
  const unit = alive.find((u) => u.slot > s.lastSlot[side]) ?? alive[0];
  s.lastSlot[side] = unit.slot;
  s.round = Math.floor(s.turns / 2) + 1;
  s.turns++;
  s.nextSide = other(side);
  events.push({ type: 'turn', uid: unit.uid, round: s.round });
  const ctx = ctxFor(s, unit, events);
  const ab = unit.ability && ABILITIES[unit.ability.id];
  if (ctx && ab?.onTurnStart) ab.onTurnStart(ctx);
  const attacks = ab?.attacksPerTurn?.(unit.ability!.params ?? {}) ?? 1;
  s.current = { uid: unit.uid, attacksLeft: attacks };
  return events;
}

/** حمله‌ی کارتِ نوبت‌دار به یک هدفِ زنده‌ی حریف. */
export function attack(s: BattleState, targetUid: string): BattleEvent[] {
  const events: BattleEvent[] = [];
  if (s.over || !s.current) throw new Error('no active turn');
  const attacker = getUnit(s, s.current.uid)!;
  const target = getUnit(s, targetUid);
  if (!target || !target.alive || target.side === attacker.side) throw new Error('bad target');

  const dmg = attacker.atk;
  const shieldLost = Math.min(target.shield, dmg);
  target.shield -= shieldLost;
  const hpLost = Math.min(target.hp, dmg - shieldLost);
  target.hp -= hpLost;
  events.push({ type: 'attack', from: attacker.uid, to: target.uid, dmg, shieldLost, hpLost });

  const aCtx = ctxFor(s, attacker, events);
  const aAb = attacker.ability && ABILITIES[attacker.ability.id];
  if (aCtx && aAb?.onAttack) aAb.onAttack(aCtx, target, shieldLost + hpLost);

  if (target.hp <= 0) {
    const tCtx = ctxFor(s, target, events);
    const tAb = target.ability && ABILITIES[target.ability.id];
    const saved = tCtx && tAb?.onDeath ? tAb.onDeath(tCtx) : false;
    if (!saved) {
      target.alive = false;
      target.hp = 0;
      events.push({ type: 'death', uid: target.uid });
    }
  }

  s.current.attacksLeft--;
  if (aliveUnits(s, target.side).length === 0) {
    finish(s, attacker.side, 'kills', events);
  } else if (s.current.attacksLeft <= 0) {
    s.current = null;
  }
  return events;
}

export function pickTarget(s: BattleState, side: Side, mode: 'random' | 'smart', rng: Rng): string {
  const foes = aliveUnits(s, other(side));
  if (mode === 'random') return foes[Math.floor(rng() * foes.length)].uid;
  // هوشمند: اگه بشه یکی رو کشت همون، وگرنه خطرناک‌ترین (بیشترین حمله) رو بزن
  const atk = getUnit(s, s.current!.uid)!.atk;
  const killable = foes.filter((f) => f.hp + f.shield <= atk).sort((a, b) => b.atk - a.atk);
  if (killable.length) return killable[0].uid;
  return [...foes].sort((a, b) => b.atk - a.atk || a.hp + a.shield - (b.hp + b.shield))[0].uid;
}

export const snapshot = (s: BattleState) =>
  s.units.map((u) => ({ uid: u.uid, hp: u.hp, shield: u.shield, alive: u.alive }));
