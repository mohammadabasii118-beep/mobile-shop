import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { ABILITY_META, resolveCard, type CardDef, type ClientMsg, type FriendView, type GameConfig, type ServerMsg, type Side } from '@game/shared';
import { validateConfig } from './config';
import { currentBundle } from './version';
import { authenticate, type AuthOptions } from './auth';
import { Battle, type Participant } from './battle';
import type { Db } from './db';
import { Game, GameError } from './game';

export interface ServerOptions {
  db: Db; cfg: GameConfig; auth: AuthOptions; staticDir?: string;
  now?: () => number; rng?: () => number;
  pauseMs?: number; botDelayMs?: number; turnMs?: number; heartbeatMs?: number; inviteMs?: number;
  /** آدرس API تلگرام (برای تست قابل تغییر) */
  telegramApi?: string;
  /** پوشه‌ی داده (عکس‌های آپلودشده) */
  dataDir?: string;
  /** شناسه‌ی تلگرام ادمین‌ها */
  adminIds?: number[];
  /** ذخیره‌ی کانفیگ روی دیسک (در تست خاموش است) */
  saveCfg?: (cfg: GameConfig) => void;
}

interface Conn { ws: WebSocket; userId: number; name: string; battle: Battle | null; queued: boolean }

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg',
};

