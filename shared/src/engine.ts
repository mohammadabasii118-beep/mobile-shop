import { ABILITIES, type AbilityCtx } from './abilities';
import type { BattleEvent, BattleState, CardDef, CardStats, GameConfig, Rarity, Side, Unit, UnitInit } from './types';

export type Rng = () => number;

export const other = (s: Side): Side => (s === 'A' ? 'B' : 'A');

/** هزینه‌ی ارتقای کارتی از این نوع از لول `level` به لول بعد (undefined = حداکثر لول) */
export function upgradeStep(cfg: GameConfig, rarity: Rarity, level: number) {
  return cfg.upgrade.byRarity[rarity]?.[level - 1];
}

/** آمار کارت در یک لول (از جدول آمار خودِ کارت) به‌همراه عددهای توانایی همان لول */
export function cardStatsAt(def: CardDef, level: number): CardStats {
  const lv = def.levels ?? [];
  if (level <= 1 || lv.length === 0) return { hp: def.hp, atk: def.atk, shield: def.shield, params: def.params };
  const row = lv[Math.min(level - 2, lv.length - 1)];
  return { ...row, params: { ...def.params, ...row.params } };
}

/** کارت را با آمار و عددهای توانایی لولش برای نبرد آماده می‌کند. (پارامتر سوم برای سازگاری است و استفاده نمی‌شود) */
export function resolveCard(def: CardDef, level: number, _cfg?: unknown): UnitInit {
  const s = cardStatsAt(def, level);
  return { cardId: def.id, name: def.name, hp: s.hp, atk: s.atk, shield: s.shield, abilities: def.abilities, params: s.params ?? {}, level, chargeAttacks: def.chargeAttacks ?? 0 };
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
        charge: 0,
        empowered: false,
        cooldown: 0,
      }),
    );
  }
  const state: BattleState = {
    units,
    firstSide,
    nextSide: firstSide,
    turns: 0,
    round: 1,
    current: null,
    over: false,
    winner: null,
    maxRounds,
  };
  // توانایی‌های «اول مبارزه» (مثل سپر هم‌تیمی) یک‌بار اعمال می‌شوند؛ نمایش اولیه‌ی کارت‌ها همین آمار نهایی است
  for (const u of units) for (const ab of abilitiesOf(u)) ab.onBattleStart?.({ state, unit: u, params: u.params ?? {}, emit: () => {} });
  for (const u of units) u.maxShield = Math.max(u.maxShield, u.shield);
  return state;
}

export const getUnit = (s: BattleState, uid: string): Unit | undefined =>
  s.units.find((u) => u.uid === uid);

export const aliveUnits = (s: BattleState, side: Side): Unit[] =>
  s.units.filter((u) => u.side === side && u.alive);

const power = (s: BattleState, side: Side) =>
  aliveUnits(s, side).reduce((t, u) => t + u.hp + u.shield, 0);

/** توانایی‌های اجراییِ یک کارت */
function abilitiesOf(u: Unit) {
  return (u.abilities ?? []).map((a) => ABILITIES[a.id]).filter((a): a is NonNullable<typeof a> => !!a);
}

function ctxFor(s: BattleState, unit: Unit, events: BattleEvent[]): AbilityCtx {
  return { state: s, unit, params: unit.params ?? {}, emit: (e) => events.push(e) };
}

function finish(s: BattleState, winner: Side, reason: 'kills' | 'round_cap', events: BattleEvent[]) {
  s.over = true;
  s.winner = winner;
  s.current = null;
  events.push({ type: 'end', winner, reason });
}

/** قانون خاموشی: بعد از حمله، اگر ۴ یا ۵ کارت زنده باشد ۲ نوبتِ بعدیِ همان طرف خاموش می‌شود؛ با ۳ کارت ۱ نوبت؛ با ۲ یا کمتر هیچ. */
export const cooldownFor = (aliveCount: number) => (aliveCount >= 4 ? 2 : aliveCount === 3 ? 1 : 0);

