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
    if (c.levels !== undefined && (!Array.isArray(c.levels) || c.levels.length > 20 || c.levels.some((l) => !l || !isNum(l.hp, 1) || !isNum(l.atk) || !isNum(l.shield)))) bad(`آمار لول‌های ${c.id} نامعتبر است`);
    if (c.image !== undefined && (typeof c.image !== 'string' || !/^\/uploads\/cards\/[a-z0-9_]+\.(png|jpg|webp)(\?v=\d+)?$/.test(c.image))) bad(`آدرس عکس ${c.id} نامعتبر است`);
  }
  if (!Array.isArray(cfg.startingDeck) || cfg.startingDeck.length !== 3 || new Set(cfg.startingDeck).size !== 3) bad('ترکیب اولیه باید ۳ کارت متفاوت باشد');
  for (const id of cfg.startingDeck) if (!ids.has(id)) bad(`ترکیب اولیه: کارت ناشناخته ${id}`);
  if (cfg.fees && (!Number.isInteger(cfg.fees.solo) || !Number.isInteger(cfg.fees.multi) || cfg.fees.solo < 0 || cfg.fees.multi < 0 || cfg.fees.solo > 100000 || cfg.fees.multi > 100000)) bad('هزینه‌ی ورود باید عدد صحیح بین ۰ و ۱۰۰٬۰۰۰ باشد');
  const up = cfg.upgrade;
  if (!up || !isNum(up.maxLevel, 2) || !up.byRarity) bad('جدول ارتقا نامعتبر است');
  for (const r of ['common', 'rare', 'epic'] as const) {
    const rows = up.byRarity[r];
    if (!Array.isArray(rows) || rows.length !== up.maxLevel - 1) bad('جدول ارتقا برای هر نوع کارت باید دقیقاً (حداکثر لول - ۱) ردیف داشته باشد');
    for (const l of rows) if (!isNum(l.copies, 1) || !isNum(l.coins)) bad('ردیف جدول ارتقا نامعتبر است');
  }
  if (!Array.isArray(cfg.xpPerLevel) || cfg.xpPerLevel.length < 1 || cfg.xpPerLevel.some((x) => !isNum(x, 1))) bad('جدول XP نامعتبر است');
  const b = cfg.box;
  if (!b || !isNum(b.slots, 1) || !b.types || !b.drops) bad('تنظیمات جعبه نامعتبر است');
  for (const t of ['bronze', 'silver', 'gold'] as const) {
    const bt = b.types[t];
    if (!bt || typeof bt.name !== 'string' || !bt.name.trim() || !isNum(bt.durationSeconds, 0) || !isRange(bt.coins) || !isRange(bt.xp) || !isRange(bt.cardCountRange)) bad(`تنظیمات جعبه‌ی ${t} نامعتبر است`);
    const cc = bt.cardChance;
    if (!cc || !isNum(cc.common) || !isNum(cc.rare) || !isNum(cc.epic) || cc.common + cc.rare + cc.epic > 1.0001) bad(`مجموع شانس کارت جعبه‌ی ${bt.name} نباید بیشتر از ۱۰۰٪ باشد`);
    for (const r of ['common', 'rare', 'epic'] as const) {
      if (cc[r] > 0 && !cfg.cards.some((c) => c.rarity === r)) bad(`جعبه‌ی ${bt.name}: برای نادری ${r} شانس گذاشته‌ای ولی کارتی از آن نیست`);
    }
  }
  const d = b.drops;
  if (!Array.isArray(d.soloByPit) || d.soloByPit.length < 1 || d.soloByPit.some((t) => !['bronze', 'silver', 'gold'].includes(t))) bad('جعبه‌ی جایزه‌ی گودال‌ها نامعتبر است');
  const mc = d.multiChance;
  if (!mc || !isNum(mc.bronze) || !isNum(mc.silver) || !isNum(mc.gold) || mc.bronze + mc.silver + mc.gold <= 0) bad('شانس جعبه‌ی مولتی‌پلیر نامعتبر است');
  if (cfg.ui?.banner !== undefined && !/^\/uploads\/banner\.(png|jpg|webp)(\?v=\d+)?$/.test(cfg.ui.banner)) bad('آدرس بنر نامعتبر است');
  if (!cfg.solo || !Array.isArray(cfg.solo.pits) || cfg.solo.pits.length < 1) bad('حداقل یک گودال سولو لازم است');
  for (const pit of cfg.solo.pits) {
    if (!pit || !Array.isArray(pit.stages) || pit.stages.length < 1) bad('هر گودال حداقل یک لول لازم دارد');
    for (const st of pit.stages) {
      if (!['random', 'smart'].includes(st.ai) || !Array.isArray(st.deck) || st.deck.length !== 3) bad('لول سولو نامعتبر است');
      for (const [id, lvl] of st.deck) {
        if (!ids.has(id)) bad(`سولو: کارت ناشناخته ${id}`);
        if (!Number.isInteger(lvl) || lvl < 1 || lvl > up.maxLevel) bad(`سولو: لول نامعتبر برای ${id}`);
      }
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

/**
 * کانفیگ نهایی = تنظیمات ویرایش‌شده از پنل مدیریت (در پوشه‌ی داده، با آپدیت پاک نمی‌شود) روی پایه‌ی کانفیگ داخل کد.
 * اگر فایل ویرایش‌شده نبود یا بعد از تغییر ساختار نامعتبر شد، بخش‌های جدید از پایه گرفته می‌شود.
 */
export function loadConfigWithOverride(overridePath: string, basePath = CONFIG_PATH): GameConfig {
  const base = loadConfig(basePath);
  let raw: any;
  try { raw = JSON.parse(readFileSync(overridePath, 'utf8')); } catch { return base; }
  const merged: any = { ...raw };
  for (const k of Object.keys(base) as (keyof GameConfig)[]) if (merged[k] === undefined) merged[k] = base[k];
  // جدول ارتقای قدیمی (یک جدول برای همه) → همان برای هر سه نوع کارت
  if (!merged.upgrade?.byRarity) {
    const lv = merged.upgrade?.levels;
    merged.upgrade = Array.isArray(lv) ? { maxLevel: merged.upgrade.maxLevel, byRarity: { common: lv, rare: lv, epic: lv } } : base.upgrade;
  }
  // ساختار قدیمی جعبه (بدون types) → جعبه‌های جدید از پایه
  if (!merged.box?.types) merged.box = base.box;
  // آمار هر لول کارت: اگر ذخیره‌ی قدیمی بود (بدون levels): از رشد درصدی قدیمی بساز یا از کارت هم‌شناسه‌ی پایه بگیر
  const ls = raw.levelScale;
  merged.cards = (merged.cards ?? []).map((c: any) => {
    if (c.levels) return c;
    const b = base.cards.find((x) => x.id === c.id);
    if (ls) {
      const maxL = merged.upgrade?.maxLevel ?? base.upgrade.maxLevel;
      const levels = Array.from({ length: maxL - 1 }, (_, i) => { const k = i + 1; return { hp: Math.round(c.hp * (1 + ls.hp * k)), atk: Math.round(c.atk * (1 + ls.atk * k)), shield: Math.round(c.shield * (1 + ls.shield * k)) }; });
      return { ...c, levels };
    }
    return b?.levels ? { ...c, levels: b.levels } : c;
  });
  delete merged.levelScale;
  // ساختار قدیمی سولو (stages) → گودال‌های جدید از پایه
  if (!merged.solo?.pits) merged.solo = base.solo;
  try { return validateConfig(merged as GameConfig); } catch (e) {
    console.warn(`[config] تنظیمات ذخیره‌شده نامعتبر است (${(e as Error).message}) و کانفیگ پیش‌فرض استفاده شد.`);
    return base;
  }
}
