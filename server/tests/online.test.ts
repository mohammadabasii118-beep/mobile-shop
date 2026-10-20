import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { AddressInfo } from 'node:net';
import { loadConfig } from '../src/config';
import { openDb } from '../src/db';
import { createGameServer } from '../src/server';
import type { ServerMsg } from '@game/shared';

let srv: ReturnType<typeof createGameServer>;
let base = '';
beforeAll(async () => {
  srv = createGameServer({
    db: openDb(), cfg: loadConfig(), auth: { devAuth: true },
    pauseMs: 5, botDelayMs: 2, turnMs: 400,
  });
  await new Promise<void>((r) => srv.http.listen(0, r));
  base = `127.0.0.1:${(srv.http.address() as AddressInfo).port}`;
});
afterAll(() => srv.close());

class Client {
  ws: WebSocket; opened: Promise<unknown>; msgs: ServerMsg[] = []; waiters: ((m: ServerMsg) => void)[] = [];
  constructor(public id: number) {
    this.ws = new WebSocket(`ws://${base}/ws`);
    this.opened = new Promise((r) => this.ws.once('open', r));
    this.ws.on('message', (d) => { const m = JSON.parse(d.toString()); this.msgs.push(m); this.waiters.forEach((w) => w(m)); });
  }
  async open() { await this.opened; this.send({ t: 'hello', initData: `dev:${this.id}:P${this.id}` }); await this.wait('ready'); }
  send(m: object) { this.ws.send(JSON.stringify(m)); }
  wait<T extends ServerMsg['t']>(t: T, ms = 8000): Promise<Extract<ServerMsg, { t: T }>> {
    const found = this.msgs.find((m) => m.t === t);
    if (found) { this.msgs.splice(this.msgs.indexOf(found), 1); return Promise.resolve(found as any); }
    return new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('timeout ' + t)), ms);
      const w = (m: ServerMsg) => { if (m.t === t) { clearTimeout(to); this.waiters = this.waiters.filter((x) => x !== w); this.msgs.splice(this.msgs.indexOf(m), 1); res(m as any); } };
      this.waiters.push(w);
    });
  }
}

const api = (id: number, path: string, body?: object) =>
  fetch(`http://${base}${path}`, { method: body ? 'POST' : 'GET', headers: { 'x-init-data': `dev:${id}:P${id}` }, body: body && JSON.stringify(body) }).then((r) => r.json() as any);

