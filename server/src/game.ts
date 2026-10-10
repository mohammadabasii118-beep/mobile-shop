import { resolveCard, type BattleReward, type BoxType, type BoxTypeCfg, type BoxView, type CardView, type GameConfig, type Profile, type Rarity, type UnitInit } from '@game/shared';
import type { Db } from './db';
import type { TgUser } from './auth';

export class GameError extends Error {}

export interface Deps { db: Db; cfg: GameConfig; now: () => number; rng: () => number; isAdmin?: (tgId: number) => boolean }

const randInt = (rng: () => number, [a, b]: [number, number]) => a + Math.floor(rng() * (b - a + 1));

export class Game {
  constructor(private d: Deps) {}
  get cfg() { return this.d.cfg; }

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
    const rows = db.prepare('SELECT slot, state, ready_at, type FROM boxes WHERE user_id = ? ORDER BY slot').all(userId) as any[];
    const boxes = rows.map((r): BoxView => {
      const type = this.boxType(r.type);
      const totalMs = cfg.box.types[type].durationSeconds * 1000;
      if (r.state === 'opening') {
        const remainingMs = Math.max(0, r.ready_at - now);
        return { slot: r.slot, type, state: remainingMs === 0 ? 'ready' : 'opening', remainingMs, totalMs };
      }
      return { slot: r.slot, type, state: 'locked', remainingMs: totalMs, totalMs };
    });
    return {
      id: u.id, name: u.name, avatar: u.avatar, level: u.level, xp: u.xp,
      xpNeeded: this.xpNeeded(u.level), coins: u.coins, wins: u.wins, losses: u.losses,
      soloStage: u.solo_stage, cards, deck, boxes, isAdmin: this.d.isAdmin?.(u.tg_id) ?? false,
    };
  }

  private xpNeeded(level: number): number {
    const t = this.d.cfg.xpPerLevel;
    return t[Math.min(level - 1, t.length - 1)];
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
  grantBox(userId: number, type: BoxType = 'bronze'): BattleReward {
    const { db, cfg } = this.d;
    const used = new Set((db.prepare('SELECT slot FROM boxes WHERE user_id = ?').all(userId) as any[]).map((r) => r.slot));
    for (let s = 0; s < cfg.box.slots; s++) {
      if (!used.has(s)) {
        db.prepare("INSERT INTO boxes (user_id, slot, state, type) VALUES (?,?,'locked',?)").run(userId, s, type);
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

  openBox(userId: number, slot: number) {
    const { db, cfg, rng } = this.d;
    const box = db.prepare('SELECT state, ready_at, type FROM boxes WHERE user_id = ? AND slot = ?').get(userId, slot) as any;
    if (!box) throw new GameError('جعبه‌ای در این اسلات نیست');
    if (box.state !== 'opening') throw new GameError('اول باید جعبه را شروع کنی');
    if (this.d.now() < box.ready_at) throw new GameError('هنوز زمانش نرسیده');

    const type = this.boxType(box.type);
    const bc: BoxTypeCfg = cfg.box.types[type];
    const coins = randInt(rng, bc.coins);
    const xp = randInt(rng, bc.xp);
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
    const levelsGained = this.addXp(userId, xp);
    return { type, coins, xp, cards: gotCards, levelsGained };
  }

  private rollRarity(bc: BoxTypeCfg): Rarity | null {
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
  recordResult(userId: number, won: boolean, soloStage?: number): BattleReward | null {
    const { db } = this.d;
    if (!won) {
      db.prepare('UPDATE users SET losses = losses + 1 WHERE id = ?').run(userId);
      return null;
    }
    db.prepare('UPDATE users SET wins = wins + 1 WHERE id = ?').run(userId);
    if (soloStage !== undefined) {
      db.prepare('UPDATE users SET solo_stage = MAX(solo_stage, ?) WHERE id = ?').run(soloStage + 1, userId);
    }
    const type = this.rewardBoxType(soloStage !== undefined ? 'solo' : 'multi');
    return type ? this.grantBox(userId, type) : { box: null, type: null, noSlot: false };
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
    return (this.d.db.prepare('SELECT id, tg_id, name, avatar, level, xp, coins, wins, losses, banned, created_at FROM users WHERE name LIKE ? OR CAST(tg_id AS TEXT) LIKE ? ORDER BY id DESC LIMIT 100').all(like, like) as any[]);
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

  /** سکه را کم/زیاد (delta) یا دقیق تنظیم (set) می‌کند؛ هیچ‌وقت زیر صفر نمی‌رود */
  adminCoins(userId: number, o: { delta?: unknown; set?: unknown }) {
    const { db } = this.d;
    if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId)) throw new GameError('بازیکن پیدا نشد');
    const LIM = 10_000_000;
    if (o.set !== undefined) {
      if (!Number.isInteger(o.set) || (o.set as number) < 0 || (o.set as number) > LIM) throw new GameError('عدد سکه نامعتبر است');
      db.prepare('UPDATE users SET coins = ? WHERE id = ?').run(o.set as number, userId);
    } else {
      if (!Number.isInteger(o.delta) || Math.abs(o.delta as number) > LIM) throw new GameError('عدد سکه نامعتبر است');
      db.prepare('UPDATE users SET coins = MAX(0, coins + ?) WHERE id = ?').run(o.delta as number, userId);
    }
  }

  adminBan(userId: number, banned: boolean) {
    this.d.db.prepare('UPDATE users SET banned = ? WHERE id = ?').run(banned ? 1 : 0, userId);
  }

  /** آیا کسی این کارت را دارد؟ (برای جلوگیری از حذف) */
  cardOwned(cardId: string): boolean {
    return !!this.d.db.prepare('SELECT 1 FROM user_cards WHERE card_id = ? LIMIT 1').get(cardId);
  }
}
