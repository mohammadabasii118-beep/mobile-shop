export type Rarity = 'common' | 'rare' | 'epic';
export type Side = 'A' | 'B';

export interface AbilityRef { id: string }

/** آمار یک کارت در یک لول */
export interface CardStats { hp: number; atk: number; shield: number; /** عددهای توانایی در این لول (مثلاً { rage: 32 }) */ params?: Record<string, number> }

export type BoxType = 'bronze' | 'silver' | 'gold';
export const BOX_TYPES: BoxType[] = ['bronze', 'silver', 'gold'];

/** محتوای یک نوع جعبه */
export interface BoxTypeCfg {
  name: string;
  durationSeconds: number;
  coins: [number, number];
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
  /** عددهای توانایی‌ها در لول ۱؛ برای لول‌های بعد در levels[i].params می‌آید */
  params?: Record<string, number>;
  /** توانایی‌ها (هر کارت می‌تواند چند توانایی داشته باشد) */
  abilities?: AbilityRef[];
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

/** فروشگاه: یک پیشنهاد کارت روزانه (cardId خالی = اسلات خاموش). قیمت ۰ یعنی با آن ارز نمی‌شود خرید. */
export interface ShopCardOffer { cardId: string; count: number; priceGems: number; priceCoins: number }
export interface CoinPack { id: string; coins: number; gems: number }
export interface GemPack { id: string; gems: number; toman: number }
export interface ShopCfg {
  /** آدرس درگاه پرداخت (دستی از پنل)؛ جای‌نگهدارها: {order} {amount} {gems} {user}. به بازیکن‌ها فرستاده نمی‌شود، فقط موقع ثبت سفارش. */
  gatewayUrl?: string;
  cards: ShopCardOffer[];
  coinPacks: CoinPack[];
  gemPacks: GemPack[];
}

export interface GameConfig {
  /** نسخه‌ی محتوای کارت‌ها/ترکیب اولیه/سولو: اگر عوض شود، تنظیمات ذخیره‌شده‌ی قدیمی این بخش‌ها با نسخه‌ی جدید جایگزین می‌شود */
  contentVersion?: number;
  turnSeconds: number;
  maxRounds: number;
  startingDeck: string[];
  /** هزینه‌ی ورود به نبرد (سکه) */
  fees?: { solo: number; multi: number };
  /** عضویت اجباری کانال تلگرام: فقط یک‌بار و با بررسی واقعی (ربات باید ادمین کانال باشد) */
  channel?: { username: string; required: boolean };
  cards: CardDef[];
  /** هزینه‌ی ارتقا برای هر نوع کارت (ساده/معمولی/کمیاب)؛ ردیف i = از لول i+1 به i+2 */
  upgrade: { maxLevel: number; byRarity: Record<Rarity, { copies: number; coins: number; /** XP که بازیکن با همین ارتقا می‌گیرد */ xp: number }[]> };
  xpPerLevel: number[];
  shop: ShopCfg;
  /** جایزه‌ی هر برد در بخش آنلاین (سولو فقط جعبه می‌دهد) و کاپ‌ها */
  online: { winCoins: number; winXp: number; trophiesWin: number; trophiesLoss: number };
  box: {
    slots: number;
    types: Record<BoxType, BoxTypeCfg>;
    /** شانس (٪) دریافت هر نوع جعبه با هر برد، برای سولو و آنلاین. مجموع حداکثر ۱۰۰؛ باقی‌مانده = این بار جعبه‌ای نمی‌آید. */
    drops: { solo: Record<BoxType, number>; multi: Record<BoxType, number> };
  };
  solo: { pits: SoloPit[] };
  /** ظاهر: بنر بالای صفحه‌ی اصلی (آدرس عکس آپلودشده از پنل مدیریت) */
  ui?: { banner?: string; /** پس‌زمینه‌ی بازی (عکس آپلودشده) */ background?: string; /** متن پیام اول /start ربات */ welcome?: string };
}

/** Fully resolved fighter used by the engine (level already applied). */
export interface UnitInit {
  cardId: string;
  name: string;
  hp: number;
  atk: number;
  shield: number;
  abilities?: AbilityRef[];
  /** عددهای توانایی‌ها در همین لول */
  params?: Record<string, number>;
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