describe('online', () => {
  it('rejects unauthenticated REST', async () => {
    const r = await fetch(`http://${base}/api/me`);
    expect(r.status).toBe(401);
  });

  it('solo stage 1: full battle (auto-timeouts pick random targets), winner gets a box', async () => {
    const c = new Client(100);
    await c.open();
    c.send({ t: 'solo', stage: 0 });
    const start = await c.wait('battleStart');
    expect(start.units).toHaveLength(10);
    expect(start.opponent).toBe('گودال ۱ — لول ۱');
    const end = await c.wait('battleEnd', 30000);
    expect(['A', 'B']).toContain(end.winner);
    expect(end.profile.wins + end.profile.losses).toBe(1);
    if (end.youWon) { expect(end.reward?.box).toBe(0); expect(end.profile.soloStage).toBe(1); }
    else expect(end.reward).toBeNull();
    c.ws.close();
  }, 60000);

  it('solo: locked stages are refused', async () => {
    const c = new Client(101);
    await c.open();
    c.send({ t: 'solo', stage: 5 });
    expect((await c.wait('error')).message).toMatch(/باز نشده/);
    c.ws.close();
  });

  it('pvp: matchmaking pairs two players, human target choice works, disconnect = loss', async () => {
    const a = new Client(200), b = new Client(201);
    await a.open(); await b.open();
    a.send({ t: 'queue' }); await a.wait('queued');
    b.send({ t: 'queue' });
    const sa = await a.wait('battleStart'); const sb = await b.wait('battleStart');
    expect(sa.battleId).toBe(sb.battleId);
    expect(new Set([sa.you, sb.you])).toEqual(new Set(['A', 'B']));
    // اولین prompt: صاحب نوبت یک هدف معتبر می‌فرسته؛ هدف نامعتبر نادیده گرفته می‌شه
    const pa = await a.wait('prompt'); const pb = await b.wait('prompt');
    const mover = pa.mine ? a : b; const moverSide = pa.mine ? sa.you : sb.you;
    const foe = moverSide === 'A' ? 'B0' : 'A0';
    const pm = pa.mine ? pa : pb;
    expect(pm.available).toContain(moverSide + '2');             // هر کارتی می‌تواند حمله‌کننده باشد
    mover.send({ t: 'attack', battleId: sa.battleId, from: moverSide + '0', uid: moverSide + '1' }); // هم‌تیمی → نامعتبر
    mover.send({ t: 'attack', battleId: sa.battleId, from: moverSide + '2', uid: foe });
    let atk: any;
    while (!atk) { const ev = await mover.wait('events'); atk = ev.events.find((e) => e.type === 'attack'); }
    expect(atk).toMatchObject({ from: moverSide + '2', to: foe });
    // b قطع می‌شه → a برنده
    b.ws.close();
    const end = await a.wait('battleEnd', 5000);
    expect(end.youWon).toBe(true);
    expect(end.reason).toBe('disconnect');
    expect(end.reward?.box).not.toBeNull();
    a.ws.close();
    void pb;
  }, 20000);

  it('pvp: preset chat reaches the opponent only; leaving = loss for the leaver', async () => {
    const a = new Client(210), b = new Client(211);
    await a.open(); await b.open();
    a.send({ t: 'queue' }); await a.wait('queued');
    b.send({ t: 'queue' });
    const sa = await a.wait('battleStart'); await b.wait('battleStart');
    a.send({ t: 'chat', battleId: sa.battleId, id: 99 });   // نامعتبر
    a.send({ t: 'chat', battleId: sa.battleId, id: 3 });
    const ch = await b.wait('chat'); expect(ch.id).toBe(3); expect(ch.text).toBe('موفق باشی');
    b.send({ t: 'leave', battleId: sa.battleId });
    const end = await a.wait('battleEnd', 5000);
    expect(end.youWon).toBe(true);
    expect(end.reason).toBe('left');
    a.ws.close(); b.ws.close();
  }, 20000);

  it('friends: request, accept, then a friendly invite starts a battle without rewards', async () => {
    const ia = (await api(220, '/api/me')).profile.id as number;
    const ib = (await api(221, '/api/me')).profile.id as number;
    expect((await api(220, '/api/friends/add', { code: String(ia) })).error).toMatch(/خودته/);
    expect((await api(220, '/api/friends/add', { code: '999999' })).error).toBeTruthy();
    const r = await api(220, '/api/friends/add', { code: String(ib) });
    expect(r.accepted).toBe(false);
    expect((await api(220, '/api/friends/add', { code: String(ib) })).error).toMatch(/قبلاً/);
    const inc = await api(221, '/api/friends');
    expect(inc.incoming.map((f: any) => f.id)).toEqual([ia]);
    const a = new Client(220), b = new Client(221);
    await a.open(); await b.open();
    a.send({ t: 'invite', to: ib });                       // هنوز دوست نیستند
    expect((await a.wait('error')).message).toMatch(/دوست/);
    await api(221, '/api/friends/accept', { id: ia });
    expect((await api(220, '/api/friends')).friends[0]).toMatchObject({ id: ib, online: true, busy: false });
    a.send({ t: 'invite', to: ib });
    expect((await b.wait('invited')).from).toBe(ia);
    b.send({ t: 'inviteReply', from: ia, accept: true });
    const sa = await a.wait('battleStart'); await b.wait('battleStart');
    expect(sa.mode).toBe('pvp');
    b.send({ t: 'leave', battleId: sa.battleId });
    const end = await a.wait('battleEnd', 5000);
    expect(end).toMatchObject({ youWon: true, friendly: true, reward: null });
    expect(end.profile.wins).toBe(0);
    // دعوت ردشده
    a.send({ t: 'invite', to: ib }); await b.wait('invited');
    b.send({ t: 'inviteReply', from: ia, accept: false });
    expect((await a.wait('inviteResult')).status).toBe('declined');
    await api(220, '/api/friends/remove', { id: ib });
    expect((await api(221, '/api/friends')).friends).toHaveLength(0);
    a.ws.close(); b.ws.close();
  }, 20000);

  it('REST: deck, box lifecycle (dev skip), upgrade errors', async () => {
    await api(300, '/api/me');
    expect((await api(300, '/api/deck', { cards: ['giv', 'x', 'bijan'] })).error).toBeTruthy();
    expect((await api(300, '/api/box/start', { slot: 0 })).error).toBeTruthy();
    const r = await api(300, '/api/upgrade', { cardId: 'giv' });
    expect(r.error).toMatch(/تعداد کارت/);
  });
});

