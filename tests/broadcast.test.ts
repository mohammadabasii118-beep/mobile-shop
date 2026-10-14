import http from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client';
import { createBot } from '../src/bot';
import { createServer } from '../src/server';
import { createLoginToken } from '../src/admin-web/auth';
import { resetPanelRateLimits } from '../src/admin-web/http';
import { registerUser } from '../src/modules/users/service';
import { applyForPartner, approvePartner } from '../src/modules/partners/service';
import {
  BroadcastMessage, audienceCounts, cancelBroadcast, classifySendError, createBroadcast, getBroadcast, renderBroadcast, resetBroadcastWorker, runBroadcastTick,
  sendTestBroadcast, setBroadcastSender, validateDraft,
} from '../src/modules/broadcast/service';
import { makeOrder, makeProduct, makeUser, resetDb, setup } from './helpers';

let sent: ReturnType<typeof setup>['sent'];
let out: BroadcastMessage[] = [];
let failWith: ((m: BroadcastMessage) => unknown) | undefined;
beforeEach(async () => {
  await resetDb(); ({ sent } = setup()); resetBroadcastWorker();
  out = []; failWith = undefined;
  setBroadcastSender(async (m) => { const f = failWith?.(m); if (f) throw f; out.push(m); });
});

const ADMIN = 'admin:9000';
const fast = { gapMs: 0 };
async function svc(userId: string, status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED', days = 20) {
  const p = await makeProduct({ name: `p${Math.random()}` });
  const o = await makeOrder(userId, p.id);
  const id = Math.random().toString(36).slice(2);
  return prisma.vpnService.create({ data: { userId, orderId: o.id, productId: p.id, provider: 'default', inboundId: 1, externalId: `e${id}`, uuid: `u${id}`, subId: 's', protocol: 'VLESS', trafficLimit: 1n, expiresAt: new Date(Date.now() + days * 86_400_000), status, provisioningStatus: 'SUCCESS' } });
}
async function fixtures() {
  const [active, expired, none, partner, banned, botBlocked, expiring, cancelledOnly] = [await makeUser(), await makeUser(), await makeUser(), await makeUser(), await makeUser(), await makeUser(), await makeUser(), await makeUser()];
  await svc(active.id, 'ACTIVE'); await svc(expired.id, 'EXPIRED', -3); await svc(expiring.id, 'ACTIVE', 2); await svc(cancelledOnly.id, 'CANCELLED');
  await applyForPartner(partner.id); await approvePartner('a', (await prisma.partner.findUniqueOrThrow({ where: { userId: partner.id } })).id, 10);
  await prisma.user.update({ where: { id: banned.id }, data: { isBlocked: true } });
  await prisma.user.update({ where: { id: botBlocked.id }, data: { botBlockedAt: new Date() } });
  return { active, expired, none, partner, banned, botBlocked, expiring, cancelledOnly };
}

describe('audiences', () => {
  it('each group contains exactly the right people; banned users and users who blocked the bot are never included', async () => {
    const f = await fixtures();
    const c = await audienceCounts();
    expect(c).toEqual({ ALL: 6, ACTIVE: 2, EXPIRING: 1, EXPIRED: 1, NO_PURCHASE: 2, PARTNERS: 1 });
    const who = async (a: string) => (await prisma.broadcastRecipient.findMany({ where: { broadcastId: (await createBroadcast(ADMIN, { text: `x ${a}` }, a)).id } })).map((r) => r.userId).sort();
    expect(await who('ACTIVE')).toEqual([f.active.id, f.expiring.id].sort());
    expect(await who('EXPIRING')).toEqual([f.expiring.id]);
    expect(await who('EXPIRED')).toEqual([f.expired.id]);
    expect(await who('NO_PURCHASE')).toEqual([f.none.id, f.partner.id].sort()); // someone whose only service was deleted did buy once
    expect(await who('PARTNERS')).toEqual([f.partner.id]);
    const all = await who('ALL');
    expect(all).not.toContain(f.banned.id); expect(all).not.toContain(f.botBlocked.id);
  });
});

