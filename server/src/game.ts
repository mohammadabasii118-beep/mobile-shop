import { boxSpeedupCost, resolveCard, type BattleReward, type BoxContents, type BoxSource, type BoxType, type BoxView, type CardView, type GameConfig, type Profile, type Rarity, type UnitInit } from '@game/shared';
import type { Db } from './db';
import type { TgUser } from './auth';

export class GameError extends Error {}

export interface Deps { db: Db; cfg: GameConfig; now: () => number; rng: () => number; isAdmin?: (tgId: number) => boolean; channelRequired?: (tgId: number) => boolean }

const randInt = (rng: () => number, [a, b]: [number, number]) => a + Math.floor(rng() * (b - a + 1));

export class Game {
  constructor(private d: Deps) {}
  get cfg() { return this.d.cfg; }

  /**
   * هم‌خوان‌کردن کارت‌های همه‌ی بازیکن‌ها با لیست کارت‌های فعلی (موقع بالا آمدن سرور):
   * کارت‌هایی که دیگر وجود ندارند پاک می‌شوند؛ اگر ترکیب کسی ناقص شد، با کارت‌های ترکیب اولیه کامل می‌شود.
   */
  migrateCards() {
    const { db, cfg } = this.d;
    const known = new Set(cfg.cards.map((c) => c.id));
    const users = db.prepare('SELECT id FROM users').all() as { id: number }[];
    for (const { id } of users) {
      const owned = (db.prepare('SELECT card_id FROM user_cards WHERE user_id = ?').all(id) as any[]).map((r) => r.card_id as string);
      const deck = (db.prepare('SELECT card_id FROM deck WHERE user_id = ? ORDER BY slot').all(id) as any[]).map((r) => r.card_id as string);
      const stale = owned.some((c) => !known.has(c));
      if (!stale && deck.length === 3 && deck.every((c) => known.has(c))) continue;
      for (const c of owned) if (!known.has(c)) db.prepare('DELETE FROM user_cards WHERE user_id = ? AND card_id = ?').run(id, c);
      const have = new Set(owned.filter((c) => known.has(c)));
      let ids = deck.filter((c) => have.has(c));
      if (ids.length < 3) {
        for (const c of cfg.startingDeck) if (!have.has(c)) { db.prepare('INSERT INTO user_cards (user_id, card_id) VALUES (?,?)').run(id, c); have.add(c); }
        ids = [...ids, ...[...have].filter((c) => !ids.includes(c))].slice(0, 3);
      }
      db.prepare('DELETE FROM deck WHERE user_id = ?').run(id);
      ids.forEach((c, slot) => db.prepare('INSERT INTO deck (user_id, slot, card_id) VALUES (?,?,?)').run(id, slot, c));
    }
  }

  // ---------- کاربر ----------
  upsertUser(u: TgUser): number {
    const { db } = this.d;
    const row = db.prepare('SELECT id, banned FROM users WHERE tg_id = ?').get(u.tgId) as { id: number; banned: number } | undefined;
    if (row?.banned) throw new GameError('حساب شما مسدود شده است');
    if (row) {
      db.prepare('UPDATE users SET name = ?, avatar = ? WHERE id = ?').run(u.name, u.avatar, row.id);
      return row.id;
    }
    const res = db.prepare('INSERT INTO users (tg_id, name, avatar, created_at) VALUES (?,?,?,?)').run(u.tgId, u.name, u.avatar, this.d.now());
    const id = Number(res.lastInsertRowid);
    this.d.cfg.startingDeck.forEach((cardId, slot) => {
      db.prepare('INSERT INTO user_cards (user_id, card_id) VALUES (?,?)').run(id, cardId);
      db.prepare('INSERT INTO deck (user_id, slot, card_id) VALUES (?,?,?)').run(id, slot, cardId);
    });
    return id;
  }

