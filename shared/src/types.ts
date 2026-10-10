export type Rarity = 'common' | 'rare' | 'epic';
export type Side = 'A' | 'B';

export interface AbilityRef { id: string; params?: Record<string, number> }

export interface CardDef {
  id: string;
  name: string;
  rarity: Rarity;
  hp: number;
  atk: number;
  shield: number;
  ability?: AbilityRef;
  desc?: string;
  /** آدرس عکس آپلودشده از پنل مدیریت (اختیاری) */
  image?: string;
}

export interface SoloStage {
  name: string;
  ai: 'random' | 'smart';
  deck: [string, number][];
}

export interface GameConfig {
  turnSeconds: number;
  maxRounds: number;
  startingDeck: string[];
  levelScale: { hp: number; atk: number; shield: number };
  cards: CardDef[];
  upgrade: { maxLevel: number; levels: { copies: number; coins: number }[] };
  xpPerLevel: number[];
  box: {
    slots: number;
    durationSeconds: number;
    coins: [number, number];
    xp: [number, number];
    cardChance: Record<Rarity, number>;
    cardCountRange: [number, number];
  };
  solo: { stages: SoloStage[] };
}

/** Fully resolved fighter used by the engine (level already applied). */
export interface UnitInit {
  cardId: string;
  name: string;
  hp: number;
  atk: number;
  shield: number;
  ability?: AbilityRef;
  level?: number;
}

export interface Unit extends UnitInit {
  uid: string;
  side: Side;
  slot: number;
  maxHp: number;
  maxShield: number;
  alive: boolean;
  abilityUsed: boolean;
}

export type BattleEvent =
  | { type: 'turn'; uid: string; round: number }
  | { type: 'attack'; from: string; to: string; dmg: number; shieldLost: number; hpLost: number }
  | { type: 'heal'; uid: string; amount: number }
  | { type: 'shield'; uid: string; amount: number }
  | { type: 'death'; uid: string }
  | { type: 'revive'; uid: string; hp: number }
  | { type: 'end'; winner: Side; reason: 'kills' | 'round_cap' };

export interface BattleState {
  units: Unit[];
  order: string[];
  cursor: number;
  round: number;
  current: { uid: string; attacksLeft: number } | null;
  over: boolean;
  winner: Side | null;
  maxRounds: number;
}