describe('draft + rendering', () => {
  it('validation: empty, length (text vs photo caption), button pairs, only http(s) links', () => {
    expect(() => validateDraft({ text: '  ' })).toThrow(/خالی/);
    expect(() => validateDraft({ text: 'x'.repeat(3501) })).toThrow(/طولانی/);
    expect(() => validateDraft({ text: 'x'.repeat(1001), photoFileId: 'f' })).toThrow(/کپشن/);
    expect(validateDraft({ text: '', photoFileId: 'f' }).photoFileId).toBe('f'); // a photo alone is fine
    expect(() => validateDraft({ text: 'hi', buttonText: 'go' })).toThrow(/هم «متن» و هم «لینک»/);
    expect(() => validateDraft({ text: 'hi', buttonText: 'go', buttonUrl: 'javascript:alert(1)' })).toThrow(/http/);
    expect(() => validateDraft({ text: 'hi', buttonText: 'go', buttonUrl: 'not a url' })).toThrow(/نامعتبر/);
    expect(validateDraft({ text: 'hi', buttonText: 'go', buttonUrl: 'https://t.me/Speedvpnx_bot' }).buttonUrl).toBe('https://t.me/Speedvpnx_bot');
  });
  it('HTML is escaped (an admin typo cannot break Telegram parsing), *bold* and {name} work', () => {
    expect(renderBroadcast('<b>x</b> & *مهم* سلام {name}', 'علی')).toBe('&lt;b&gt;x&lt;/b&gt; &amp; <b>مهم</b> سلام علی');
    expect(renderBroadcast('سلام {name}', null)).toBe('سلام دوست عزیز');
    expect(renderBroadcast('{name}', '<i>*evil*</i>')).not.toContain('<i>');
  });
});