export function createGameServer(opt: ServerOptions) {
  const now = opt.now ?? Date.now;
  const rng = opt.rng ?? Math.random;
  const { cfg } = opt;
  const adminIds = new Set(opt.adminIds ?? []);
  const isAdmin = (tgId: number) => opt.auth.devAuth || adminIds.has(tgId);
  const uploadsRoot = join(opt.dataDir ?? '.', 'uploads');
  const uploadsDir = join(uploadsRoot, 'cards');
  // عضویت اجباری کانال: فقط در حالت واقعی (با توکن) و برای غیرِ ادمین‌ها
  const needsChannel = (tgId: number) => !!cfg.channel?.required && !!opt.auth.botToken && !opt.auth.devAuth && !isAdmin(tgId);
  const game = new Game({ db: opt.db, cfg, now, rng, isAdmin, channelRequired: needsChannel });
  game.migrateCards();
  const lastVerify = new Map<number, number>();

  /** از تلگرام می‌پرسد کاربر عضو کانال هست یا نه */
  async function isChannelMember(tgId: number): Promise<boolean> {
    const base = opt.telegramApi ?? 'https://api.telegram.org';
    const url = `${base}/bot${opt.auth.botToken}/getChatMember?chat_id=${encodeURIComponent('@' + cfg.channel!.username)}&user_id=${tgId}`;
    let j: any;
    try { j = await (await fetch(url, { signal: AbortSignal.timeout(8000) })).json(); } catch { throw new GameError('ارتباط با تلگرام برقرار نشد؛ چند لحظه‌ی دیگر دوباره امتحان کن'); }
    if (!j.ok) {
      if (/user not found|participant_id_invalid/i.test(j.description ?? '')) return false;
      console.warn(`[channel] بررسی عضویت ناموفق: ${j.description} (ربات باید ادمین کانال @${cfg.channel!.username} باشد)`);
      throw new GameError('بررسی عضویت ممکن نشد؛ به پشتیبانی بگو');
    }
    const st = j.result?.status;
    return st === 'creator' || st === 'administrator' || st === 'member' || (st === 'restricted' && !!j.result.is_member);
  }
  const conns = new Map<number, Conn>();
  let queue: Conn[] = [];
  const turnMs = () => opt.turnMs ?? cfg.turnSeconds * 1000;

  const send = (c: Conn, m: ServerMsg) => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(m)); };

  // ---------- استار تلگرام ----------
  async function createStarsInvoice(o: { id: number; gems: number; stars: number }): Promise<string> {
    const r = await fetch(`${opt.telegramApi ?? 'https://api.telegram.org'}/bot${opt.auth.botToken}/createInvoiceLink`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ title: `${o.gems} الماس سرخ`, description: `بسته‌ی ${o.gems} الماس برای بازی میراث`, payload: `order:${o.id}`, provider_token: '', currency: 'XTR', prices: [{ label: `${o.gems} الماس`, amount: o.stars }] }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!j.ok || typeof j.result !== 'string') throw new Error(j.description ?? `HTTP ${r.status}`);
    return j.result;
  }
  const orderOf = (payload: unknown) => { const m = /^order:(\d+)$/.exec(String(payload ?? '')); return m ? Number(m[1]) : 0; };
  /** تلگرام قبل از گرفتن استار می‌پرسد (۱۰ ثانیه فرصت): null = اشکالی نیست، رشته = دلیل رد */
  const starsPreCheckout = (q: any): string | null => {
    if (q?.currency !== 'XTR') return 'ارز نامعتبر است';
    return game.starsPreCheck(orderOf(q.invoice_payload), Number(q.from?.id), Number(q.total_amount));
  };
  /** پرداخت تمام شد (successful_payment): الماس اضافه می‌شود. متن پیام برای بازیکن را برمی‌گرداند (یا null). */
  const starsPayment = (m: any): string | null => {
    const p = m?.successful_payment;
    if (!p || p.currency !== 'XTR') return null;
    const id = orderOf(p.invoice_payload);
    const res = game.completeStarsPayment(id, Number(m.from?.id), Number(p.total_amount), String(p.telegram_payment_charge_id));
    if (res === 'invalid') console.error(`[stars] پرداخت نامعتبر: سفارش ${id} کاربر ${m.from?.id} مبلغ ${p.total_amount} شناسه ${p.telegram_payment_charge_id}`);
    return res === 'delivered' ? '✅ پرداخت انجام شد و الماس به حسابت اضافه شد. موفق باشی!' : null;
  };

  const decorateFriends = (s: ReturnType<Game['friendsState']>) => ({
    ...s,
    friends: s.friends.map((f): FriendView => { const c = conns.get(f.id); return { ...f, online: !!c && c.ws.readyState === 1, busy: !!c && (!!c.battle || c.queued) }; })
      .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name)),
  });

  // ---------- مبارزه ----------
  function startBattle(mode: 'solo' | 'pvp', a: Participant, b: Participant, humans: Conn[], soloStage?: number, friendly = false) {
    const id = randomUUID();
    const battle = new Battle({
      id, mode, cfg, rng, turnMs: turnMs(), pauseMs: opt.pauseMs ?? 900, botDelayMs: opt.botDelayMs ?? 700,
      onEnd: ({ winner, reason }) => {
        if (reason === 'disconnect') console.log(`[battle] ${id.slice(0, 8)} با قطع اتصال تمام شد؛ برنده: ${winner}`);
        for (const c of humans) {
          c.battle = null;
          const side = battle.sideOf(c.userId)!;
          const won = side === winner;
          let reward = null;
          if (!friendly) try { reward = game.recordResult(c.userId, won, mode === 'solo' ? 'solo' : 'multi', won ? soloStage : undefined); } catch (e) { console.error(e); }
          send(c, { t: 'battleEnd', battleId: id, winner, youWon: won, reason, friendly, reward, profile: game.profile(c.userId) });
        }
      },
    }, a, b);
    humans.forEach((c) => { c.battle = battle; c.queued = false; });
    void battle.run().catch((e) => { console.error('battle crashed', e); });
    return battle;
  }

  const human = (c: Conn, side: Side): Participant => ({
    side, name: c.name, userId: c.userId, send: (m) => send(c, m), units: game.deckUnits(c.userId),
  });

  // ---------- دعوت دوستانه ----------
  const invites = new Map<number, { to: number; timer: NodeJS.Timeout }>(); // کلید: فرستنده
  const busy = (c: Conn) => !!c.battle || c.queued;
  const dropInvite = (from: number, status?: Extract<ServerMsg, { t: 'inviteResult' }>['status']) => {
    const inv = invites.get(from);
    if (!inv) return;
    clearTimeout(inv.timer); invites.delete(from);
    if (status) { const a = conns.get(from); if (a) send(a, { t: 'inviteResult', status }); }
  };
  const dropInvitesOf = (userId: number) => {
    dropInvite(userId);
    for (const [from, inv] of invites) if (inv.to === userId) dropInvite(from, 'offline');
  };

  function handleMsg(c: Conn, m: ClientMsg) {
    switch (m.t) {
      case 'invite': {
        const to = Number(m.to);
        if (busy(c)) return send(c, { t: 'error', message: 'الان درگیر مبارزه یا صف هستی' });
        if (!game.areFriends(c.userId, to)) return send(c, { t: 'error', message: 'این بازیکن دوست تو نیست' });
        game.deckUnits(c.userId);
        const peer = conns.get(to);
        if (!peer || peer.ws.readyState !== 1) return send(c, { t: 'inviteResult', status: 'offline' });
        if (busy(peer) || [...invites.values()].some((i) => i.to === to)) return send(c, { t: 'inviteResult', status: 'busy' });
        dropInvite(c.userId);
        const timer = setTimeout(() => dropInvite(c.userId, 'expired'), opt.inviteMs ?? 30_000);
        timer.unref();
        invites.set(c.userId, { to, timer });
        return send(peer, { t: 'invited', from: c.userId, name: c.name });
      }
      case 'inviteCancel': {
        const inv = invites.get(c.userId);
        if (inv) { dropInvite(c.userId); const peer = conns.get(inv.to); if (peer) send(peer, { t: 'inviteResult', status: 'canceled' }); }
        return;
      }
      case 'inviteReply': {
        const from = Number(m.from);
        const inv = invites.get(from);
        if (!inv || inv.to !== c.userId) return;
        if (!m.accept) return dropInvite(from, 'declined');
        const host = conns.get(from);
        if (!host || host.ws.readyState !== 1) { dropInvite(from); return send(c, { t: 'inviteResult', status: 'offline' }); }
        if (busy(host) || busy(c)) { dropInvite(from, 'busy'); return send(c, { t: 'inviteResult', status: 'busy' }); }
        game.deckUnits(c.userId);
        dropInvite(from);
        startBattle('pvp', human(host, 'A'), human(c, 'B'), [host, c], undefined, true);
        return;
      }
      case 'queue': {
        if (!game.profile(c.userId).channelOk) return send(c, { t: 'error', message: 'اول باید عضو کانال بشی' });
        if (c.battle || c.queued) return send(c, { t: 'error', message: 'الان درگیر مبارزه یا صف هستی' });
        game.deckUnits(c.userId); // ترکیب کامل؟
        const fee = cfg.fees?.multi ?? 0;
        if (!game.canAfford(c.userId, fee)) return send(c, { t: 'error', message: `برای ورود به مولتی‌پلیر ${fee} سکه لازم است` });
        const opp = queue.find((q) => q.userId !== c.userId && q.ws.readyState === 1);
        if (!opp) { c.queued = true; queue.push(c); return send(c, { t: 'queued' }); }
        queue = queue.filter((q) => q !== opp);
        // ورودی از هر دو نفر هنگام شروع نبرد کم می‌شود
        if (!game.chargeEntry(opp.userId, fee)) {
          opp.queued = false; send(opp, { t: 'error', message: `برای ورود به مولتی‌پلیر ${fee} سکه لازم است` });
          c.queued = true; queue.push(c); return send(c, { t: 'queued' });
        }
        if (!game.chargeEntry(c.userId, fee)) {
          game.refund(opp.userId, fee); queue.unshift(opp);
          return send(c, { t: 'error', message: `برای ورود به مولتی‌پلیر ${fee} سکه لازم است` });
        }
        send(opp, { t: 'profile', profile: game.profile(opp.userId) }); send(c, { t: 'profile', profile: game.profile(c.userId) });
        startBattle('pvp', human(opp, 'A'), human(c, 'B'), [opp, c]);
        return;
      }
      case 'leaveQueue':
        queue = queue.filter((q) => q !== c); c.queued = false; return;
      case 'solo': {
        if (!game.profile(c.userId).channelOk) return send(c, { t: 'error', message: 'اول باید عضو کانال بشی' });
        if (c.battle || c.queued) return send(c, { t: 'error', message: 'الان درگیر مبارزه یا صف هستی' });
        const stage = Number(m.stage);
        const profile = game.profile(c.userId);
        const flat = cfg.solo.pits.flatMap((pit, pi) => pit.stages.map((st, li) => ({ st, label: `گودال ${(pi + 1).toLocaleString('fa-IR')} — لول ${(li + 1).toLocaleString('fa-IR')}` })));
        const def = Number.isInteger(stage) ? flat[stage] : undefined;
        if (!def || stage < 0 || stage > profile.soloStage) {
          return send(c, { t: 'error', message: 'این مرحله هنوز باز نشده' });
        }
        const botUnits = def.st.deck.map(([id, lvl]) => resolveCard(cfg.cards.find((x) => x.id === id)!, lvl, cfg));
        const bot: Participant = { side: 'B', name: def.label, userId: null, send: null, ai: def.st.ai, units: botUnits };
        const me = human(c, 'A');
        const fee = cfg.fees?.solo ?? 0;
        if (!game.chargeEntry(c.userId, fee)) return send(c, { t: 'error', message: `برای هر مرحله‌ی سولو ${fee} سکه لازم است` });
        send(c, { t: 'profile', profile: game.profile(c.userId) });
        startBattle('solo', me, bot, [c], stage);
        return;
      }
      case 'leave':
        if (c.battle && c.battle.id === m.battleId) { const side = c.battle.sideOf(c.userId); if (side) c.battle.forfeit(side, 'left'); }
        return;
      case 'chat':
        if (c.battle && c.battle.id === m.battleId) c.battle.chat(c.userId, m.id);
        return;
      case 'attack':
        if (c.battle && c.battle.id === m.battleId && typeof m.uid === 'string' && typeof m.from === 'string') c.battle.handleTarget(c.userId, m.from, m.uid);
        return;
    }
  }

  // ---------- WebSocket ----------
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  // ضربان: هر ۲۰ ثانیه ping می‌فرستیم تا تونل/پروکسی/شبکه‌ی موبایل اتصالِ ساکت را قطع نکنند؛
  // اتصالی که ۳ بار پشت‌سرهم جواب نداد (مرده) بسته می‌شود تا حریفش منتظر یک روحِ بی‌جواب نماند.
  const missed = new WeakMap<WebSocket, number>();
  const heartbeat = setInterval(() => {
    for (const w of wss.clients) {
      const n = (missed.get(w) ?? 0) + 1;
      if (n > 3) { w.terminate(); continue; }
      missed.set(w, n);
      try { w.ping(); } catch { /* بسته شده */ }
    }
  }, opt.heartbeatMs ?? 20_000);
  heartbeat.unref();
  wss.on('connection', (ws) => {
    missed.set(ws, 0);
    ws.on('pong', () => missed.set(ws, 0));
    let conn: Conn | null = null;
    ws.on('message', (raw) => {
      let m: ClientMsg;
      try { m = JSON.parse(raw.toString()); } catch { return; }
      try {
        if (m.t === 'hello') {
          const u = authenticate(m.initData, opt.auth);
          if (!u) { ws.send(JSON.stringify({ t: 'error', message: 'احراز هویت ناموفق' })); return ws.close(); }
          let userId: number;
          try { userId = game.upsertUser(u); } catch (e) { ws.send(JSON.stringify({ t: 'error', message: (e as Error).message })); return ws.close(); }
          const old = conns.get(userId);
          if (old && old.ws !== ws) { console.log(`[ws] ${u.name} (${userId}): اتصال قبلی بسته شد چون همین حساب جای دیگری باز شد`); old.ws.close(4001, 'replaced'); } // اتصال قبلی → اگه وسط مبارزه بود می‌بازه
          conn = { ws, userId, name: u.name, battle: null, queued: false };
          conns.set(userId, conn);
          return send(conn, { t: 'ready', profile: game.profile(userId) });
        }
        if (!conn) return;
        handleMsg(conn, m);
      } catch (e) {
        if (conn) send(conn, { t: 'error', message: e instanceof GameError ? e.message : 'خطای سرور' });
        if (!(e instanceof GameError)) console.error(e);
      }
    });
    ws.on('close', (code, reason) => {
      if (!conn) return;
      console.log(`[ws] ${conn.name} (${conn.userId}) قطع شد؛ کد=${code}${reason?.length ? ` دلیل=${reason.toString()}` : ''}${conn.battle ? ' — وسط مبارزه بود (می‌بازد)' : ''}`);
      queue = queue.filter((q) => q !== conn);
      dropInvitesOf(conn.userId);
      if (conns.get(conn.userId) === conn) conns.delete(conn.userId);
      const b = conn.battle;
      if (b) { const side = b.sideOf(conn.userId); if (side) b.forfeit(side); }
    });
  });

  // ---------- HTTP ----------
  const json = (res: ServerResponse, code: number, body: unknown) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  };
  const readBody = (req: IncomingMessage, limit = 4096) => new Promise<any>((resolve) => {
    let s = '';
    req.on('data', (d) => { s += d; if (s.length > limit) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch { resolve({}); } });
  });
  const readRaw = (req: IncomingMessage, limit: number) => new Promise<Buffer | null>((resolve) => {
    const chunks: Buffer[] = []; let n = 0;
    req.on('data', (d: Buffer) => { n += d.length; if (n > limit) { resolve(null); req.destroy(); } else chunks.push(d); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
  const sniffImage = (b: Buffer): 'png' | 'jpg' | 'webp' | null => {
    if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
    if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
    if (b.length > 12 && b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return 'webp';
    return null;
  };

  /** کانفیگ جدید را اعتبارسنجی می‌کند، در حافظه جایگزین و روی دیسک ذخیره می‌کند (بدون ری‌استارت سرور). */
  function commitConfig(next: GameConfig) {
    validateConfig(next);
    for (const old of cfg.cards) {
      if (!next.cards.some((c) => c.id === old.id) && game.cardOwned(old.id)) throw new GameError(`کارت «${old.name}» را بازیکن‌ها دارند و قابل حذف نیست`);
    }
    opt.saveCfg?.(next);
    Object.assign(cfg, next);
  }
  const clone = (): GameConfig => JSON.parse(JSON.stringify(cfg));
  const removeImages = (id: string) => {
    for (const ext of ['png', 'jpg', 'webp']) { try { unlinkSync(join(uploadsDir, `${id}.${ext}`)); } catch { /* نبود */ } }
  };

  /** عکس‌های ظاهر (بنر صفحه‌ی اصلی و پس‌زمینه‌ی بازی) */
  const SLOTS = { banner: 3_000_000, background: 4_000_000 } as const;
  type Slot = keyof typeof SLOTS;
  const removeSlot = (kind: Slot) => {
    for (const ext of ['png', 'jpg', 'webp']) { try { unlinkSync(join(uploadsRoot, `${kind}.${ext}`)); } catch { /* نبود */ } }
  };

  async function admin(req: IncomingMessage, res: ServerResponse, path: string, url: URL) {
    switch (path) {
      case '/api/admin/overview':
        return json(res, 200, { stats: game.adminStats(), online: conns.size, activeBattles: new Set([...conns.values()].map((c) => c.battle?.id).filter(Boolean)).size, abilities: ABILITY_META });
      case '/api/admin/config':
        if (req.method !== 'POST') return json(res, 200, cfg);
        commitConfig((await readBody(req, 262144)).config);
        return json(res, 200, cfg);
      case '/api/admin/card': {
        const card = (await readBody(req, 8192)).card as CardDef;
        const next = clone();
        const i = next.cards.findIndex((c) => c.id === card?.id);
        const clean: CardDef = {
          id: card.id, name: card.name, rarity: card.rarity, hp: Number(card.hp), atk: Number(card.atk), shield: Number(card.shield),
          ...(Array.isArray(card.levels) ? { levels: card.levels.map((l) => ({ hp: Number(l.hp), atk: Number(l.atk), shield: Number(l.shield), ...(l.params ? { params: l.params } : {}) })) } : {}),
          ...(card.abilities ? { abilities: card.abilities } : {}), ...(card.chargeAttacks !== undefined ? { chargeAttacks: Number(card.chargeAttacks) } : {}), ...(card.params ? { params: card.params } : {}), ...(card.desc ? { desc: String(card.desc).slice(0, 120) } : {}),
          ...(i >= 0 && next.cards[i].image ? { image: next.cards[i].image } : {}),
        };
        if (i >= 0) next.cards[i] = clean; else next.cards.push(clean);
        commitConfig(next);
        return json(res, 200, cfg);
      }
      case '/api/admin/card/delete': {
        const id = String((await readBody(req)).id);
        const next = clone();
        next.cards = next.cards.filter((c) => c.id !== id);
        commitConfig(next); removeImages(id);
        return json(res, 200, cfg);
      }
      case '/api/admin/card-image': {
        const id = url.searchParams.get('cardId') ?? '';
        const next = clone();
        const card = next.cards.find((c) => c.id === id);
        if (!card) throw new GameError('کارت پیدا نشد');
        const buf = await readRaw(req, 1_500_000);
        if (!buf) throw new GameError('حجم عکس بیشتر از ۱٫۵ مگابایت است');
        const ext = sniffImage(buf);
        if (!ext) throw new GameError('فقط PNG، JPG یا WebP قبول است');
        mkdirSync(uploadsDir, { recursive: true });
        removeImages(id);
        writeFileSync(join(uploadsDir, `${id}.${ext}`), buf);
        card.image = `/uploads/cards/${id}.${ext}?v=${Date.now()}`;
        commitConfig(next);
        return json(res, 200, cfg);
      }
      case '/api/admin/card-image/delete': {
        const id = String((await readBody(req)).cardId);
        const next = clone();
        const card = next.cards.find((c) => c.id === id);
        if (!card) throw new GameError('کارت پیدا نشد');
        delete card.image; removeImages(id); commitConfig(next);
        return json(res, 200, cfg);
      }
      case '/api/admin/banner':
      case '/api/admin/background': {
        const kind = path.endsWith('background') ? 'background' : 'banner';
        const next = clone();
        const buf = await readRaw(req, SLOTS[kind]);
        if (!buf) throw new GameError(`حجم عکس بیشتر از ${SLOTS[kind] / 1_000_000} مگابایت است`);
        const ext = sniffImage(buf);
        if (!ext) throw new GameError('فقط PNG، JPG یا WebP قبول است');
        mkdirSync(uploadsRoot, { recursive: true });
        removeSlot(kind);
        writeFileSync(join(uploadsRoot, `${kind}.${ext}`), buf);
        next.ui = { ...next.ui, [kind]: `/uploads/${kind}.${ext}?v=${Date.now()}` };
        commitConfig(next);
        return json(res, 200, cfg);
      }
      case '/api/admin/banner/delete':
      case '/api/admin/background/delete': {
        const kind = path.includes('background') ? 'background' : 'banner';
        const next = clone();
        if (next.ui) delete next.ui[kind];
        removeSlot(kind); commitConfig(next);
        return json(res, 200, cfg);
      }
      case '/api/admin/users':
        return json(res, 200, { users: game.adminUsers(url.searchParams.get('q') ?? '') });
      case '/api/admin/user':
        return json(res, 200, { user: game.adminUser(Number(url.searchParams.get('id'))) });
      case '/api/admin/orders': return json(res, 200, { orders: game.adminOrders(url.searchParams.get('status') || undefined) });
      case '/api/admin/order': {
        const b = await readBody(req);
        game.adminOrderAction(Number(b.id), b.action as 'deliver' | 'cancel');
        return json(res, 200, { orders: game.adminOrders() });
      }
      case '/api/admin/balance': {
        const b = await readBody(req);
        game.adminBalance(Number(b.userId), b.currency as 'coins' | 'gems', { delta: b.delta, set: b.set });
        return json(res, 200, { user: game.adminUser(Number(b.userId)) });
      }
      case '/api/admin/coins': {
        const b = await readBody(req);
        game.adminCoins(Number(b.userId), { delta: b.delta, set: b.set });
        return json(res, 200, { user: game.adminUser(Number(b.userId)) });
      }
      case '/api/admin/gift': {
        const b = await readBody(req);
        game.adminGift(Number(b.userId), { coins: b.coins, xp: b.xp, cardId: b.cardId || undefined });
        return json(res, 200, { ok: true });
      }
      case '/api/admin/ban': {
        const b = await readBody(req);
        game.adminBan(Number(b.userId), !!b.banned);
        for (const c of conns.values()) if (c.userId === Number(b.userId) && b.banned) c.ws.close();
        return json(res, 200, { ok: true });
      }
    }
    return json(res, 404, { error: 'not found' });
  }

  async function api(req: IncomingMessage, res: ServerResponse, path: string) {
    if (path === '/api/config') return json(res, 200, cfg);
    if (path === '/api/version') { res.setHeader('cache-control', 'no-store'); return json(res, 200, { bundle: currentBundle(opt.staticDir) }); }
    const hdr = req.headers['x-init-data'];
    const u = authenticate(Array.isArray(hdr) ? hdr[0] : hdr, opt.auth);
    if (!u) return json(res, 401, { error: 'احراز هویت ناموفق' });
    let userId: number;
    try { userId = game.upsertUser(u); } catch (e) { return json(res, 403, { error: (e as Error).message }); }
    if (path.startsWith('/api/admin/')) {
      if (!isAdmin(u.tgId)) return json(res, 403, { error: 'دسترسی ادمین نداری' });
      try { return await admin(req, res, path, new URL(req.url ?? '/', 'http://x')); } catch (e) {
        if (e instanceof GameError || e instanceof Error && !(e as any).code) return json(res, 400, { error: (e as Error).message });
        console.error(e); return json(res, 500, { error: 'خطای سرور' });
      }
    }
    if (path === '/api/channel/verify') {
      try {
        if (!needsChannel(u.tgId) || game.profile(userId).channelOk) return json(res, 200, { ok: true, profile: game.profile(userId) });
        const now0 = Date.now();
        if (now0 - (lastVerify.get(userId) ?? 0) < 2000) return json(res, 200, { ok: false, error: 'چند ثانیه صبر کن و دوباره بزن', profile: game.profile(userId) });
        lastVerify.set(userId, now0);
        if (await isChannelMember(u.tgId)) { game.setChannelOk(userId); return json(res, 200, { ok: true, profile: game.profile(userId) }); }
        return json(res, 200, { ok: false, error: 'هنوز عضو کانال نیستی. اول عضو شو و بعد «عضو شدم» رو بزن', profile: game.profile(userId) });
      } catch (e) {
        if (e instanceof GameError) return json(res, 502, { error: e.message });
        console.error(e); return json(res, 500, { error: 'خطای سرور' });
      }
    }
    if (path !== '/api/me' && needsChannel(u.tgId) && !game.profile(userId).channelOk) return json(res, 403, { error: 'اول باید عضو کانال بشی', code: 'channel_required' });
    const body = req.method === 'POST' ? await readBody(req) : {};
    try {
      let extra: object = {};
      switch (path) {
        case '/api/me': break;
        case '/api/deck': game.setDeck(userId, body.cards); break;
        case '/api/upgrade': extra = { upgrade: game.upgradeCard(userId, String(body.cardId)) }; break;
        case '/api/shop/state': extra = { shop: game.shopState(userId) }; break;
        case '/api/shop/buy-card': extra = { bought: game.buyShopCard(userId, Number(body.slot)) }; break;
        case '/api/shop/buy-coins': extra = { got: game.buyCoinPack(userId, String(body.id)) }; break;
        case '/api/shop/order': { // کارت‌به‌کارت: فقط وقتی بازیکن «پرداخت کردم» را می‌زند (با کد پیگیری) سفارش ثبت می‌شود؛ تحویل دستی از پنل
          const o = game.createOrder(userId, String(body.id), 'card', String(body.note ?? ''));
          extra = { order: o };
          break;
        }
        case '/api/shop/stars': { // استار تلگرام: فاکتور ساخته می‌شود؛ بعد از پرداخت ربات الماس را خودکار اضافه می‌کند
          if (!opt.auth.botToken) throw new GameError('پرداخت با استار فقط در نسخه‌ی واقعی (با توکن ربات) کار می‌کند');
          const o = game.createOrder(userId, String(body.id), 'stars');
          try { extra = { order: o, url: await createStarsInvoice(o) }; } catch (e) { game.cancelOrder(o.id); console.error('[stars]', (e as Error).message); throw new GameError('ساخت فاکتور استار ممکن نشد؛ کمی بعد دوباره امتحان کن'); }
          break;
        }
        case '/api/friends': extra = { ...decorateFriends(game.friendsState(userId)), code: userId }; break;
        case '/api/friends/add': {
          const r = game.addFriend(userId, body.code);
          const peer = conns.get(r.to);
          if (peer) send(peer, { t: 'notice', message: r.accepted ? `${game.profile(userId).name} دوستت شد 🤝` : `${game.profile(userId).name} برات درخواست دوستی فرستاد` });
          extra = { ...decorateFriends(game.friendsState(userId)), code: userId, accepted: r.accepted };
          break;
        }
        case '/api/friends/accept': game.acceptFriend(userId, Number(body.id)); extra = { ...decorateFriends(game.friendsState(userId)), code: userId }; break;
        case '/api/friends/remove': game.removeFriend(userId, Number(body.id)); extra = { ...decorateFriends(game.friendsState(userId)), code: userId }; break;
        case '/api/leaderboard': extra = { leaders: game.leaderboard(userId), myRank: game.trophyRank(userId) }; break;
        case '/api/box/start': game.startBox(userId, Number(body.slot)); break;
        case '/api/box/open': extra = { reward: game.openBox(userId, Number(body.slot)) }; break;
        case '/api/box/speedup': extra = { speedup: game.speedupBox(userId, Number(body.slot)) }; break;
        case '/api/box/skip':
          if (!opt.auth.devAuth) return json(res, 404, { error: 'not found' });
          game.skipBoxTimer(userId, Number(body.slot)); break;
        default: return json(res, 404, { error: 'not found' });
      }
      json(res, 200, { profile: game.profile(userId), ...extra });
    } catch (e) {
      if (e instanceof GameError) return json(res, 400, { error: e.message });
      console.error(e);
      json(res, 500, { error: 'خطای سرور' });
    }
  }

  function serveStatic(req: IncomingMessage, res: ServerResponse, path: string) {
    const dir = opt.staticDir;
    if (!dir || !existsSync(dir)) { res.writeHead(404); return res.end('client not built'); }
    let file = normalize(join(dir, path));
    if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(dir, 'index.html'); // SPA
    const hashed = /\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.(js|css)$/.test(file); // فقط فایل‌های ساخته‌شده با هش؛ عکس‌های ثابت (پس‌زمینه و آرت کارت) یک ساعت کش می‌شوند تا جایگزینی‌شان دیده شود
    if (file.endsWith('.mp3')) { // موزیک: پشتیبانی از Range برای آیفون/سافاری (بدون آن پخش نمی‌شود)
      const buf = readFileSync(file);
      const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''));
      const head = { 'content-type': 'audio/mpeg', 'accept-ranges': 'bytes', 'cache-control': 'public, max-age=3600' };
      if (m && (m[1] || m[2])) {
        const start = m[1] ? Number(m[1]) : Math.max(0, buf.length - Number(m[2]));
        const end = m[1] && m[2] ? Math.min(Number(m[2]), buf.length - 1) : buf.length - 1;
        if (start > end || start >= buf.length) { res.writeHead(416, { 'content-range': `bytes */${buf.length}` }); return res.end(); }
        res.writeHead(206, { ...head, 'content-range': `bytes ${start}-${end}/${buf.length}`, 'content-length': end - start + 1 });
        return res.end(buf.subarray(start, end + 1));
      }
      res.writeHead(200, { ...head, 'content-length': buf.length });
      return res.end(buf);
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': hashed ? 'public, max-age=31536000, immutable' : /\.(jpg|png|webp)$/.test(file) ? 'public, max-age=3600' : 'no-cache' });
    res.end(readFileSync(file));
  }

  const http = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    if (path === '/health') return json(res, 200, { ok: true });
    if (path.startsWith('/api/')) return void api(req, res, path);
    if (/^\/uploads\/(banner|background)\.(png|jpg|webp)$/.test(path)) {
      const f = join(uploadsRoot, path.slice('/uploads/'.length));
      if (!existsSync(f)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'application/octet-stream', 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' });
      return res.end(readFileSync(f));
    }
    if (path.startsWith('/uploads/cards/')) {
      const name = path.slice('/uploads/cards/'.length);
      const f = join(uploadsDir, name);
      if (!/^[a-z0-9_]+\.(png|jpg|webp)$/.test(name) || !existsSync(f)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': MIME[extname(f)] ?? (f.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream'), 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' });
      return res.end(readFileSync(f));
    }
    serveStatic(req, res, path);
  });
  http.on('upgrade', (req, socket, head) => {
    if (new URL(req.url ?? '/', 'http://x').pathname !== '/ws') return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  return { http, game, stars: { preCheckout: starsPreCheckout, payment: starsPayment }, close: () => { clearInterval(heartbeat); wss.clients.forEach((c) => c.close()); http.close(); } };
}