/** عددهای توانایی را ۲ برابر می‌کند (برای حمله‌ی قدرت ویژه) */
const doubled = (p: Record<string, number> | undefined) => Object.fromEntries(Object.entries(p ?? {}).map(([k, v]) => [k, v * 2]));

/**
 * نوبت بعدی را شروع می‌کند. همیشه یکی‌درمیان: یک نوبت این طرف، یک نوبت طرف مقابل.
 * کارتِ حمله‌کننده را خودِ بازیکن انتخاب می‌کند؛ اینجا فقط معلوم می‌شود کدام کارت‌ها «آماده»‌اند (state.current.available).
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
  // ۲ کارت یا کمتر: قانون خاموشی برداشته می‌شود
  if (alive.length <= 2) for (const u of alive) u.cooldown = 0;
  let available = alive.filter((u) => u.cooldown === 0);
  // اگر به‌خاطر مرگِ کارت‌ها همه خاموش شدند، بازی گیر نکند
  if (available.length === 0) { for (const u of alive) u.cooldown = 0; available = alive; }
  // کارت‌های خاموش یک نوبت جلوتر می‌روند (بعد از محاسبه‌ی «آماده‌ها»)
  for (const u of alive) if (u.cooldown > 0) u.cooldown--;
  s.round = Math.floor(s.turns / 2) + 1;
  s.turns++;
  s.nextSide = other(side);
  s.current = { side, uid: null, attacksLeft: 0, available: available.map((u) => u.uid) };
  events.push({ type: 'turn', side, round: s.round, available: s.current.available });
  return events;
}

/**
 * حمله‌ی یک کارتِ آماده به یک هدفِ زنده‌ی حریف (هر دو را بازیکن انتخاب می‌کند).
 * اگر کارت توانایی چندحمله‌ای دارد، بعد از اولین حمله همان کارت باید باقی حمله‌هایش را بزند.
 */
export function attack(s: BattleState, attackerUid: string, targetUid: string): BattleEvent[] {
  const events: BattleEvent[] = [];
  if (s.over || !s.current) throw new Error('no active turn');
  const attacker = getUnit(s, attackerUid);
  const target = getUnit(s, targetUid);
  if (!attacker || !attacker.alive || attacker.side !== s.current.side) throw new Error('bad attacker');
  if (s.current.uid === null) {
    if (!s.current.available.includes(attackerUid)) throw new Error('attacker not available');
    s.current.uid = attackerUid;
    // توانایی‌های «شروع نوبت» (مثل شیلد هر نوبت) وقتی کارت انتخاب شد اجرا می‌شوند
    const abs0 = abilitiesOf(attacker);
    const c0 = ctxFor(s, attacker, events);
    for (const ab of abs0) ab.onTurnStart?.(c0);
    s.current.attacksLeft = Math.max(1, ...abs0.map((ab) => ab.attacksPerTurn?.(attacker.params ?? {}) ?? 1));
  } else if (s.current.uid !== attackerUid) {
    throw new Error('attacker must be the same card');
  }
  if (!target || !target.alive || target.side === attacker.side) throw new Error('bad target');

  const emp = attacker.empowered;
  const params = emp ? doubled(attacker.params) : attacker.params ?? {};
  const aCtx: AbilityCtx = { state: s, unit: attacker, params, emit: (e) => events.push(e) };
  const aAbs = abilitiesOf(attacker);
  // قدرت ویژه: توانایی‌های «یک‌باره» (مثل سپر هم‌تیمی) دوباره و با عدد ۲ برابر اجرا می‌شوند
  if (emp) for (const ab of aAbs) if (ab.retrigger) ab.onBattleStart?.(aCtx);
  // عدد حمله با توانایی‌هایی مثل خشم؛ نفوذ: بخشی از ضربه شیلد را رد می‌کند و مستقیم از جان کم می‌شود
  let dmg = attacker.atk;
  for (const ab of aAbs) if (ab.modifyAttack) dmg = ab.modifyAttack(aCtx, dmg);
  const pierceP = Math.min(100, aAbs.reduce((t, ab) => t + (ab.pierce?.(params) ?? 0), 0));
  const direct = Math.floor((dmg * pierceP) / 100);
  const normal = dmg - direct;
  const shieldLost = Math.min(target.shield, normal);
  target.shield -= shieldLost;
  const hpLost = Math.min(target.hp, direct + (normal - shieldLost));
  target.hp -= hpLost;
  events.push({ type: 'attack', from: attacker.uid, to: target.uid, dmg, shieldLost, hpLost, ...(emp ? { empowered: true } : {}) });
  for (const ab of aAbs) ab.onAttack?.(aCtx, target, shieldLost + hpLost);

  if (target.hp <= 0) {
    const tCtx = ctxFor(s, target, events);
    const saved = abilitiesOf(target).some((ab) => ab.onDeath?.(tCtx) === true);
    if (!saved) {
      target.alive = false;
      target.hp = 0;
      events.push({ type: 'death', uid: target.uid });
    }
  }

  // نوار قدرت ویژه: هر حمله کمی پر می‌کند؛ بعد از پر شدن، حمله‌ی بعدی ۲ برابر است و دوباره از صفر
  const need = attacker.chargeAttacks ?? 0;
  if (need > 0) {
    if (emp) { attacker.charge = 0; attacker.empowered = false; }
    else { attacker.charge++; if (attacker.charge >= need) attacker.empowered = true; }
    events.push({ type: 'charge', uid: attacker.uid, charge: attacker.charge, need, empowered: attacker.empowered });
  }

  s.current.attacksLeft--;
  if (aliveUnits(s, target.side).length === 0) {
    finish(s, attacker.side, 'kills', events);
  } else if (s.current.attacksLeft <= 0) {
    // خاموشی: طبق تعداد کارت‌های زنده‌ی همین طرف
    const cd = cooldownFor(aliveUnits(s, attacker.side).length);
    attacker.cooldown = cd;
    s.current = null;
  }
  return events;
}

