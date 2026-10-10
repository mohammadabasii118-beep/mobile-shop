import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ABILITIES, type GameConfig } from '@game/shared';

export const CONFIG_PATH = process.env.CONFIG_PATH ?? fileURLToPath(new URL('../../shared/config/game.json', import.meta.url));

const isNum = (v: unknown, min = 0) => typeof v === 'number' && Number.isFinite(v) && v >= min;
const isRange = (v: unknown) => Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]) && v[0] <= v[1];

/** کانفیگ را بررسی می‌کند؛ اگر مشکل داشت یک Error با پیام فارسی می‌اندازد. */
export function validateConfig(cfg: GameConfig): GameConfig {
  const bad = (m: string): never => { throw new Error(m); };
  if (!cfg || typeof cfg !== 'object') bad('کانفیگ نامعتبر است');
  if (!isNum(cfg.turnSeconds, 1)) bad('turnSeconds نامعتبر است');
  if (!isNum(cfg.maxRounds, 1)) bad('maxRounds نامعتبر است');
  if (!Array.isArray(cfg.cards) || cfg.cards.length < 3) bad('حداقل ۳ کارت لازم است');
  const ids = new Set<string>();
  for (const c of cfg.cards) {
    if (!c || typeof c.id !== 'string' || !/^[a-z0-9_]{1,32}$/.test(c.id)) bad(`شناسه‌ی کارت نامعتبر: ${c?.id} (فقط حروف کوچک انگلیسی، عدد و _)`);
    if (ids.has(c.id)) bad(`شناسه‌ی تکراری: ${c.id}`);
    ids.add(c.id);
    if (typeof c.name !== 'string' || !c.name.trim() || c.name.length > 40) bad(`نام کارت ${c.id} نامعتبر است`);
    if (!['common', 'rare', 'epic'].includes(c.rarity)) bad(`نادری ${c.id} نامعتبر است`);
    if (!isNum(c.hp, 1) || !isNum(c.atk, 0) || !isNum(c.shield, 0)) bad(`آمار ${c.id} نامعتبر است`);
    if (c.ability && !ABILITIES[c.ability.id]) bad(`توانایی ناشناخته: ${c.ability.id}`);
    if (c.image !== undefined && (typeof c.image !== 'string' || !/^\/uploads\/cards\/[a-z0-9_]+\.(png|jpg|webp)(\?v=\d+)?$/.test(c.image))) bad(`آدرس عکس ${c.id} نامعتبر است`);
  }
  if (!Array.isArray(cfg.startingDeck) || cfg.startingDeck.length !== 3 || new Set(cfg.startingDeck).size !== 3) bad('دک اولیه باید ۳ کارت متفاوت باشد');
  for (const id of cfg.startingDeck) if (!ids.has(id)) bad(`دک اولیه: کارت ناشناخته ${id}`);
  if (cfg.fees && (!Number.isInteger(cfg.fees.solo) || !Number.isInteger(cfg.fees.multi) || cfg.fees.solo < 0 || cfg.fees.multi < 0 || cfg.fees.solo > 100000 || cfg.fees.multi > 100000)) bad('هزینه‌ی ورود باید عدد صحیح بین ۰ و ۱۰۰٬۰۰۰ باشد');
  const ls = cfg.levelScale;
  if (!ls || !isNum(ls.hp) || !isNum(ls.atk) || !isNum(ls.shield)) bad('levelScale نامعتبر است');
  const up = cfg.upgrade;
  if (!up || !isNum(up.maxLevel, 2) || !Array.isArray(up.levels) || up.levels.length !== up.maxLevel - 1) bad('جدول ارتقا باید دقیقاً (حداکثر لول - ۱) ردیف داشته باشد');
  for (const l of up.levels) if (!isNum(l.copies, 1) || !isNum(l.coins)) bad('ردیف جدول ارتقا نامعتبر است');
  if (!Array.isArray(cfg.xpPerLevel) || cfg.xpPerLevel.length < 1 || cfg.xpPerLevel.some((x) => !isNum(x, 1))) bad('جدول XP نامعتبر است');
  const b = cfg.box;
  if (!b || !isNum(b.slots, 1) || !isNum(b.durationSeconds, 0) || !isRange(b.coins) || !isRange(b.xp) || !isRange(b.cardCountRange)) bad('تنظیمات جعبه نامعتبر است');
  const cc = b.cardChance;
  if (!cc || !isNum(cc.common) || !isNum(cc.rare) || !isNum(cc.epic) || cc.common + cc.rare + cc.epic > 1.0001) bad('مجموع شانس کارت نباید بیشتر از ۱۰۰٪ باشد');
  for (const r of ['common', 'rare', 'epic'] as const) {
    if (cc[r] > 0 && !cfg.cards.some((c) => c.rarity === r)) bad(`برای نادری ${r} شانس گذاشته‌ای ولی کارتی از آن نیست`);
  }
  if (cfg.ui?.banner !== undefined && !/^\/uploads\/banner\.(png|jpg|webp)(\?v=\d+)?$/.test(cfg.ui.banner)) bad('آدرس بنر نامعتبر است');
  if (!cfg.solo || !Array.isArray(cfg.solo.stages) || cfg.solo.stages.length < 1) bad('حداقل یک مرحله‌ی سولو لازم است');
  for (const st of cfg.solo.stages) {
    if (typeof st.name !== 'string' || !['random', 'smart'].includes(st.ai) || !Array.isArray(st.deck) || st.deck.length !== 3) bad('مرحله‌ی سولو نامعتبر است');
    for (const [id, lvl] of st.deck) {
      if (!ids.has(id)) bad(`مرحله‌ی سولو: کارت ناشناخته ${id}`);
      if (!Number.isInteger(lvl) || lvl < 1 || lvl > up.maxLevel) bad(`مرحله‌ی سولو: لول نامعتبر برای ${id}`);
    }
  }
  return cfg;
}

export function loadConfig(path = CONFIG_PATH): GameConfig {
  return validateConfig(JSON.parse(readFileSync(path, 'utf8')) as GameConfig);
}

/** ذخیره‌ی اتمیک در فایل (اول فایل موقت، بعد جایگزینی) */
export function saveConfig(cfg: GameConfig, path = CONFIG_PATH) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n');
  renameSync(tmp, path);
}
