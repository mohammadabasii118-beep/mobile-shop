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
  if (cfg.chatPhrases !== undefined && (!Array.isArray(cfg.chatPhrases) || cfg.chatPhrases.length > 16 || cfg.chatPhrases.some((x) => typeof x !== 'string' || !x.trim() || x.length > 24))) bad('پیام‌های چت: حداکثر ۱۶ پیام، هر کدام ۱ تا ۲۴ نویسه');
  if (!Number.isInteger(cfg.deckSize) || cfg.deckSize < 3 || cfg.deckSize > 5) bad('تعداد کارت ترکیب باید بین ۳ و ۵ باشد');
  if (!Array.isArray(cfg.cards) || cfg.cards.length < 3) bad('حداقل ۳ کارت لازم است');
  const ids = new Set<string>();
  for (const c of cfg.cards) {
    if (!c || typeof c.id !== 'string' || !/^[a-z0-9_]{1,32}$/.test(c.id)) bad(`شناسه‌ی کارت نامعتبر: ${c?.id} (فقط حروف کوچک انگلیسی، عدد و _)`);
    if (ids.has(c.id)) bad(`شناسه‌ی تکراری: ${c.id}`);
    ids.add(c.id);
    if (typeof c.name !== 'string' || !c.name.trim() || c.name.length > 40) bad(`نام کارت ${c.id} نامعتبر است`);
    if (!['common', 'rare', 'epic'].includes(c.rarity)) bad(`نادری ${c.id} نامعتبر است`);
    if (!isNum(c.hp, 1) || !isNum(c.atk, 0) || !isNum(c.shield, 0)) bad(`آمار ${c.id} نامعتبر است`);
    if (c.chargeAttacks !== undefined && (!Number.isInteger(c.chargeAttacks) || c.chargeAttacks < 0 || c.chargeAttacks > 20)) bad(`تعداد حمله‌ی قدرت ویژه‌ی ${c.id} باید عدد صحیح ۰ تا ۲۰ باشد`);
    for (const a of c.abilities ?? []) if (!a || !ABILITIES[a.id]) bad(`توانایی ناشناخته: ${a?.id}`);
    const okParams = (p: unknown) => p === undefined || (!!p && typeof p === 'object' && Object.values(p as object).every((v) => isNum(v)));
    if (!okParams(c.params) || !okParams(c.special) || (c.levels ?? []).some((l) => !okParams(l?.params) || !okParams(l?.special))) bad(`عددهای توانایی ${c.id} نامعتبر است`);
    if (c.levels !== undefined && (!Array.isArray(c.levels) || c.levels.length > 20 || c.levels.some((l) => !l || !isNum(l.hp, 1) || !isNum(l.atk) || !isNum(l.shield)))) bad(`آمار لول‌های ${c.id} نامعتبر است`);
    if (c.image !== undefined && (typeof c.image !== 'string' || !/^\/uploads\/cards\/[a-z0-9_]+\.(png|jpg|webp)(\?v=\d+)?$/.test(c.image))) bad(`آدرس عکس ${c.id} نامعتبر است`);
  }
  if (!Array.isArray(cfg.startingDeck) || cfg.startingDeck.length < 3 || cfg.startingDeck.length > cfg.deckSize || new Set(cfg.startingDeck).size !== cfg.startingDeck.length) bad('ترکیب اولیه باید ۳ تا ۵ کارت متفاوت باشد');
  for (const id of cfg.startingDeck) if (!ids.has(id)) bad(`ترکیب اولیه: کارت ناشناخته ${id}`);
  if (cfg.fees && (!Number.isInteger(cfg.fees.solo) || !Number.isInteger(cfg.fees.multi) || cfg.fees.solo < 0 || cfg.fees.multi < 0 || cfg.fees.solo > 100000 || cfg.fees.multi > 100000)) bad('هزینه‌ی ورود باید عدد صحیح بین ۰ و ۱۰۰٬۰۰۰ باشد');
  if (cfg.channel && (typeof cfg.channel.required !== 'boolean' || !/^[A-Za-z0-9_]{4,32}$/.test(cfg.channel.username ?? ''))) bad('آیدی کانال نامعتبر است (بدون @، فقط حروف انگلیسی، عدد و _)');
  const up = cfg.upgrade;
  if (!up || !isNum(up.maxLevel, 2) || !up.byRarity) bad('جدول ارتقا نامعتبر است');
  for (const r of ['common', 'rare', 'epic'] as const) {
    const rows = up.byRarity[r];
    if (!Array.isArray(rows) || rows.length !== up.maxLevel - 1) bad('جدول ارتقا برای هر نوع کارت باید دقیقاً (حداکثر لول - ۱) ردیف داشته باشد');
    for (const l of rows) if (!isNum(l.copies, 1) || !isNum(l.coins) || !isNum(l.xp)) bad('ردیف جدول ارتقا نامعتبر است');
  }
  if (!Array.isArray(cfg.xpPerLevel) || cfg.xpPerLevel.length < 1 || cfg.xpPerLevel.some((x) => !isNum(x, 1))) bad('جدول XP نامعتبر است');
  const sh = cfg.shop;
  if (!sh || !Array.isArray(sh.cards) || sh.cards.length !== 6 || !Array.isArray(sh.coinPacks) || !Array.isArray(sh.gemPacks)) bad('تنظیمات فروشگاه نامعتبر است (باید دقیقاً ۶ اسلات کارت داشته باشد)');
  if (!sh.card || typeof sh.card.enabled !== 'boolean' || typeof sh.card.number !== 'string' || typeof sh.card.holder !== 'string' || typeof sh.card.bank !== 'string' || typeof sh.starsEnabled !== 'boolean') bad('تنظیمات پرداخت فروشگاه نامعتبر است');
  if (sh.card.holder.length > 60 || sh.card.bank.length > 40) bad('نام صاحب کارت یا بانک خیلی طولانی است');
  if (sh.card.enabled && !/^[0-9۰-۹\s-]{12,30}$/.test(sh.card.number.trim())) bad('شماره‌ی کارت نامعتبر است (۱۶ رقم)');
  const isInt = (v: unknown, min: number, max = 10_000_000) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
  sh.cards.forEach((o, i) => {
    if (!o || typeof o.cardId !== 'string') bad(`فروشگاه: اسلات ${i + 1} نامعتبر است`);
    if (o.cardId === '') return;
    if (!ids.has(o.cardId)) bad(`فروشگاه: کارت ناشناخته ${o.cardId}`);
    if (!isInt(o.count, 1, 999) || !isInt(o.price, 1) || (o.currency !== 'gems' && o.currency !== 'coins')) bad(`فروشگاه: تعداد، ارز یا قیمت اسلات ${i + 1} نامعتبر است (قیمت حداقل ۱)`);
  });
  const packIds = new Set<string>();
  for (const pk of [...sh.coinPacks, ...sh.gemPacks] as { id: string }[]) {
    if (!pk || typeof pk.id !== 'string' || !/^[A-Za-z0-9_]{1,24}$/.test(pk.id) || packIds.has(pk.id)) bad('فروشگاه: شناسه‌ی بسته‌ها باید یکتا باشد');
    packIds.add(pk.id);
  }
  if (sh.coinPacks.length > 12 || sh.gemPacks.length > 12) bad('فروشگاه: حداکثر ۱۲ بسته');
  for (const pk of sh.coinPacks) if (!isInt(pk.coins, 1) || !isInt(pk.price, 1, 1_000_000_000) || (pk.currency !== 'gems' && pk.currency !== 'toman')) bad('فروشگاه: بسته‌ی سکه نامعتبر است');
  for (const pk of sh.gemPacks) {
    if (!isInt(pk.gems, 1) || !isInt(pk.toman, 0, 1_000_000_000) || !isInt(pk.stars, 0, 10_000)) bad('فروشگاه: بسته‌ی الماس نامعتبر است');
    if (pk.toman === 0 && pk.stars === 0) bad('فروشگاه: هر بسته‌ی الماس حداقل یک قیمت (تومان یا استار) لازم دارد');
  }
  const on = cfg.online;
  if (!on || !isNum(on.winCoins) || !isNum(on.winXp) || !isNum(on.trophiesWin) || !isNum(on.trophiesLoss)) bad('جایزه‌ی نبرد آنلاین نامعتبر است');
  const b = cfg.box;
  if (!b || !isNum(b.slots, 1) || !b.types || !b.drops) bad('تنظیمات جعبه نامعتبر است');
  if (!b.speedup || !isNum(b.speedup.gemsPerStep) || !isNum(b.speedup.stepMinutes, 1)) bad('تنظیم باز کردن فوری جعبه نامعتبر است');
  for (const t of ['bronze', 'silver', 'gold'] as const) {
    const bt = b.types[t];
    if (!bt || typeof bt.name !== 'string' || !bt.name.trim() || !isNum(bt.durationSeconds, 0) || !bt.contents) bad(`تنظیمات جعبه‌ی ${t} نامعتبر است`);
    for (const src of ['solo', 'multi'] as const) {
      const ct = bt.contents[src];
      const where = `جعبه‌ی ${bt.name} (${src === 'solo' ? 'تک‌نفره' : 'آنلاین'})`;
      if (!ct || !isRange(ct.coins) || !isRange(ct.cardCountRange)) bad(`تنظیمات ${where} نامعتبر است`);
      const cc = ct.cardChance;
      if (!cc || !isNum(cc.common) || !isNum(cc.rare) || !isNum(cc.epic) || cc.common + cc.rare + cc.epic > 1.0001) bad(`مجموع شانس کارت ${where} نباید بیشتر از ۱۰۰٪ باشد`);
      for (const r of ['common', 'rare', 'epic'] as const) {
        if (cc[r] > 0 && !cfg.cards.some((c) => c.rarity === r)) bad(`${where}: برای نادری ${r} شانس گذاشته‌ای ولی کارتی از آن نیست`);
      }
    }
  }
  for (const mode of ['solo', 'multi'] as const) {
    const m = b.drops[mode];
    if (!m || !isNum(m.bronze) || !isNum(m.silver) || !isNum(m.gold) || m.bronze + m.silver + m.gold > 100.0001) bad(`شانس جعبه‌ی ${mode === 'solo' ? 'سولو' : 'آنلاین'}: هر عدد باید ۰ یا بیشتر و مجموعشان حداکثر ۱۰۰ باشد`);
  }
  if (cfg.ui?.banner !== undefined && !/^\/uploads\/banner\.(png|jpg|webp)(\?v=\d+)?$/.test(cfg.ui.banner)) bad('آدرس بنر نامعتبر است');
  if (cfg.ui?.background !== undefined && !/^\/uploads\/background\.(png|jpg|webp)(\?v=\d+)?$/.test(cfg.ui.background)) bad('آدرس پس‌زمینه نامعتبر است');
  if (cfg.ui?.welcome !== undefined && (typeof cfg.ui.welcome !== 'string' || cfg.ui.welcome.length > 3500)) bad('متن پیام اول باید حداکثر ۳۵۰۰ نویسه باشد');
  if (!cfg.solo || !Array.isArray(cfg.solo.pits) || cfg.solo.pits.length < 1) bad('حداقل یک گودال سولو لازم است');
  for (const pit of cfg.solo.pits) {
    if (!pit || !Array.isArray(pit.stages) || pit.stages.length < 1) bad('هر گودال حداقل یک لول لازم دارد');
    for (const st of pit.stages) {
      if (!['random', 'smart'].includes(st.ai) || !Array.isArray(st.deck) || st.deck.length < 3 || st.deck.length > cfg.deckSize) bad('لول سولو نامعتبر است');
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
  // نسخه‌ی محتوا: اگر کارت‌ها/ترکیب اولیه/سولو در کد عوض شده، نسخه‌ی ذخیره‌شده‌ی قدیمی جایگزین می‌شود (عکس کارت‌های هم‌شناسه می‌ماند)
  if ((raw.contentVersion ?? 0) < (base.contentVersion ?? 0)) {
    const oldCards: any[] = Array.isArray(raw.cards) ? raw.cards : [];
    merged.cards = base.cards.map((c) => { const o = oldCards.find((x) => x.id === c.id); return o?.image ? { ...c, image: o.image } : c; });
    merged.startingDeck = base.startingDeck;
    merged.solo = base.solo;
    merged.contentVersion = base.contentVersion;
  }
  // مهاجرت یک‌بار (rev ۲): مهلت نوبت ۱۵ ثانیه، ترکیب ۵کارتی، قدرت ویژه‌ی کارت‌ها و لول‌های سولوی ۳/۴/۵ کارتی
  if ((raw.rev ?? 0) < 2) {
    merged.turnSeconds = base.turnSeconds;
    merged.deckSize = base.deckSize;
    merged.solo = base.solo;
    merged.cards = (merged.cards ?? []).map((c: any) => (c.chargeAttacks === undefined ? { ...c, chargeAttacks: base.cards.find((x) => x.id === c.id)?.chargeAttacks ?? 0 } : c));
    merged.rev = 2;
  }
  for (const k of Object.keys(base) as (keyof GameConfig)[]) if (merged[k] === undefined) merged[k] = base[k];
  // جدول ارتقای قدیمی (یک جدول برای همه) → همان برای هر سه نوع کارت
  if (!merged.upgrade?.byRarity) {
    const lv = merged.upgrade?.levels;
    merged.upgrade = Array.isArray(lv) ? { maxLevel: merged.upgrade.maxLevel, byRarity: { common: lv, rare: lv, epic: lv } } : base.upgrade;
  }
  // فروشگاه: نسخه‌ی قدیمی (درگاه آدرسی) → روش‌های پرداخت جدید؛ بسته‌های الماس بدون قیمت استار از پایه (هم‌شناسه) یا ۰
  if (!merged.shop) merged.shop = base.shop;
  else {
    delete merged.shop.gatewayUrl;
    // قیمت دوگانه‌ی قدیمی → یک ارز و یک قیمت (الماس اگر بود، وگرنه سکه)
    merged.shop.cards = (merged.shop.cards ?? base.shop.cards).map((o: any) => (o?.currency ? o : { cardId: o.cardId, count: o.count, currency: o.priceGems > 0 ? 'gems' : 'coins', price: o.priceGems > 0 ? o.priceGems : (o.priceCoins || 1) }));
    merged.shop.coinPacks = (merged.shop.coinPacks ?? base.shop.coinPacks).map((k: any) => (k?.currency ? k : { id: k.id, coins: k.coins, currency: 'gems', price: k.gems || 1 }));
    merged.shop.card = merged.shop.card ?? base.shop.card;
    merged.shop.starsEnabled = merged.shop.starsEnabled ?? base.shop.starsEnabled;
    merged.shop.gemPacks = (merged.shop.gemPacks ?? base.shop.gemPacks).map((g: any) => (typeof g?.stars === 'number' ? g : { ...g, stars: base.shop.gemPacks.find((x) => x.id === g.id)?.stars ?? 0 }));
  }
  // جایزه‌ی آنلاین (جدید): اگر نبود از پایه
  if (!merged.online) merged.online = base.online;
  // XP دیگر از جعبه نمی‌آید (حذف از نوع‌ها) و هر ردیف ارتقا مقدار XP دارد (اگر نبود از پایه‌ی همان نوع و ردیف)
  for (const t of Object.values(merged.box?.types ?? {}) as any[]) {
    delete t.xp;
    // محتوای جعبه قبلاً یکی بود → حالا برای تک‌نفره و آنلاین جدا؛ مقدار قدیمی برای هر دو
    if (!t.contents && t.coins) {
      const cont = { coins: t.coins, cardCountRange: t.cardCountRange, cardChance: t.cardChance };
      t.contents = { solo: JSON.parse(JSON.stringify(cont)), multi: JSON.parse(JSON.stringify(cont)) };
      delete t.coins; delete t.cardCountRange; delete t.cardChance;
    }
  }
  if (merged.box && !merged.box.speedup) merged.box.speedup = base.box.speedup;
  for (const r of ['common', 'rare', 'epic'] as const) {
    const rows = merged.upgrade?.byRarity?.[r];
    if (Array.isArray(rows)) merged.upgrade.byRarity[r] = rows.map((row: any, i: number) => (typeof row?.xp === 'number' ? row : { ...row, xp: base.upgrade.byRarity[r][i]?.xp ?? 0 }));
  }
  // ساختار قدیمی جعبه (بدون types) → جعبه‌های جدید از پایه
  if (!merged.box?.types) merged.box = base.box;
  // شانس جعبه‌ی جایزه: شکل قدیمی (soloByPit/multiChance) → شانس جدید؛ مولتی از وزن‌های قبلی (به ۱۰۰ نرمال)، سولو از پایه
  if (!merged.box.drops?.solo || !merged.box.drops?.multi) {
    const mc = merged.box.drops?.multiChance;
    const sum = mc ? mc.bronze + mc.silver + mc.gold : 0;
    merged.box = { ...merged.box, drops: {
      solo: base.box.drops.solo,
      multi: sum > 0 ? { bronze: Math.round((mc.bronze / sum) * 100), silver: Math.round((mc.silver / sum) * 100), gold: Math.round((mc.gold / sum) * 100) } : base.box.drops.multi,
    } };
  }
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
