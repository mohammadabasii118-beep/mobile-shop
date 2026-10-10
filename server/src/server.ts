import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { ABILITY_META, resolveCard, type CardDef, type ClientMsg, type GameConfig, type ServerMsg, type Side } from '@game/shared';
import { validateConfig } from './config';
import { authenticate, type AuthOptions } from './auth';
import { Battle, type Participant } from './battle';
import type { Db } from './db';
import { Game, GameError } from './game';

export interface ServerOptions {
  db: Db; cfg: GameConfig; auth: AuthOptions; staticDir?: string;
  now?: () => number; rng?: () => number;
  pauseMs?: number; botDelayMs?: number; turnMs?: number;
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
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

export function createGameServer(opt: ServerOptions) {
  const now = opt.now ?? Date.now;
  const rng = opt.rng ?? Math.random;
  const { cfg } = opt;
  const adminIds = new Set(opt.adminIds ?? []);
  const isAdmin = (tgId: number) => opt.auth.devAuth || adminIds.has(tgId);
  const uploadsDir = join(opt.dataDir ?? '.', 'uploads', 'cards');
  const game = new Game({ db: opt.db, cfg, now, rng, isAdmin });
  const conns = new Map<number, Conn>();
  let queue: Conn[] = [];
  const turnMs = () => opt.turnMs ?? cfg.turnSeconds * 1000;

  const send = (c: Conn, m: ServerMsg) => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(m)); };

  // ---------- مبارزه ----------
  function startBattle(mode: 'solo' | 'pvp', a: Participant, b: Participant, humans: Conn[], soloStage?: number) {
    const id = randomUUID();
    const battle = new Battle({
      id, mode, cfg, rng, turnMs: turnMs(), pauseMs: opt.pauseMs ?? 900, botDelayMs: opt.botDelayMs ?? 700,
      onEnd: ({ winner, reason }) => {
        for (const c of humans) {
          c.battle = null;
          const side = battle.sideOf(c.userId)!;
          const won = side === winner;
          let reward = null;
          try { reward = game.recordResult(c.userId, won, won ? soloStage : undefined); } catch (e) { console.error(e); }
          send(c, { t: 'battleEnd', battleId: id, winner, youWon: won, reason, reward, profile: game.profile(c.userId) });
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

  function handleMsg(c: Conn, m: ClientMsg) {
    switch (m.t) {
      case 'queue': {
        if (c.battle || c.queued) return send(c, { t: 'error', message: 'الان درگیر مبارزه یا صف هستی' });
        game.deckUnits(c.userId); // دک کامل؟
        const opp = queue.find((q) => q.userId !== c.userId && q.ws.readyState === 1);
        if (!opp) { c.queued = true; queue.push(c); return send(c, { t: 'queued' }); }
        queue = queue.filter((q) => q !== opp);
        startBattle('pvp', human(opp, 'A'), human(c, 'B'), [opp, c]);
        return;
      }
      case 'leaveQueue':
        queue = queue.filter((q) => q !== c); c.queued = false; return;
      case 'solo': {
        if (c.battle || c.queued) return send(c, { t: 'error', message: 'الان درگیر مبارزه یا صف هستی' });
        const stage = Number(m.stage);
        const profile = game.profile(c.userId);
        const def = cfg.solo.stages[stage];
        if (!def || !Number.isInteger(stage) || stage < 0 || stage > profile.soloStage) {
          return send(c, { t: 'error', message: 'این مرحله هنوز باز نشده' });
        }
        const botUnits = def.deck.map(([id, lvl]) => resolveCard(cfg.cards.find((x) => x.id === id)!, lvl, cfg));
        const bot: Participant = { side: 'B', name: def.name, userId: null, send: null, ai: def.ai, units: botUnits };
        startBattle('solo', human(c, 'A'), bot, [c], stage);
        return;
      }
      case 'target':
        if (c.battle && c.battle.id === m.battleId && typeof m.uid === 'string') c.battle.handleTarget(c.userId, m.uid);
        return;
    }
  }

  // ---------- WebSocket ----------
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  wss.on('connection', (ws) => {
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
          if (old && old.ws !== ws) old.ws.close(); // اتصال قبلی → اگه وسط مبارزه بود می‌بازه
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
    ws.on('close', () => {
      if (!conn) return;
      queue = queue.filter((q) => q !== conn);
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
          ...(card.ability ? { ability: card.ability } : {}), ...(card.desc ? { desc: String(card.desc).slice(0, 120) } : {}),
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
      case '/api/admin/users':
        return json(res, 200, { users: game.adminUsers(url.searchParams.get('q') ?? '') });
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
    const body = req.method === 'POST' ? await readBody(req) : {};
    try {
      let extra: object = {};
      switch (path) {
        case '/api/me': break;
        case '/api/deck': game.setDeck(userId, body.cards); break;
        case '/api/upgrade': game.upgradeCard(userId, String(body.cardId)); break;
        case '/api/box/start': game.startBox(userId, Number(body.slot)); break;
        case '/api/box/open': extra = { reward: game.openBox(userId, Number(body.slot)) }; break;
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

  function serveStatic(res: ServerResponse, path: string) {
    const dir = opt.staticDir;
    if (!dir || !existsSync(dir)) { res.writeHead(404); return res.end('client not built'); }
    let file = normalize(join(dir, path));
    if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(dir, 'index.html'); // SPA
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  }

  const http = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    if (path === '/health') return json(res, 200, { ok: true });
    if (path.startsWith('/api/')) return void api(req, res, path);
    if (path.startsWith('/uploads/cards/')) {
      const name = path.slice('/uploads/cards/'.length);
      const f = join(uploadsDir, name);
      if (!/^[a-z0-9_]+\.(png|jpg|webp)$/.test(name) || !existsSync(f)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': MIME[extname(f)] ?? (f.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream'), 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' });
      return res.end(readFileSync(f));
    }
    serveStatic(res, path);
  });
  http.on('upgrade', (req, socket, head) => {
    if (new URL(req.url ?? '/', 'http://x').pathname !== '/ws') return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  return { http, game, close: () => { wss.clients.forEach((c) => c.close()); http.close(); } };
}