describe('entry fees', () => {
  it('solo costs the configured fee per stage and is refused when coins are short; multiplayer charges both players on match', async () => {
    const cfg = loadConfig();
    const s2 = createGameServer({ db: openDb(), cfg: { ...cfg, fees: { solo: 150, multi: 60 } }, auth: { devAuth: true }, pauseMs: 5, botDelayMs: 2, turnMs: 400 });
    await new Promise<void>((r) => s2.http.listen(0, r));
    const saved = base;
    base = `127.0.0.1:${(s2.http.address() as AddressInfo).port}`;
    try {
      const a = new Client(500);
      await a.open();
      a.send({ t: 'solo', stage: 0 });
      expect((await a.wait('error')).message).toMatch(/150/); // موجودی ۱۰۰ کافی نیست
      a.send({ t: 'queue' }); await a.wait('queued');
      const b = new Client(501);
      await b.open();
      b.send({ t: 'queue' });
      expect((await a.wait('profile')).profile.coins).toBe(40);
      expect((await b.wait('profile')).profile.coins).toBe(40);
      await a.wait('battleStart'); await b.wait('battleStart');
      a.ws.close(); b.ws.close();
    } finally { s2.close(); base = saved; }
  }, 20000);

  it('default config: solo stage costs 10 coins up front', async () => {
    const c = new Client(510);
    await c.open();
    c.send({ t: 'solo', stage: 0 });
    expect((await c.wait('profile')).profile.coins).toBe(90);
    await c.wait('battleStart');
    c.ws.close();
  });
});

describe('connection safety', () => {
  it('a second login of the same account closes the first with code 4001 (so the client can explain why)', async () => {
    const a1 = new Client(600);
    await a1.open();
    const closed = new Promise<number>((r) => a1.ws.once('close', (code) => r(code)));
    const a2 = new Client(600);
    await a2.open();
    expect(await closed).toBe(4001);
    a2.ws.close();
  });

  it('heartbeat pings keep idle connections alive', async () => {
    const s3 = createGameServer({ db: openDb(), cfg: loadConfig(), auth: { devAuth: true }, heartbeatMs: 30 });
    await new Promise<void>((r) => s3.http.listen(0, r));
    const ws = new WebSocket(`ws://127.0.0.1:${(s3.http.address() as AddressInfo).port}/ws`);
    let pings = 0;
    ws.on('ping', () => pings++);
    await new Promise((r) => ws.once('open', r));
    await new Promise((r) => setTimeout(r, 300));
    expect(pings).toBeGreaterThanOrEqual(3);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close(); s3.close();
  });
});

describe('version', () => {
  it('/api/version reports the current client bundle and never caches', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'dist-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'assets', 'index-AbCd1234.js'), '//');
    const s4 = createGameServer({ db: openDb(), cfg: loadConfig(), auth: { devAuth: true }, staticDir: dir });
    await new Promise<void>((r) => s4.http.listen(0, r));
    const r = await fetch(`http://127.0.0.1:${(s4.http.address() as AddressInfo).port}/api/version`);
    expect(await r.json()).toEqual({ bundle: 'index-AbCd1234.js' });
    expect(r.headers.get('cache-control')).toBe('no-store');
    s4.close();
  });
});