/** انتخاب کارتِ حمله‌کننده برای ربات/وقتی مهلت تمام شد: random = یکی از آماده‌ها، smart = قوی‌ترین (قدرت ویژه‌دار اولویت دارد) */
export function pickAttacker(s: BattleState, mode: 'random' | 'smart', rng: Rng): string {
  const cur = s.current!;
  if (cur.uid) return cur.uid;
  const cands = cur.available.map((u) => getUnit(s, u)!).filter((u) => u.alive);
  if (mode === 'random') return cands[Math.floor(rng() * cands.length)].uid;
  return [...cands].sort((a, b) => Number(b.empowered) - Number(a.empowered) || b.atk - a.atk)[0].uid;
}

export function pickTarget(s: BattleState, side: Side, mode: 'random' | 'smart', rng: Rng, attackerUid?: string): string {
  const foes = aliveUnits(s, other(side));
  if (mode === 'random') return foes[Math.floor(rng() * foes.length)].uid;
  // هوشمند: اگه بشه یکی رو کشت همون، وگرنه خطرناک‌ترین (بیشترین حمله) رو بزن
  const atk = getUnit(s, attackerUid ?? s.current?.uid ?? '')?.atk ?? 0;
  const killable = foes.filter((f) => f.hp + f.shield <= atk).sort((a, b) => b.atk - a.atk);
  if (killable.length) return killable[0].uid;
  return [...foes].sort((a, b) => b.atk - a.atk || a.hp + a.shield - (b.hp + b.shield))[0].uid;
}

export const snapshot = (s: BattleState) =>
  s.units.map((u) => ({ uid: u.uid, hp: u.hp, shield: u.shield, alive: u.alive, charge: u.charge, empowered: u.empowered, cooldown: u.cooldown }));

/** هزینه‌ی الماس برای باز کردن فوری جعبه: برای هر stepMinutes دقیقه‌ی باقی‌مانده (رو به بالا) gemsPerStep. مثلاً ۱۲ دقیقه → ۲ پله → ۴ الماس */
export const boxSpeedupCost = (remainingMs: number, sp: { gemsPerStep: number; stepMinutes: number }) =>
  remainingMs <= 0 ? 0 : Math.ceil(remainingMs / (sp.stepMinutes * 60_000)) * sp.gemsPerStep;
