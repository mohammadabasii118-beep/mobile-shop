import type { BattleEvent, BoxType, Rarity, Side, Unit } from './types';

export interface UnitView {
  uid: string; side: Side; slot: number; cardId: string; name: string; rarity: Rarity | null;
  hp: number; maxHp: number; shield: number; atk: number; alive: boolean; abilities: string[]; level: number;
  /** قدرت ویژه: تعداد حمله‌ی انجام‌شده، تعدادِ لازم (۰ = ندارد)، آماده بودن (حمله‌ی بعدی ۲ برابر)، و نوبت‌های خاموشی */
  charge: number; chargeNeed: number; empowered: boolean; cooldown: number;
}
export interface Snap { uid: string; hp: number; shield: number; alive: boolean; charge: number; empowered: boolean; cooldown: number }

export interface BoxView { slot: number; type: BoxType; /** از کجا آمده: تک‌نفره (دانجن) یا آنلاین */ source: 'solo' | 'multi'; state: 'locked' | 'opening' | 'ready'; remainingMs: number; totalMs: number }
export interface CardView { id: string; level: number; copies: number }
export interface Profile {
  id: number; name: string; avatar: string | null;
  level: number; xp: number; xpNeeded: number; coins: number; /** الماس سرخ */ gems: number; /** کاپ‌ها (فقط از بخش آنلاین) */ trophies: number;
  wins: number; losses: number; soloStage: number; isAdmin: boolean;
  /** آیا شرط عضویت کانال برقرار است (یا لازم نیست)؟ */
  channelOk: boolean;
  cards: CardView[]; deck: string[]; boxes: BoxView[];
}

export interface BattleReward {
  box: number | null; type: BoxType | null; noSlot: boolean;
  /** فقط آنلاین: سکه و XP برد، تغییر کاپ (برای باخت منفی) و لول‌آپ */
  coins?: number; xp?: number; trophies?: number; levelsGained?: number;
}
export interface LeaderRow { rank: number; id: number; name: string; avatar: string | null; level: number; trophies: number; me: boolean }

export type ClientMsg =
  | { t: 'hello'; initData: string }
  | { t: 'queue' }
  | { t: 'leaveQueue' }
  | { t: 'solo'; stage: number }
  /** حمله: from = کارتِ خودم، uid = کارتِ حریف */
  | { t: 'attack'; battleId: string; from: string; uid: string }
  /** ترک بازی (= باخت) */
  | { t: 'leave'; battleId: string }
  /** پیام آماده‌ی چت (شماره‌ی جمله در cfg.chatPhrases) */
  | { t: 'chat'; battleId: string; id: number };

export type ServerMsg =
  | { t: 'ready'; profile: Profile }
  | { t: 'error'; message: string }
  | { t: 'queued' }
  | { t: 'profile'; profile: Profile }
  | { t: 'battleStart'; battleId: string; you: Side; units: UnitView[]; mode: 'solo' | 'pvp'; opponent: string; first: Side }
  | { t: 'prompt'; battleId: string; mine: boolean; /** کارت‌هایی که می‌توانند حمله کنند */ available: string[]; /** اگر کارت قبلاً انتخاب شده (چندحمله‌ای) */ attacker: string | null; attacksLeft: number; remainingMs: number }
  | { t: 'chat'; battleId: string; id: number; text: string }
  | { t: 'events'; battleId: string; events: BattleEvent[]; snap: Snap[] }
  | { t: 'battleEnd'; battleId: string; winner: Side; youWon: boolean; reason: string; reward: BattleReward | null; profile: Profile };

export type { Unit };
