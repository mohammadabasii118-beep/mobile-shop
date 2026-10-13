import type { BattleEvent, BoxType, Rarity, Side, Unit } from './types';

export interface UnitView {
  uid: string; side: Side; slot: number; cardId: string; name: string; rarity: Rarity | null;
  hp: number; maxHp: number; shield: number; atk: number; alive: boolean; abilities: string[]; level: number;
}
export interface Snap { uid: string; hp: number; shield: number; alive: boolean }

export interface BoxView { slot: number; type: BoxType; state: 'locked' | 'opening' | 'ready'; remainingMs: number; totalMs: number }
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
  | { t: 'target'; battleId: string; uid: string };

export type ServerMsg =
  | { t: 'ready'; profile: Profile }
  | { t: 'error'; message: string }
  | { t: 'queued' }
  | { t: 'profile'; profile: Profile }
  | { t: 'battleStart'; battleId: string; you: Side; units: UnitView[]; mode: 'solo' | 'pvp'; opponent: string; first: Side }
  | { t: 'prompt'; battleId: string; actor: string; attacksLeft: number; remainingMs: number; mine: boolean }
  | { t: 'events'; battleId: string; events: BattleEvent[]; snap: Snap[] }
  | { t: 'battleEnd'; battleId: string; winner: Side; youWon: boolean; reason: string; reward: BattleReward | null; profile: Profile };

export type { Unit };