describe('create + deliver', () => {
  it('delivers each recipient exactly once across ticks, personalised, then finishes and tells the creator', async () => {
    for (let i = 0; i < 70; i++) await registerUser({ id: 5_000_000 + i, first_name: `U${i}` });
    const b = await createBroadcast(ADMIN, { text: 'سلام {name}', buttonText: 'ربات', buttonUrl: 'https://t.me/Speedvpnx_bot' }, 'ALL');
    expect(b.total).toBe(70);
    let ticks = 0;
    while ((await getBroadcast(b.id)).status === 'RUNNING' && ticks < 10) { await runBroadcastTick({ batch: 30, ...fast }); ticks++; }
    expect(ticks).toBe(3);
    const p = await getBroadcast(b.id);
    expect(p).toMatchObject({ status: 'DONE', sent: 70, pending: 0, blocked: 0, failed: 0 });
    expect(new Set(out.map((m) => String(m.chatId))).size).toBe(70); // nobody twice
    expect(out.find((m) => m.chatId === 5_000_007n)!.html).toBe('سلام U7');
    expect(out[0].button).toEqual({ text: 'ربات', url: 'https://t.me/Speedvpnx_bot' });
    expect(sent.some((m) => m.chatId === 9000n && m.text.includes('پیام همگانی تمام شد') && m.text.includes('ارسال‌شده: 70'))).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: { in: ['broadcast.create', 'broadcast.done'] } } })).toBe(2);
  });

  it('refuses an accidental double send, an empty audience and a bad audience', async () => {
    await makeUser();
    await createBroadcast(ADMIN, { text: 'same' }, 'ALL');
    await expect(createBroadcast(ADMIN, { text: 'same' }, 'ALL')).rejects.toThrow(/چند دقیقه پیش/);
    await expect(createBroadcast(ADMIN, { text: 'other' }, 'PARTNERS')).rejects.toThrow(/مخاطب/);
    await expect(createBroadcast(ADMIN, { text: 'other' }, 'EVERYONE')).rejects.toThrow(/نامعتبر/);
  });

  it('two overlapping workers never double-send', async () => {
    for (let i = 0; i < 40; i++) await registerUser({ id: 6_000_000 + i });
    const b = await createBroadcast(ADMIN, { text: 'x' }, 'ALL');
    await Promise.all([runBroadcastTick({ batch: 40, ...fast }), runBroadcastTick({ batch: 40, ...fast })]);
    expect(out).toHaveLength(40);
    expect((await getBroadcast(b.id)).status).toBe('DONE');
  });

  it('a user who blocked the bot is marked, skipped next time, and reachable again once they write', async () => {
    const u = await registerUser({ id: 7_000_001 }); await registerUser({ id: 7_000_002 });
    failWith = (m) => (m.chatId === 7_000_001n ? { error_code: 403, description: 'Forbidden: bot was blocked by the user' } : undefined);
    const b = await createBroadcast(ADMIN, { text: 'hello' }, 'ALL');
    await runBroadcastTick({ ...fast });
    expect(await getBroadcast(b.id)).toMatchObject({ status: 'DONE', sent: 1, blocked: 1 });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.user.id } })).botBlockedAt).not.toBeNull();
    expect((await audienceCounts()).ALL).toBe(1);
    await registerUser({ id: 7_000_001 }); // they wrote to the bot again
    expect((await audienceCounts()).ALL).toBe(2);
  });

  it('Telegram flood control (429) pauses the whole worker without losing or duplicating anyone', async () => {
    for (let i = 0; i < 10; i++) await registerUser({ id: 8_000_000 + i });
    let n = 0;
    failWith = () => (++n === 4 ? { error_code: 429, description: 'Too Many Requests', parameters: { retry_after: 7 } } : undefined);
    const b = await createBroadcast(ADMIN, { text: 'x' }, 'ALL');
    expect(await runBroadcastTick({ ...fast })).toMatchObject({ sent: 3, paused: true });
    expect(await runBroadcastTick({ ...fast })).toMatchObject({ sent: 0, paused: true }); // still waiting
    expect(out).toHaveLength(3);
    resetBroadcastWorker(); // "time passed"
    await runBroadcastTick({ ...fast });
    expect(out).toHaveLength(10); expect(new Set(out.map((m) => String(m.chatId))).size).toBe(10);
    expect((await getBroadcast(b.id)).status).toBe('DONE');
  });

  it('transient errors are retried and then recorded as failed, not retried forever', async () => {
    await registerUser({ id: 9_000_001 });
    failWith = () => new Error('ETIMEDOUT');
    const b = await createBroadcast(ADMIN, { text: 'x' }, 'ALL');
    for (let i = 0; i < 5; i++) await runBroadcastTick({ ...fast });
    expect(await getBroadcast(b.id)).toMatchObject({ status: 'DONE', failed: 1, sent: 0, pending: 0 });
    expect((await prisma.broadcastRecipient.findFirstOrThrow({ where: { broadcastId: b.id } })).attempts).toBe(3);
  });

  it('cancel stops further sending but keeps what was sent', async () => {
    for (let i = 0; i < 20; i++) await registerUser({ id: 9_100_000 + i });
    const b = await createBroadcast(ADMIN, { text: 'x' }, 'ALL');
    await runBroadcastTick({ batch: 5, ...fast });
    await cancelBroadcast(ADMIN, b.id);
    await runBroadcastTick({ batch: 5, ...fast });
    expect(out).toHaveLength(5);
    expect(await getBroadcast(b.id)).toMatchObject({ status: 'CANCELLED', sent: 5, pending: 15 });
    await expect(cancelBroadcast(ADMIN, b.id)).rejects.toThrow(/دیگر در حال اجرا نیست/);
  });

  it('error classification', () => {
    expect(classifySendError({ error_code: 429, parameters: { retry_after: 3 } })).toEqual({ kind: 'retry', afterS: 3 });
    expect(classifySendError({ error_code: 429 })).toMatchObject({ kind: 'retry' });
    for (const d of ['Forbidden: bot was blocked by the user', 'Forbidden: user is deactivated', 'Bad Request: chat not found']) expect(classifySendError({ description: d, error_code: 400 }).kind).toBe('blocked');
    expect(classifySendError(new Error('socket hang up')).kind).toBe('error');
  });

  it('test message goes only to the given chat and is not stored', async () => {
    await sendTestBroadcast(123n, { text: 'hi {name}' }, 'Sara');
    expect(out).toEqual([{ chatId: 123n, html: 'hi Sara', photoFileId: null, button: null }]);
    expect(await prisma.broadcast.count()).toBe(0);
  });
});

