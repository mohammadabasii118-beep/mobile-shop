export type Rarity = 'common' | 'rare' | 'epic';
export type Side = 'A' | 'B';

export interface AbilityRef { id: string; params?: Record<string, number> }

/** آمار یک کارت در یک لول */
export interface CardStats { hp: number; atk: number; shield: number }

export type BoxType = 'bronze' | 'silver' | 'gold';
export const BOX_TYPES: BoxType[] = ['bronze', 'silver', 'gold'];

/** محتوای یک نوع جعبه */
export interface BoxTypeCfg {
  name: string;
  durationSeconds: number;
  coins: [number, number];
  xp: [number, number];
  cardCountRange: [number, number];
  cardChance: Record<Rarity, number>;
}

export interface CardDef {
  id: string;
  name: string;
  rarity: Rarity;
  hp: number;
  atk: number;
  shield: number;
  /** آمار لول ۲ به بعد (اندیس ۰ = لول ۲). اگر کم باشد، آخرین ردیف برای لول‌های بالاتر هم استفاده می‌شود. */
  levels?: CardStats[];
  ability?: AbilityRef;
  desc?: string;
  /** آدرس عکس آپلودشده از پنل مدیریت (اختیاری) */
  image?: string;
}

/** یک لولِ سولو: دک ربات (کارت، لول) و هوش آن */
export interface SoloStage {
  ai: 'random' | 'smart';
  deck: [string, number][];
}

/** یک گودال: چند لول پشت‌سرهم */
export interface SoloPit {
  stages: SoloStage[];
}

export interface GameConfig {
  turnSeconds: number;
  maxRounds: number;
  startingDeck: string[];
  /** هزینه‌ی ورود به نبرد (سکه) */
  fees?: { solo: number; multi: number };
  cards: CardDef[];
  upgrade: { maxLevel: number; levels: { copies: number; coins: number }[] };
  xpPerLevel: number[];
  box: {
    slots: number;
    types: Record<BoxType, BoxTypeCfg>;
    /** کدام جعبه جایزه‌ی برد است: سولو بر اساس گودال، مولتی‌پلیر با شانس (وزن) */
    drops: { soloByPit: BoxType[]; multiChance: Record<BoxType, number> };
  };
  solo: { pits: SoloPit[] };
  /** ظاهر: بنر بالای صفحه‌ی اصلی (آدرس عکس آپلودشده از پنل مدیریت) */
  ui?: { banner?: string };
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
  /** طرفی که اول شروع کرد */
  firstSide: Side;
  /** نوبت بعدی مال کدام طرف است (همیشه یکی‌درمیان) */
  nextSide: Side;
  /** آخرین جایگاهِ کارتی که هر طرف بازی کرده (-1 = هنوز هیچ) */
  lastSlot: Record<Side, number>;
  /** تعداد نوبت‌های انجام‌شده */
  turns: number;
  round: number;
  current: { uid: string; attacksLeft: number } | null;
  over: boolean;
  winner: Side | null;
  maxRounds: number;
}
