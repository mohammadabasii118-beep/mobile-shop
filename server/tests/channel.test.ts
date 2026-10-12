import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { openDb } from '../src/db';
import { createGameServer } from '../src/server';

const TOKEN = '123:CHANNEL-TEST';
const sign = (id: number) => {
  const f: Record<string, string> = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: 'U' + id }) };
  const check = Object.entries(f).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const hash = createHmac('sha256', createHmac('sha256', 'WebAppData').update(TOKEN).digest()).update(check).digest('hex');
  return new URLSearchParams({ ...f, hash }).toString();
};

// تلگرام جعلی: وضعیت عضویت هر کاربر
const status: Record<number, string> = {};
let tgCalls = 0;
const fake = createServer((req, res) => {
  tgCalls++;
  const u = new URL(req.url!, 'http://x');
  const uid = Number(u.searchParams.get('user_id'));
  res.setHeader('content-type', 'application/json');
  if (u.searchParams.get('chat_id') !== '@MirasGame') return res.end(JSON.stringify({ ok: false, description: 'Bad Request: chat not found' }));
  if (uid === 999) return res.end(JSON.stringify({ ok: false, description: 'Bad Request: member list is inaccessible' }));
  res.end(JSON.stringify({ ok: true, result: { status: status[uid] ?? 'left', is_member: status[uid] === 'restricted-in' } }));
});

let srv: ReturnType<typeof createGameServer>;
let base = '';
beforeAll(async () => {
  await new Promise<void>((r) => fake.listen(0, r));
  srv = createGameServer({
    db: openDb(), cfg: loadConfig(), auth: { botToken: TOKEN, devAuth: false }, adminIds: [42],
    telegramApi: `http://127.0.0.1:${(fake.address() as AddressInfo).port}`,
  });
  await new Promise<void>((r) => srv.http.listen(0, r));
  base = `http://127.0.0.1:${(srv.http.address() as AddressInfo).port}`;
});
afterAll(() => { srv.close(); fake.close(); });

const call = (id: number, path: string, body?: object) =>
  fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'x-init-data': sign(id), 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
const json = async (r: Response) => (await r.json()) as any;

describe('forced channel membership', () => {
  it('non-members are gated: profile says channelOk=false and game actions are refused', async () => {
    expect((await json(await call(10, '/api/me'))).profile.channelOk).toBe(false);
    const r = await call(10, '/api/deck', { cards: ['giv', 'bijan', 'arash'] });
    expect(r.status).toBe(403);
    expect((await json(r)).code).toBe('channel_required');
  });

  it('"I joined" verifies with Telegram: refused while not a member, accepted once, then never asked again', async () => {
    let r = await json(await call(11, '/api/channel/verify', {}));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/عضو کانال نیستی/);
    status[11] = 'member';
    await new Promise((res) => setTimeout(res, 2100)); // محدودیت ۲ ثانیه بین بررسی‌ها
    r = await json(await call(11, '/api/channel/verify', {}));
    expect(r.ok).toBe(true);
    expect(r.profile.channelOk).toBe(true);
    // بعد از تأیید: دسترسی باز می‌شود و دیگر از تلگرام نمی‌پرسد، حتی اگر بعداً کانال را ترک کند
    status[11] = 'left';
    const before = tgCalls;
    expect((await json(await call(11, '/api/me'))).profile.channelOk).toBe(true);
    expect((await call(11, '/api/deck', { cards: ['giv', 'bijan', 'arash'] })).status).toBe(200);
    await call(11, '/api/channel/verify', {});
    expect(tgCalls).toBe(before);
  });

  it('rate limits rapid verify clicks, treats creator/administrator as members, and reports Telegram failures', async () => {
    status[12] = 'administrator';
    let r = await json(await call(12, '/api/channel/verify', {}));
    expect(r.ok).toBe(true);
    // کاربری که بررسی‌اش با خطای تلگرام تمام می‌شود (ربات ادمین نیست): ۵۰۲ و پیام روشن
    const r2 = await call(999, '/api/channel/verify', {});
    expect(r2.status).toBe(502);
    // کلیک پشت‌سرهم
    status[13] = 'left';
    await call(13, '/api/channel/verify', {});
    r = await json(await call(13, '/api/channel/verify', {}));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/صبر کن/);
  });

  it('non-members cannot start battles over the websocket either', async () => {
    const { default: WebSocket } = await import('ws');
    const ws = new WebSocket(base.replace('http', 'ws') + '/ws');
    const msgs: any[] = [];
    ws.on('message', (d) => msgs.push(JSON.parse(d.toString())));
    await new Promise((r) => ws.once('open', r));
    ws.send(JSON.stringify({ t: 'hello', initData: sign(20) }));
    await new Promise((r) => setTimeout(r, 200));
    ws.send(JSON.stringify({ t: 'solo', stage: 0 }));
    ws.send(JSON.stringify({ t: 'queue' }));
    await new Promise((r) => setTimeout(r, 200));
    expect(msgs.some((m) => m.t === 'battleStart' || m.t === 'queued')).toBe(false);
    expect(msgs.filter((m) => m.t === 'error').map((m) => m.message)).toEqual(['اول باید عضو کانال بشی', 'اول باید عضو کانال بشی']);
    ws.close();
  });

  it('game admins are exempt', async () => {
    expect((await json(await call(42, '/api/me'))).profile.channelOk).toBe(true);
  });
});