  profile(userId: number): Profile {
    const { db, cfg } = this.d;
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!u) throw new GameError('کاربر پیدا نشد');
    const cards = (db.prepare('SELECT card_id, level, copies FROM user_cards WHERE user_id = ?').all(userId) as any[])
      .map((r): CardView => ({ id: r.card_id, level: r.level, copies: r.copies }));
    const deck = (db.prepare('SELECT card_id FROM deck WHERE user_id = ? ORDER BY slot').all(userId) as any[]).map((r) => r.card_id as string);
    const now = this.d.now();
    const rows = db.prepare('SELECT slot, state, ready_at, type, source FROM boxes WHERE user_id = ? ORDER BY slot').all(userId) as any[];
    const boxes = rows.map((r): BoxView => {
      const type = this.boxType(r.type);
      const source: BoxSource = r.source === 'solo' ? 'solo' : 'multi';
      const totalMs = cfg.box.types[type].durationSeconds * 1000;
      if (r.state === 'opening') {
        const remainingMs = Math.max(0, r.ready_at - now);
        return { slot: r.slot, type, source, state: remainingMs === 0 ? 'ready' : 'opening', remainingMs, totalMs };
      }
      return { slot: r.slot, type, source, state: 'locked', remainingMs: totalMs, totalMs };
    });
    return {
      id: u.id, name: u.name, avatar: u.avatar, level: u.level, xp: u.xp,
      xpNeeded: this.xpNeeded(u.level), coins: u.coins, gems: u.gems ?? 0, trophies: u.trophies ?? 0, wins: u.wins, losses: u.losses,
      soloStage: u.solo_stage, cards, deck, boxes, isAdmin: this.d.isAdmin?.(u.tg_id) ?? false,
      channelOk: this.d.channelRequired?.(u.tg_id) ? !!u.channel_ok : true,
    };
  }

  private xpNeeded(level: number): number {
    const t = this.d.cfg.xpPerLevel;
    return t[Math.min(level - 1, t.length - 1)];
  }

  /** عضویت کانال تأیید شد؛ دیگر هیچ‌وقت نشان داده نمی‌شود */
  setChannelOk(userId: number) {
    this.d.db.prepare('UPDATE users SET channel_ok = 1 WHERE id = ?').run(userId);
  }

  // ---------- هزینه‌ی ورود ----------
  /** سکه را کم می‌کند؛ اگر کافی نبود چیزی کم نمی‌شود و false برمی‌گردد */
  chargeEntry(userId: number, fee: number): boolean {
    if (fee <= 0) return true;
    return Number(this.d.db.prepare('UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?').run(fee, userId, fee).changes) === 1;
  }
  refund(userId: number, fee: number) {
    if (fee > 0) this.d.db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(fee, userId);
  }
  canAfford(userId: number, fee: number): boolean {
    return fee <= 0 || (this.d.db.prepare('SELECT coins FROM users WHERE id = ?').get(userId) as any).coins >= fee;
  }

  // ---------- ترکیب (۳ کارت) ----------
  setDeck(userId: number, ids: string[]) {
    if (!Array.isArray(ids) || ids.length !== 3 || new Set(ids).size !== 3) throw new GameError('ترکیب باید دقیقاً ۳ کارت متفاوت باشد');
    const { db } = this.d;
    for (const id of ids) {
      if (!db.prepare('SELECT 1 FROM user_cards WHERE user_id = ? AND card_id = ?').get(userId, id)) throw new GameError('این کارت را نداری');
    }
    db.prepare('DELETE FROM deck WHERE user_id = ?').run(userId);
    ids.forEach((id, slot) => db.prepare('INSERT INTO deck (user_id, slot, card_id) VALUES (?,?,?)').run(userId, slot, id));
  }

  deckUnits(userId: number): UnitInit[] {
    const { db, cfg } = this.d;
    const rows = db.prepare(
      'SELECT d.card_id, c.level FROM deck d JOIN user_cards c ON c.user_id = d.user_id AND c.card_id = d.card_id WHERE d.user_id = ? ORDER BY d.slot',
    ).all(userId) as any[];
    if (rows.length !== 3) throw new GameError('ترکیب کامل نیست');
    return rows.map((r) => resolveCard(cfg.cards.find((c) => c.id === r.card_id)!, r.level, cfg));
  }

  // ---------- ارتقا ----------
  upgradeCard(userId: number, cardId: string) {
    const { db, cfg } = this.d;
    const c = db.prepare('SELECT level, copies FROM user_cards WHERE user_id = ? AND card_id = ?').get(userId, cardId) as any;
    if (!c) throw new GameError('این کارت را نداری');
    if (c.level >= cfg.upgrade.maxLevel) throw new GameError('کارت در بالاترین لول است');
    const need = cfg.upgrade.byRarity[cfg.cards.find((x) => x.id === cardId)?.rarity ?? 'common'][c.level - 1];
    const coins = (db.prepare('SELECT coins FROM users WHERE id = ?').get(userId) as any).coins as number;
    if (c.copies < need.copies) throw new GameError(`تعداد کارت کافی نیست (${c.copies}/${need.copies})`);
    if (coins < need.coins) throw new GameError(`سکه کافی نیست (${coins}/${need.coins})`);
    db.prepare('UPDATE user_cards SET level = level + 1, copies = copies - ? WHERE user_id = ? AND card_id = ?').run(need.copies, userId, cardId);
    db.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').run(need.coins, userId);
    // هر ارتقا XP هم می‌دهد (مقدارش در جدول ارتقا برای هر نوع کارت و لول)
    const levelsGained = need.xp > 0 ? this.addXp(userId, need.xp) : 0;
    return { xp: need.xp, levelsGained };
  }

  // ---------- جعبه ----------
  /** نوع جعبه‌ی ذخیره‌شده؛ اگر بعداً از تنظیمات حذف شده بود برنزی */
  private boxType(t: unknown): BoxType {
    return t === 'silver' || t === 'gold' ? t : 'bronze';
  }

  /** با هر برد: جعبه‌ی جایزه با شانسِ تنظیم‌شده برای همان حالت (سولو/آنلاین)؛ null = این بار جعبه‌ای نمی‌آید */
  rewardBoxType(mode: 'solo' | 'multi'): BoxType | null {
    const chances = this.d.cfg.box.drops[mode];
    let r = this.d.rng() * 100;
    for (const t of ['bronze', 'silver', 'gold'] as BoxType[]) { if (r < chances[t]) return t; r -= chances[t]; }
    return null;
  }

  /** بعد از برد: اگه اسلات خالی بود جعبه می‌ده */
  grantBox(userId: number, type: BoxType = 'bronze', source: BoxSource = 'multi'): BattleReward {
    const { db, cfg } = this.d;
    const used = new Set((db.prepare('SELECT slot FROM boxes WHERE user_id = ?').all(userId) as any[]).map((r) => r.slot));
    for (let s = 0; s < cfg.box.slots; s++) {
      if (!used.has(s)) {
        db.prepare("INSERT INTO boxes (user_id, slot, state, type, source) VALUES (?,?,'locked',?,?)").run(userId, s, type, source);
        return { box: s, type, noSlot: false };
      }
    }
    return { box: null, type: null, noSlot: true };
  }

  startBox(userId: number, slot: number) {
    const { db, cfg } = this.d;
    const box = db.prepare('SELECT state, type FROM boxes WHERE user_id = ? AND slot = ?').get(userId, slot) as any;
    if (!box) throw new GameError('جعبه‌ای در این اسلات نیست');
    if (box.state !== 'locked') throw new GameError('این جعبه قبلاً شروع شده');
    if (db.prepare("SELECT 1 FROM boxes WHERE user_id = ? AND state = 'opening'").get(userId)) {
      throw new GameError('همزمان فقط یک جعبه می‌تواند باز شود');
    }
    db.prepare("UPDATE boxes SET state = 'opening', ready_at = ? WHERE user_id = ? AND slot = ?")
      .run(this.d.now() + cfg.box.types[this.boxType(box.type)].durationSeconds * 1000, userId, slot);
  }

  /** فقط برای تست/دمو (در حالت dev) */
  skipBoxTimer(userId: number, slot: number) {
    this.d.db.prepare("UPDATE boxes SET ready_at = ? WHERE user_id = ? AND slot = ? AND state = 'opening'").run(this.d.now(), userId, slot);
  }

  /** باز کردن فوری یک جعبه‌ی در حال باز شدن با الماس (هزینه: boxSpeedupCost)؛ بعدش جعبه آماده‌ی باز کردن است */
  speedupBox(userId: number, slot: number) {
    const { db, cfg } = this.d;
    const box = db.prepare('SELECT state, ready_at FROM boxes WHERE user_id = ? AND slot = ?').get(userId, slot) as any;
    if (!box) throw new GameError('جعبه‌ای در این اسلات نیست');
    if (box.state !== 'opening') throw new GameError('این جعبه در حال باز شدن نیست');
    const remaining = box.ready_at - this.d.now();
    if (remaining <= 0) throw new GameError('جعبه آماده است');
    const cost = boxSpeedupCost(remaining, cfg.box.speedup);
    const paid = Number(db.prepare('UPDATE users SET gems = gems - ? WHERE id = ? AND gems >= ?').run(cost, userId, cost).changes);
    if (paid !== 1) throw new GameError(`الماس کافی نداری (${cost} الماس لازم است)`);
    db.prepare("UPDATE boxes SET ready_at = ? WHERE user_id = ? AND slot = ? AND state = 'opening'").run(this.d.now(), userId, slot);
    return { cost };
  }

  openBox(userId: number, slot: number) {
    const { db, cfg, rng } = this.d;
    const box = db.prepare('SELECT state, ready_at, type, source FROM boxes WHERE user_id = ? AND slot = ?').get(userId, slot) as any;
    if (!box) throw new GameError('جعبه‌ای در این اسلات نیست');
    if (box.state !== 'opening') throw new GameError('اول باید جعبه را شروع کنی');
    if (this.d.now() < box.ready_at) throw new GameError('هنوز زمانش نرسیده');

    const type = this.boxType(box.type);
    const bc: BoxContents = cfg.box.types[type].contents[box.source === 'solo' ? 'solo' : 'multi']; // محتوا بر اساس اینکه جعبه از تک‌نفره آمده یا آنلاین
    const coins = randInt(rng, bc.coins);
    const gotCards: { id: string; isNew: boolean }[] = [];
    const n = randInt(rng, bc.cardCountRange);
    for (let i = 0; i < n; i++) {
      const rarity = this.rollRarity(bc);
      if (!rarity) continue;
      const pool = cfg.cards.filter((c) => c.rarity === rarity);
      const card = pool[Math.floor(rng() * pool.length)];
      const has = db.prepare('SELECT 1 FROM user_cards WHERE user_id = ? AND card_id = ?').get(userId, card.id);
      if (has) db.prepare('UPDATE user_cards SET copies = copies + 1 WHERE user_id = ? AND card_id = ?').run(userId, card.id);
      else db.prepare('INSERT INTO user_cards (user_id, card_id) VALUES (?,?)').run(userId, card.id);
      gotCards.push({ id: card.id, isNew: !has });
    }
    db.prepare('DELETE FROM boxes WHERE user_id = ? AND slot = ?').run(userId, slot);
    db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(coins, userId);
    return { type, coins, cards: gotCards };
  }

  private rollRarity(bc: BoxContents): Rarity | null {
    const { epic, rare, common } = bc.cardChance;
    const r = this.d.rng();
    if (r < epic) return 'epic';
    if (r < epic + rare) return 'rare';
    if (r < epic + rare + common) return 'common';
    return null;
  }

  addXp(userId: number, xp: number): number {
    const { db } = this.d;
    const u = db.prepare('SELECT level, xp FROM users WHERE id = ?').get(userId) as any;
    let { level, xp: cur } = u;
    cur += xp;
    let gained = 0;
    while (cur >= this.xpNeeded(level)) { cur -= this.xpNeeded(level); level++; gained++; }
    db.prepare('UPDATE users SET level = ?, xp = ? WHERE id = ?').run(level, cur, userId);
    return gained;
  }

  // ---------- نتیجه‌ی مبارزه ----------
  /**
   * تک‌نفره: برد فقط جعبه می‌دهد (طبق شانس تنظیم‌شده) و پیشرفت مرحله را باز می‌کند؛ کاپ و سکه و XP ندارد.
   * آنلاین: برد = جعبه (طبق شانس) + سکه + XP + کاپ؛ باخت = کم‌شدن کاپ (هیچ‌وقت زیر صفر نمی‌رود).
   */
  recordResult(userId: number, won: boolean, mode: 'solo' | 'multi', soloStage?: number): BattleReward | null {
    const { db, cfg } = this.d;
    const on = cfg.online;
    if (!won) {
      db.prepare('UPDATE users SET losses = losses + 1 WHERE id = ?').run(userId);
      if (mode === 'multi') {
        db.prepare('UPDATE users SET trophies = MAX(0, trophies - ?) WHERE id = ?').run(on.trophiesLoss, userId);
        return { box: null, type: null, noSlot: false, trophies: -on.trophiesLoss };
      }
      return null;
    }
    db.prepare('UPDATE users SET wins = wins + 1 WHERE id = ?').run(userId);
    if (mode === 'solo' && soloStage !== undefined) {
      db.prepare('UPDATE users SET solo_stage = MAX(solo_stage, ?) WHERE id = ?').run(soloStage + 1, userId);
    }
    const type = this.rewardBoxType(mode);
    const box = type ? this.grantBox(userId, type, mode) : { box: null, type: null, noSlot: false };
    if (mode === 'solo') return box;
    db.prepare('UPDATE users SET coins = coins + ?, trophies = trophies + ? WHERE id = ?').run(on.winCoins, on.trophiesWin, userId);
    const levelsGained = on.winXp > 0 ? this.addXp(userId, on.winXp) : 0;
    return { ...box, coins: on.winCoins, xp: on.winXp, trophies: on.trophiesWin, levelsGained };
  }

  /** جایگاه یک بازیکن در جدول (۱ = بالاترین) */
  trophyRank(userId: number): number {
    const u = this.d.db.prepare('SELECT trophies, level FROM users WHERE id = ?').get(userId) as any;
    if (!u) return 0;
    const n = this.d.db.prepare('SELECT COUNT(*) n FROM users WHERE banned = 0 AND (trophies > ? OR (trophies = ? AND (level > ? OR (level = ? AND id < ?))))').get(u.trophies, u.trophies, u.level, u.level, userId) as any;
    return Number(n.n) + 1;
  }

  /** نفرات برتر بر اساس بیشترین کاپ (در تساوی: لول بالاتر، بعد قدیمی‌تر) */
  leaderboard(meId: number, limit = 50) {
    const rows = this.d.db.prepare('SELECT id, name, avatar, level, trophies FROM users WHERE banned = 0 ORDER BY trophies DESC, level DESC, id ASC LIMIT ?').all(limit) as any[];
    return rows.map((r, i) => ({ rank: i + 1, id: r.id as number, name: r.name as string, avatar: (r.avatar ?? null) as string | null, level: r.level as number, trophies: r.trophies as number, me: r.id === meId }));
  }

  // ---------- فروشگاه ----------
  /** شماره‌ی روز به وقت تهران (نیمه‌شب ۰۰:۰۰ عوض می‌شود): پیشنهادهای کارت هر روز دوباره قابل خرید است */
  shopDay(): number { return Math.floor((this.d.now() + 12_600_000) / 86_400_000); }
  shopNextResetMs(): number { return (this.shopDay() + 1) * 86_400_000 - 12_600_000 - this.d.now(); }
  private offerSig(o: { cardId: string; count: number; currency: string; price: number }) { return `${o.cardId}|${o.count}|${o.currency}|${o.price}`; }

  /** وضعیت فروشگاه برای یک بازیکن: کدام پیشنهادهای امروز را خریده، تا بازنشانی چقدر مانده، سفارش‌های اخیرش */
  shopState(userId: number) {
    const { db, cfg } = this.d;
    const day = this.shopDay();
    const bought: number[] = [];
    cfg.shop.cards.forEach((o, slot) => {
      if (o.cardId && db.prepare('SELECT 1 FROM shop_buys WHERE user_id = ? AND slot = ? AND day = ? AND sig = ?').get(userId, slot, day, this.offerSig(o))) bought.push(slot);
    });
    const orders = (db.prepare("SELECT id, gems, coins, toman, stars, method, status, created_at FROM orders WHERE user_id = ? AND status NOT IN ('created', 'expired') ORDER BY id DESC LIMIT 5").all(userId) as any[])
      .map((r) => ({ id: r.id as number, gems: r.gems as number, coins: r.coins as number, toman: r.toman as number, stars: r.stars as number, method: r.method as string, status: r.status as string, createdAt: r.created_at as number }));
    return { bought, resetInMs: this.shopNextResetMs(), orders };
  }

  /** خرید یک پیشنهاد کارت (با همان ارزی که ادمین برای اسلات گذاشته)؛ هر پیشنهاد در هر روز یک‌بار برای هر بازیکن */
  buyShopCard(userId: number, slot: number) {
    const { db, cfg } = this.d;
    const o = cfg.shop.cards[slot];
    if (!Number.isInteger(slot) || !o || !o.cardId) throw new GameError('این پیشنهاد وجود ندارد');
    const { currency, price } = o;
    const day = this.shopDay(), sig = this.offerSig(o);
    if (db.prepare('SELECT 1 FROM shop_buys WHERE user_id = ? AND slot = ? AND day = ? AND sig = ?').get(userId, slot, day, sig)) throw new GameError('این پیشنهاد را امروز خریده‌ای');
    const paid = Number(db.prepare(`UPDATE users SET ${currency} = ${currency} - ? WHERE id = ? AND ${currency} >= ?`).run(price, userId, price).changes);
    if (paid !== 1) throw new GameError(currency === 'coins' ? 'سکه‌ی کافی نداری' : 'الماس کافی نداری');
    db.prepare('INSERT INTO shop_buys (user_id, slot, day, sig) VALUES (?,?,?,?)').run(userId, slot, day, sig);
    const has = db.prepare('SELECT 1 FROM user_cards WHERE user_id = ? AND card_id = ?').get(userId, o.cardId);
    if (has) db.prepare('UPDATE user_cards SET copies = copies + ? WHERE user_id = ? AND card_id = ?').run(o.count, userId, o.cardId);
    else db.prepare('INSERT INTO user_cards (user_id, card_id, copies) VALUES (?,?,?)').run(userId, o.cardId, o.count - 1); // اولین کارت = داشتنِ کارت؛ بقیه = تعدادِ ارتقا
    return { cardId: o.cardId, count: o.count, isNew: !has };
  }

  /** خرید بسته‌ی سکه با الماس */
  buyCoinPack(userId: number, packId: string) {
    const { db, cfg } = this.d;
    const pk = cfg.shop.coinPacks.find((x) => x.id === packId);
    if (!pk || pk.currency !== 'gems') throw new GameError('این بسته با الماس فروخته نمی‌شود');
    const paid = Number(db.prepare('UPDATE users SET gems = gems - ? WHERE id = ? AND gems >= ?').run(pk.price, userId, pk.price).changes);
    if (paid !== 1) throw new GameError('الماس کافی نداری');
    db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(pk.coins, userId);
    return { coins: pk.coins };
  }

  /**
   * ثبت سفارش. فقط وقتی بازیکن واقعاً پرداخت را تأیید می‌کند چیزی در پنل و «سفارش‌های اخیر» دیده می‌شود:
   * - کارت‌به‌کارت: سفارش با زدنِ «پرداخت کردم» و کد پیگیری ساخته می‌شود (وضعیت pending)، نه موقع باز کردن پنجره‌ی خرید.
   * - استار: برای فاکتور یک ردیف «created» (نامرئی) ساخته می‌شود؛ بعد از پرداخت واقعی delivered و دیده می‌شود. پرداخت‌نشده‌ها بعد از یک ساعت «expired» می‌شوند.
   */
  createOrder(userId: number, packId: string, method: 'card' | 'stars' = 'card', note?: string) {
    const { db, cfg } = this.d;
    // بسته‌ی الماس (تومان یا استار) یا بسته‌ی سکه‌ای که با تومان فروخته می‌شود (فقط کارت‌به‌کارت)
    const gp = cfg.shop.gemPacks.find((x) => x.id === packId);
    const cp = cfg.shop.coinPacks.find((x) => x.id === packId && x.currency === 'toman');
    if (!gp && !cp) throw new GameError('این بسته وجود ندارد');
    const item = gp ? { id: gp.id, gems: gp.gems, coins: 0, toman: gp.toman, stars: gp.stars } : { id: cp!.id, gems: 0, coins: cp!.coins, toman: cp!.price, stars: 0 };
    if (method === 'card' && (!cfg.shop.card.enabled || !(item.toman > 0))) throw new GameError('پرداخت کارت‌به‌کارت برای این بسته فعال نیست');
    if (method === 'stars' && (!gp || !cfg.shop.starsEnabled || !(item.stars > 0))) throw new GameError('پرداخت با استار برای این بسته فعال نیست');
    const now = this.d.now();
    let clean: string | null = null;
    if (method === 'card') {
      clean = String(note ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60);
      if (!clean) throw new GameError('کد پیگیری یا ۴ رقم آخر کارت را بنویس');
      const pending = Number((db.prepare("SELECT COUNT(*) n FROM orders WHERE user_id = ? AND status = 'pending'").get(userId) as any).n);
      if (pending >= 5) throw new GameError('چند سفارش در انتظار داری؛ اول صبر کن تا بررسی شوند');
    } else {
      db.prepare("UPDATE orders SET status = 'expired', done_at = ? WHERE user_id = ? AND status = 'created' AND created_at < ?").run(now, userId, now - 3_600_000);
      const open = Number((db.prepare("SELECT COUNT(*) n FROM orders WHERE user_id = ? AND status = 'created'").get(userId) as any).n);
      if (open >= 10) throw new GameError('چند پرداخت باز داری؛ کمی بعد دوباره امتحان کن');
    }
    const toman = method === 'card' ? item.toman : 0, stars = method === 'stars' ? item.stars : 0;
    const status = method === 'card' ? 'pending' : 'created';
    const r = db.prepare('INSERT INTO orders (user_id, pack_id, gems, coins, toman, stars, method, status, note, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(userId, item.id, item.gems, item.coins, toman, stars, method, status, clean, now);
    return { id: Number(r.lastInsertRowid), gems: item.gems, coins: item.coins, toman, stars };
  }

  /** فاکتور استار ساخته نشد (خطای تلگرام): ردیف نامرئی را منقضی کن */
  cancelOrder(orderId: number) {
    this.d.db.prepare("UPDATE orders SET status = 'expired', done_at = ? WHERE id = ? AND status = 'created'").run(this.d.now(), orderId);
  }

  /** قبل از پرداخت استار: آیا این پرداخت معتبر است؟ (تلگرام فقط ۱۰ ثانیه فرصت می‌دهد) */
  starsPreCheck(orderId: number, tgId: number, stars: number): string | null {
    const o = this.d.db.prepare('SELECT o.status, o.method, o.stars, u.tg_id FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?').get(orderId) as any;
    if (!o || o.method !== 'stars') return 'سفارش پیدا نشد';
    if (o.tg_id !== tgId) return 'این سفارش برای حساب دیگری است';
    if (o.status === 'delivered') return 'این سفارش قبلاً پرداخت شده';
    if (o.stars !== stars) return 'مبلغ سفارش تغییر کرده؛ دوباره امتحان کن';
    return null;
  }

  /**
   * پرداخت استار انجام شد (successful_payment): الماس فوراً و فقط یک‌بار (با شناسه‌ی تراکنش تلگرام) اضافه می‌شود.
   * اگر سفارش به‌خاطر گذشت زمان لغو شده بود هم تحویل می‌شود، چون پول پرداخت شده.
   */
  completeStarsPayment(orderId: number, tgId: number, stars: number, chargeId: string): 'delivered' | 'duplicate' | 'invalid' {
    const { db } = this.d;
    if (db.prepare('SELECT 1 FROM orders WHERE charge_id = ?').get(chargeId)) return 'duplicate';
    const o = db.prepare('SELECT o.user_id, o.gems, o.status, o.method, o.stars, u.tg_id FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?').get(orderId) as any;
    if (!o || o.method !== 'stars' || o.tg_id !== tgId || o.stars !== stars || o.status === 'delivered') return 'invalid';
    db.prepare("UPDATE orders SET status = 'delivered', done_at = ?, charge_id = ? WHERE id = ?").run(this.d.now(), chargeId, orderId);
    db.prepare('UPDATE users SET gems = gems + ? WHERE id = ?').run(o.gems, o.user_id);
    return 'delivered';
  }

  adminOrders(status?: string) {
    // سفارش‌های «created/expired» (فاکتور باز شده ولی پرداخت نشده) هیچ‌وقت نمایش داده نمی‌شوند
    const rows = this.d.db.prepare(`SELECT o.id, o.user_id, o.gems, o.coins, o.toman, o.stars, o.method, o.note, o.status, o.created_at, o.done_at, u.tg_id, u.name, u.avatar FROM orders o JOIN users u ON u.id = o.user_id WHERE o.status NOT IN ('created', 'expired') ${status ? 'AND o.status = ?' : ''} ORDER BY o.id DESC LIMIT 200`).all(...(status ? [status] : [])) as any[];
    return rows.map((r) => ({ id: r.id as number, userId: r.user_id as number, tgId: r.tg_id as number, name: r.name as string, avatar: (r.avatar ?? null) as string | null, gems: r.gems as number, coins: r.coins as number, toman: r.toman as number, stars: r.stars as number, method: r.method as string, note: (r.note ?? null) as string | null, status: r.status as string, createdAt: r.created_at as number, doneAt: (r.done_at ?? null) as number | null }));
  }

  /** تحویل دستی (فقط کارت‌به‌کارت) یا لغو یک سفارش در انتظار؛ هر سفارش فقط یک‌بار قابل تصمیم است */
  adminOrderAction(id: number, action: 'deliver' | 'cancel') {
    const { db } = this.d;
    const o = db.prepare('SELECT user_id, gems, coins, status, method FROM orders WHERE id = ?').get(id) as any;
    if (!o) throw new GameError('سفارش پیدا نشد');
    if (o.status !== 'pending') throw new GameError('این سفارش قبلاً بررسی شده');
    if (action === 'deliver') {
      if (o.method !== 'card') throw new GameError('سفارش‌های استار خودکار بعد از پرداخت تحویل می‌شوند');
      db.prepare("UPDATE orders SET status = 'delivered', done_at = ? WHERE id = ? AND status = 'pending'").run(this.d.now(), id);
      db.prepare('UPDATE users SET gems = gems + ?, coins = coins + ? WHERE id = ?').run(o.gems, o.coins, o.user_id);
    } else if (action === 'cancel') {
      db.prepare("UPDATE orders SET status = 'canceled', done_at = ? WHERE id = ? AND status = 'pending'").run(this.d.now(), id);
    } else throw new GameError('عملیات نامعتبر است');
  }

  // ---------- ابزارهای مدیریت ----------
  adminStats() {
    const { db } = this.d;
    const n = (sql: string) => Number((db.prepare(sql).get() as any).n ?? 0);
    return {
      users: n('SELECT COUNT(*) n FROM users'),
      battles: n('SELECT COALESCE(SUM(wins),0) n FROM users'),
      pendingBoxes: n('SELECT COUNT(*) n FROM boxes'),
      coins: n('SELECT COALESCE(SUM(coins),0) n FROM users'),
      banned: n('SELECT COUNT(*) n FROM users WHERE banned = 1'),
    };
  }

  adminUsers(q: string) {
    const like = `%${q.replace(/[%_]/g, '')}%`;
    return (this.d.db.prepare('SELECT id, tg_id, name, avatar, level, xp, coins, gems, trophies, wins, losses, banned, created_at FROM users WHERE name LIKE ? OR CAST(tg_id AS TEXT) LIKE ? ORDER BY id DESC LIMIT 100').all(like, like) as any[]);
  }

  adminGift(userId: number, g: { coins?: number; xp?: number; cardId?: string }) {
    const { db, cfg } = this.d;
    if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId)) throw new GameError('بازیکن پیدا نشد');
    const int = (v: unknown) => (Number.isInteger(v) && Math.abs(v as number) <= 1_000_000 ? (v as number) : 0);
    if (int(g.coins)) db.prepare('UPDATE users SET coins = MAX(0, coins + ?) WHERE id = ?').run(int(g.coins), userId);
    if (int(g.xp) > 0) this.addXp(userId, int(g.xp));
    if (g.cardId) {
      if (!cfg.cards.some((c) => c.id === g.cardId)) throw new GameError('کارت ناشناخته');
      const has = db.prepare('SELECT 1 FROM user_cards WHERE user_id = ? AND card_id = ?').get(userId, g.cardId);
      if (has) db.prepare('UPDATE user_cards SET copies = copies + 1 WHERE user_id = ? AND card_id = ?').run(userId, g.cardId);
      else db.prepare('INSERT INTO user_cards (user_id, card_id) VALUES (?,?)').run(userId, g.cardId);
    }
  }

  /** پروفایل کامل یک بازیکن برای پنل مدیریت */
  adminUser(userId: number) {
    const u = this.d.db.prepare('SELECT tg_id, banned, created_at FROM users WHERE id = ?').get(userId) as any;
    if (!u) throw new GameError('بازیکن پیدا نشد');
    return { ...this.profile(userId), tgId: u.tg_id as number, banned: !!u.banned, createdAt: u.created_at as number };
  }

  /** سکه یا الماس را کم/زیاد (delta) یا دقیق تنظیم (set) می‌کند؛ هیچ‌وقت زیر صفر نمی‌رود */
  adminBalance(userId: number, currency: 'coins' | 'gems', o: { delta?: unknown; set?: unknown }) {
    const { db } = this.d;
    if (currency !== 'coins' && currency !== 'gems') throw new GameError('نوع دارایی نامعتبر است');
    if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId)) throw new GameError('بازیکن پیدا نشد');
    const LIM = 10_000_000;
    const name = currency === 'coins' ? 'سکه' : 'الماس';
    if (o.set !== undefined) {
      if (!Number.isInteger(o.set) || (o.set as number) < 0 || (o.set as number) > LIM) throw new GameError(`عدد ${name} نامعتبر است`);
      db.prepare(`UPDATE users SET ${currency} = ? WHERE id = ?`).run(o.set as number, userId);
    } else {
      if (!Number.isInteger(o.delta) || Math.abs(o.delta as number) > LIM) throw new GameError(`عدد ${name} نامعتبر است`);
      db.prepare(`UPDATE users SET ${currency} = MAX(0, ${currency} + ?) WHERE id = ?`).run(o.delta as number, userId);
    }
  }

  adminCoins(userId: number, o: { delta?: unknown; set?: unknown }) { this.adminBalance(userId, 'coins', o); }

  adminBan(userId: number, banned: boolean) {
    this.d.db.prepare('UPDATE users SET banned = ? WHERE id = ?').run(banned ? 1 : 0, userId);
  }

  /** آیا کسی این کارت را دارد؟ (برای جلوگیری از حذف) */
  cardOwned(cardId: string): boolean {
    return !!this.d.db.prepare('SELECT 1 FROM user_cards WHERE card_id = ? LIMIT 1').get(cardId);
  }
}
