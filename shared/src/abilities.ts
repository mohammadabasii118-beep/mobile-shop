import type { BattleEvent, BattleState, Unit } from './types';

/** هر توانایی عددهایش را از params همان کارت (در همان لول) می‌خواند؛ اسم پارامتر هر توانایی یکتاست. */
export interface AbilityCtx {
  state: BattleState;
  unit: Unit;
  params: Record<string, number>;
  emit: (e: BattleEvent) => void;
}

/**
 * یک توانایی = یک آبجکت با هوک‌های اختیاری.
 * برای اضافه‌کردن توانایی جدید: یک ورودی به ABILITIES و یک جمله به ABILITY_META اضافه کن،
 * بعد id‌اش را در `abilities` کارت در game.json بنویس و عددهایش را در `params` / آمار هر لول بگذار.
 */
export interface Ability {
  /** تعداد حمله در هر نوبت (پیش‌فرض ۱؛ بیشینه‌ی همه‌ی توانایی‌های کارت) */
  attacksPerTurn?(p: Record<string, number>): number;
  /** یک‌بار، اول مبارزه (قبل از نوبت اول) */
  onBattleStart?(ctx: AbilityCtx): void;
  /** با قدرت ویژه، همین هوک دوباره (با عدد ۲ برابر) اجرا می‌شود */
  retrigger?: boolean;
  /** موقع شروع نوبت کارت */
  onTurnStart?(ctx: AbilityCtx): void;
  /** تغییر عدد حمله (مثلاً خشم) */
  modifyAttack?(ctx: AbilityCtx, atk: number): number;
  /** درصدی از ضربه که شیلد را رد می‌کند و مستقیم از جان کم می‌شود (۰ تا ۱۰۰) */
  pierce?(p: Record<string, number>): number;
  /** بعد از اینکه این کارت ضربه زد (dealt = آسیب واقعی وارد شده) */
  onAttack?(ctx: AbilityCtx, target: Unit, dealt: number): void;
  /** موقع مرگ؛ اگر true برگردد مرگ لغو می‌شود */
  onDeath?(ctx: AbilityCtx): boolean;
}

export const ABILITIES: Record<string, Ability> = {
  /** خشم: وقتی جان کارت زیر ۵۰٪ جان کامل برسد، حمله‌اش به اندازه‌ی درصدِ rage بیشتر می‌شود */
  rage: {
    modifyAttack({ unit, params }, atk) {
      return unit.hp * 2 < unit.maxHp ? Math.round(atk * (1 + (params.rage ?? 0) / 100)) : atk;
    },
  },
  /** سپر هم‌تیمی: اول مبارزه، یک‌بار، به هر کارتِ زنده‌ی ترکیب (از جمله خودش) teamShield شیلد اضافه می‌شود */
  team_shield: {
    retrigger: true,
    onBattleStart({ state, unit, params, emit }) {
      const amount = params.teamShield ?? 0;
      for (const u of state.units) if (u.side === unit.side && u.alive) { u.shield += amount; emit({ type: 'shield', uid: u.uid, amount }); }
    },
  },
  /** نفوذ: درصدِ pierce از هر ضربه شیلد را رد می‌کند و مستقیم از جان هدف کم می‌شود */
  pierce: {
    pierce: (p) => p.pierce ?? 0,
  },
  /** جان‌ربایی: بعد از هر ضربه، درصدِ lifesteal از «عدد حمله» به جان خودش اضافه می‌شود (بیشتر از جان کامل نمی‌شود) */
  lifesteal: {
    onAttack({ unit, params, emit }) {
      const heal = Math.min(unit.maxHp - unit.hp, Math.round((unit.atk * (params.lifesteal ?? 0)) / 100));
      if (heal > 0) {
        unit.hp += heal;
        emit({ type: 'heal', uid: unit.uid, amount: heal });
      }
    },
  },
  // ── توانایی‌های آماده برای کارت‌های بعدی ──
  double_strike: { attacksPerTurn: (p) => p.attacks ?? 2 },
  armor_up: {
    onTurnStart({ unit, params, emit }) {
      const amount = params.amount ?? 5;
      unit.shield += amount;
      emit({ type: 'shield', uid: unit.uid, amount });
    },
  },
  revive: {
    onDeath({ unit, params, emit }) {
      if (unit.abilityUsed) return false;
      unit.abilityUsed = true;
      unit.hp = Math.max(1, Math.floor((unit.maxHp * (params.hpPercent ?? 50)) / 100));
      emit({ type: 'revive', uid: unit.uid, hp: unit.hp });
      return true;
    },
  },
};

/** برچسب فارسی توانایی‌ها و متن توضیحشان (با عددهای همان لول) */
export const ABILITY_META: Record<string, { label: string; text: (p: Record<string, number>, f: (n: number) => string) => string }> = {
  rage: { label: 'خشم', text: (p, f) => `وقتی جانش زیر ۵۰٪ جان کامل برسد، حمله‌اش ${f(p.rage ?? 0)}٪ بیشتر می‌شود.` },
  team_shield: { label: 'سپر هم‌تیمی', text: (p, f) => `اول مبارزه، یک‌بار، به همه‌ی کارت‌های ترکیب (از جمله خودش) ${f(p.teamShield ?? 0)} شیلد اضافه می‌کند.` },
  pierce: { label: 'نفوذ', text: (p, f) => `${f(p.pierce ?? 0)}٪ از هر ضربه‌اش شیلد را رد می‌کند و مستقیم از جان هدف کم می‌شود.` },
  lifesteal: { label: 'جان‌ربایی', text: (p, f) => `بعد از هر ضربه، ${f(p.lifesteal ?? 0)}٪ از عدد حمله‌اش به جان خودش اضافه می‌شود.` },
  double_strike: { label: 'حمله‌ی چندگانه', text: (p, f) => `هر نوبت ${f(p.attacks ?? 2)} بار حمله می‌کند.` },
  armor_up: { label: 'شیلد هر نوبت', text: (p, f) => `هر نوبت ${f(p.amount ?? 5)} شیلد می‌گیرد.` },
  revive: { label: 'زنده‌شدن دوباره', text: (p, f) => `اگر بمیرد، یک‌بار با ${f(p.hpPercent ?? 50)}٪ جان زنده می‌شود.` },
};

/** متن توانایی‌های یک کارت در یک لول (برای نمایش به بازیکن) */
export function abilityLines(ids: { id: string }[] | undefined, params: Record<string, number> | undefined, f: (n: number) => string = String): { label: string; text: string }[] {
  return (ids ?? []).filter((a) => ABILITY_META[a.id]).map((a) => ({ label: ABILITY_META[a.id].label, text: ABILITY_META[a.id].text(params ?? {}, f) }));
}