describe('Telegram admin screens', () => {
  const ADMIN_ID = 9000;
  let api: { method: string; payload: any }[] = [];
  let bot: ReturnType<typeof createBot>;
  let uid = 1;
  beforeEach(() => {
    api = [];
    bot = createBot('123:TEST', { botInfo: { id: 123, is_bot: true, first_name: 'B', username: 'b', can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false, allows_users_to_create_topics: false } as any, fetchFile: async () => Buffer.from('x') });
    bot.api.config.use(async (_p, method, payload: any) => { api.push({ method, payload }); return { ok: true, result: method.startsWith('send') || method.startsWith('edit') ? { message_id: api.length, date: 0, chat: { id: payload.chat_id ?? 1, type: 'private' }, text: payload.text } : true } as any; });
  });
  const who = (id: number) => ({ from: { id, is_bot: false, first_name: 'Admin' }, chat: { id, type: 'private' as const } });
  const say = (id: number, text: string) => bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, ...who(id), text, entities: text.startsWith('/') ? [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }] : undefined } } as any);
  const photo = (id: number, caption: string) => bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, ...who(id), photo: [{ file_id: 'small', file_unique_id: 'a', width: 1, height: 1 }, { file_id: 'BIG', file_unique_id: 'b', width: 9, height: 9 }], caption } } as any);
  const tap = (id: number, data: string) => bot.handleUpdate({ update_id: uid++, callback_query: { id: String(uid), from: who(id).from, chat_instance: 'x', data, message: { message_id: 1, date: 0, chat: who(id).chat, text: 'x' } } } as any);
  const last = () => api.filter((c) => ['sendMessage', 'editMessageText'].includes(c.method)).at(-1)!;
  const cbs = () => (last().payload.reply_markup?.inline_keyboard ?? []).flat().map((b: any) => b.callback_data) as string[];

  it('full flow: write → preview → button → audience (with counts) → confirm → progress; the real sender reaches users', async () => {
    await registerUser({ id: 4_000_001, first_name: 'Reza' }); await registerUser({ id: 4_000_002, first_name: 'Sara' });
    await say(ADMIN_ID, '/admin'); expect(cbs()).toContain('bm:h');
    await tap(ADMIN_ID, 'bm:h'); expect(cbs()).toContain('bm:new');
    await tap(ADMIN_ID, 'bm:new');
    await say(ADMIN_ID, 'x'.repeat(4000)); expect(last().payload.text).toContain('طولانی'); // validation keeps the step
    await say(ADMIN_ID, 'سلام {name}، *تخفیف* ویژه 🎁');
    expect(api.some((c) => c.method === 'sendMessage' && c.payload.chat_id === ADMIN_ID && c.payload.text.includes('سلام Admin، <b>تخفیف</b>') && c.payload.parse_mode === 'HTML')).toBe(true); // preview, personalised
    expect(cbs()).toEqual(expect.arrayContaining(['bm:aud', 'bm:btn']));
    await tap(ADMIN_ID, 'bm:btn'); await say(ADMIN_ID, 'فقط یک خط'); expect(last().payload.text).toContain('دو خط');
    await say(ADMIN_ID, 'خرید\nhttps://t.me/Speedvpnx_bot');
    await tap(ADMIN_ID, 'bm:aud'); expect(last().payload.reply_markup.inline_keyboard.flat().map((b: any) => b.text).join(' ')).toContain('همه‌ی کاربران (3)'); // 2 users + the admin who just wrote
    await tap(ADMIN_ID, 'bm:a:ALL'); expect(last().payload.text).toContain('3 نفر'); expect(cbs()).toContain('bm:go:ALL');
    await tap(ADMIN_ID, 'bm:go:ALL');
    expect(last().payload.text).toContain('در حال ارسال');
    const before = api.length;
    await runBroadcastTick({ ...fast });
    const delivered = api.slice(before).filter((c) => c.method === 'sendMessage' && [4_000_001, 4_000_002].includes(c.payload.chat_id));
    expect(delivered).toHaveLength(2);
    expect(delivered.find((c) => c.payload.chat_id === 4_000_001)!.payload.text).toBe('سلام Reza، <b>تخفیف</b> ویژه 🎁');
    expect(delivered[0].payload.reply_markup.inline_keyboard[0][0]).toMatchObject({ text: 'خرید', url: 'https://t.me/Speedvpnx_bot' });
    const id = (await prisma.broadcast.findFirstOrThrow()).id;
    await tap(ADMIN_ID, `bm:v:${id}`); expect(last().payload.text).toContain('تمام شد'); expect(last().payload.text).toContain('ارسال‌شده: 3');
  });

  it('photo + caption broadcast is sent as a photo', async () => {
    await registerUser({ id: 4_100_001 });
    await tap(ADMIN_ID, 'bm:new'); await photo(ADMIN_ID, 'کپشن *ویژه*');
    await tap(ADMIN_ID, 'bm:go:NO_PURCHASE');
    await runBroadcastTick({ ...fast });
    const p = api.find((c) => c.method === 'sendPhoto' && c.payload.chat_id === 4_100_001)!;
    expect(p.payload.photo).toBe('BIG'); expect(p.payload.caption).toBe('کپشن <b>ویژه</b>');
  });

  it('stop button cancels; only SUPER_ADMIN can use it; crafted callbacks are refused', async () => {
    await registerUser({ id: 4_200_001 });
    await tap(ADMIN_ID, 'bm:new'); await say(ADMIN_ID, 'پیام'); await tap(ADMIN_ID, 'bm:go:ALL');
    const id = (await prisma.broadcast.findFirstOrThrow()).id;
    await tap(ADMIN_ID, `bm:x:${id}`); expect(cbs()).toContain(`bm:x2:${id}`);
    await tap(ADMIN_ID, `bm:x2:${id}`); expect(last().payload.text).toContain('متوقف شد');
    await prisma.admin.createMany({ data: [{ telegramId: 9601n, role: 'PAYMENT_ADMIN' }, { telegramId: 9602n, role: 'VPN_ADMIN' }] });
    for (const a of [9601, 9602, 4_200_001]) { await tap(a, 'bm:h'); expect(last().payload.text).toContain('دسترسی'); await tap(a, `bm:go:ALL`); expect(last().payload.text).toContain('دسترسی'); }
    await say(9601, '/admin'); expect(cbs()).not.toContain('bm:h');
  });
});

