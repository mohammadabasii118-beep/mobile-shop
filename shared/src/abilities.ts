import type { BattleEvent, BattleState, Unit } from './types';

export interface AbilityCtx {
  state: BattleState;
  unit: Unit;
  params: Record<string, number>;
  emit: (e: BattleEvent) => void;
}

/**
 * یک توانایی = یک آبجکت با هوک‌های اختیاری.
 * برای اضافه‌کردن توانایی جدید، فقط یک ورودی به ABILITIES اضافه کن
 * و بعد id‌اش را در game.json روی کارت بنویس.
 */
export interface Ability {
  /** تعداد حمله در هر نوبت (پیش‌فرض ۱) */
  attacksPerTurn?(params: Record<string, number>): number;
  /** موقع شروع نوبت کارت */
  onTurnStart?(ctx: AbilityCtx): void;
  /** بعد از اینکه این کارت آسیب زد (dmg = آسیب واقعی وارد شده) */
  onAttack?(ctx: AbilityCtx, target: Unit, dealt: number): void;
  /** موقع مرگ؛ اگر true برگردونه مرگ لغو می‌شه */
  onDeath?(ctx: AbilityCtx): boolean;
}

export const ABILITIES: Record<string, Ability> = {
  double_strike: {
    attacksPerTurn: (p) => p.attacks ?? 2,
  },
  lifesteal: {
    onAttack({ unit, params, emit }, _target, dealt) {
      const heal = Math.min(unit.maxHp - unit.hp, Math.floor((dealt * (params.percent ?? 50)) / 100));
      if (heal > 0) {
        unit.hp += heal;
        emit({ type: 'heal', uid: unit.uid, amount: heal });
      }
    },
  },
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