describe('web panel API', () => {
  let web: http.Server; let base: string;
  beforeAll(async () => { web = createServer().listen(0, '127.0.0.1'); await new Promise((r) => web.once('listening', r)); base = `http://127.0.0.1:${(web.address() as AddressInfo).port}`; });
  afterAll(() => { web.close(); });
  beforeEach(() => resetPanelRateLimits());
  const login = async (id = 9000n) => (await fetch(`${base}/admin/auth?token=${createLoginToken(id)}`, { redirect: 'manual' })).headers.get('set-cookie')!.split(';')[0];
  const call = async (cookie: string, method: string, path: string, body?: unknown) => {
    const r = await fetch(`${base}/admin/api${path}`, { method, headers: { cookie, 'content-type': 'application/json', 'x-requested-with': 'admin-panel' }, body: method !== 'GET' && body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: (await r.json().catch(() => null)) as any };
  };

  it('audiences with counts, create, progress, test, cancel; validation; permissions', async () => {
    for (let i = 0; i < 3; i++) await registerUser({ id: 3_000_000 + i, first_name: 'N' });
    const c = await login();
    const list = await call(c, 'GET', '/broadcasts');
    expect(list.json.audiences.find((a: any) => a.key === 'ALL')).toMatchObject({ count: 3, label: expect.any(String) });
    expect((await call(c, 'POST', '/broadcasts', { text: '', audience: 'ALL' })).status).toBe(400);
    expect((await call(c, 'POST', '/broadcasts', { text: 'x', audience: 'ALL', buttonText: 'a', buttonUrl: 'ftp://x' })).status).toBe(400);
    const t = await call(c, 'POST', '/broadcasts/test', { text: 'پیش‌نمایش' });
    expect(t.status).toBe(200); expect(out.at(-1)).toMatchObject({ chatId: 9000n, html: 'پیش‌نمایش' });
    const made = await call(c, 'POST', '/broadcasts', { text: 'سلام {name}', audience: 'ALL' });
    expect(made.status).toBe(200); expect(made.json.total).toBe(3);
    expect((await call(c, 'POST', '/broadcasts', { text: 'سلام {name}', audience: 'ALL' })).status).toBe(409); // double click
    await runBroadcastTick({ ...fast });
    expect((await call(c, 'GET', `/broadcasts/${made.json.id}`)).json).toMatchObject({ status: 'DONE', sent: 3 });
    expect((await call(c, 'POST', `/broadcasts/${made.json.id}/cancel`)).status).toBe(409);
    await prisma.admin.create({ data: { telegramId: 9701n, role: 'PAYMENT_ADMIN' } });
    const pa = await login(9701n);
    for (const [m, p] of [['GET', '/broadcasts'], ['POST', '/broadcasts'], ['POST', '/broadcasts/test']] as const) expect((await call(pa, m, p, { text: 'x', audience: 'ALL' })).status, `${m} ${p}`).toBe(403);
  });
});
