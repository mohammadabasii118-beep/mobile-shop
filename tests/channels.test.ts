import http from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client';
import { createBot } from '../src/bot';
import { createServer } from '../src/server';
import { createLoginToken } from '../src/admin-web/auth';
import { resetPanelRateLimits } from '../src/admin-web/http';
import { addChannel, checkMembership, deleteChannel, parseChannelRef, resetChannelCaches, setChannelActive, setTgCaller, testChannel } from '../src/modules/channels/service';
import { setSetting } from '../src/modules/settings/service';
import { makeUser, resetDb, setup } from './helpers';

/** Fake Telegram: channels the bot is admin of + per-channel member lists. */
const BOT_ID = 123;
let chats: Record<string, { id: number; type: string; title: string; username?: string; botAdmin: boolean; members: Set<number> }> = {};
let fail = false;
let calls: string[] = [];
const resolve = (id: string) => Object.values(chats).find((c) => `@${c.username}` === id || String(c.id) === String(id));
beforeEach(async () => {
  await resetDb(); setup(); resetChannelCaches(); fail = false; calls = [];
  chats = {
    pub: { id: -1001, type: 'channel', title: 'کانال عمومی', username: 'pubchan', botAdmin: true, members: new Set() },
    priv: { id: -1002, type: 'channel', title: 'کانال خصوصی', botAdmin: true, members: new Set() },
    noadmin: { id: -1003, type: 'channel', title: 'بدون ادمین', username: 'noadmin', botAdmin: false, members: new Set() },
    grp: { id: -1004, type: 'group', title: 'گروه', username: 'agroup', botAdmin: true, members: new Set() },
  };
  setTgCaller(async (method, params = {}) => {
    calls.push(method);
    if (method === 'getMe') return { id: BOT_ID };
    const chat = resolve(String(params.chat_id));
    if (!chat) throw new Error('Bad Request: chat not found');
    if (method === 'getChat') return { id: chat.id, type: chat.type, title: chat.title, username: chat.username };
    if (method === 'getChatMember') {
      if (fail) throw new Error('Forbidden: bot is not a member of the channel chat');
      const uid = Number(params.user_id);
      if (uid === BOT_ID) return { status: chat.botAdmin ? 'administrator' : 'member' };
      return { status: chat.members.has(uid) ? 'member' : 'left' };
    }
    throw new Error('unexpected ' + method);
  });
});

describe('channel service', () => {
  it('parses refs and rejects invite links without an id', () => {
    expect(parseChannelRef('https://t.me/MyChannel')).toEqual({ ref: '@MyChannel', username: 'MyChannel' });
    expect(parseChannelRef('t.me/MyChannel/')).toMatchObject({ ref: '@MyChannel' });
    expect(parseChannelRef('@MyChannel').ref).toBe('@MyChannel');
    expect(parseChannelRef('-1001234567890')).toEqual({ ref: '-1001234567890' });
    expect(() => parseChannelRef('https://t.me/+AbCdEf123')).toThrow(/شناسه‌ی عددی/);
    expect(() => parseChannelRef('hello world')).toThrow(/نامعتبر/);
  });
  it('add: public by link, private with id + invite; requires the bot to be admin; rejects groups, duplicates, bad invite', async () => {
    const a = await addChannel('t', 'https://t.me/pubchan');
    expect(a).toMatchObject({ title: 'کانال عمومی', username: 'pubchan', inviteUrl: 'https://t.me/pubchan', isActive: true });
    await expect(addChannel('t', '@pubchan')).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(addChannel('t', '-1002')).rejects.toThrow(/نامعتبر/); // too short to be a chat id
    chats.priv.id = -100200000001; // numeric id long enough
    await expect(addChannel('t', '-100200000001')).rejects.toThrow(/لینک دعوت/);
    const p = await addChannel('t', '-100200000001\nhttps://t.me/+SecretInvite');
    expect(p).toMatchObject({ title: 'کانال خصوصی', username: null, inviteUrl: 'https://t.me/+SecretInvite' });
    await expect(addChannel('t', '@noadmin')).rejects.toThrow(/ادمین/);
    await expect(addChannel('t', '@agroup')).rejects.toThrow(/فقط کانال/); // plain groups are not supported
    await expect(addChannel('t', '@pubchan\nhttp://evil.example')).rejects.toThrow(/https:\/\/t\.me/);
  });
  it('membership: all active channels required; cached; inactive ignored; fail-open + alert when the bot loses access', async () => {
    const u = await makeUser(5001);
    await addChannel('t', '@pubchan');
    expect((await checkMembership(5001n)).missing.map((c) => c.title)).toEqual(['کانال عمومی']);
    chats.pub.members.add(5001);
    expect((await checkMembership(5001n)).ok).toBe(true);
    chats.pub.members.delete(5001);
    expect((await checkMembership(5001n)).ok).toBe(true); // positive result cached for a while
    resetChannelCaches();
    const c2 = (await prisma.requiredChannel.findFirstOrThrow());
    await setChannelActive('t', c2.id, false);
    expect((await checkMembership(5001n)).ok).toBe(true); // inactive => not enforced
    await setChannelActive('t', c2.id, true);
    resetChannelCaches(); fail = true;
    expect((await checkMembership(5001n)).ok).toBe(true); // fail-open, never locks customers out
    expect(u.id).toBeTruthy();
    expect((await testChannel(c2.id)).ok).toBe(false);
    fail = false; expect((await testChannel(c2.id)).ok).toBe(true);
    await deleteChannel('t', c2.id);
    expect(await prisma.requiredChannel.count()).toBe(0);
  });
});

describe('Telegram bot: new-user notification + join gate', () => {
  const ADMIN = 9000;
  let api: { method: string; payload: any }[] = [];
  let bot: ReturnType<typeof createBot>;
  let uid = 1;
  beforeEach(() => {
    api = [];
    bot = createBot('123:TEST', { botInfo: { id: BOT_ID, is_bot: true, first_name: 'B', username: 'b', can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false, allows_users_to_create_topics: false } as any, fetchFile: async () => Buffer.from('x') });
    bot.api.config.use(async (_p, method, payload: any) => { api.push({ method, payload }); return { ok: true, result: method.startsWith('send') || method.startsWith('edit') ? { message_id: api.length, date: 0, chat: { id: payload.chat_id ?? 1, type: 'private' }, text: payload.text } : true } as any; });
  });
  const who = (id: number, extra = {}) => ({ from: { id, is_bot: false, first_name: 'علی', username: `u${id}`, ...extra }, chat: { id, type: 'private' as const } });
  const say = (id: number, text: string) => bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, ...who(id), text, entities: text.startsWith('/') ? [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }] : undefined } } as any);
  const tap = (id: number, data: string) => bot.handleUpdate({ update_id: uid++, callback_query: { id: String(uid), from: who(id).from, chat_instance: 'x', data, message: { message_id: 1, date: 0, chat: who(id).chat, text: 'x' } } } as any);
  const msgs = () => api.filter((c) => ['sendMessage', 'editMessageText'].includes(c.method));
  const last = () => msgs().at(-1)!;
  const adminMsgs = () => msgs().filter((c) => c.payload.chat_id === ADMIN && String(c.payload.text).includes('کاربر جدید'));

  it('admin gets exactly one message per NEW user (name, username, id, total); toggle turns it off', async () => {
    await say(7001, '/start');
    expect(adminMsgs()).toHaveLength(1);
    const t = String(adminMsgs()[0].payload.text);
    expect(t).toContain('علی'); expect(t).toContain('@u7001'); expect(t).toContain('7001'); expect(t).toMatch(/تعداد کل کاربران: 1/);
    await say(7001, '/start'); await tap(7001, 'menu:buy');
    expect(adminMsgs()).toHaveLength(1); // not again
    await say(7002, '/start');
    expect(adminMsgs()).toHaveLength(2); expect(String(adminMsgs()[1].payload.text)).toMatch(/تعداد کل کاربران: 2/);
    await setSetting('notify.newUser', 'false');
    await say(7003, '/start');
    expect(adminMsgs()).toHaveLength(2);
    expect(await prisma.user.count()).toBe(3);
  });

  it('no channels => bot works as usual; with channels non-members are blocked everywhere until they join', async () => {
    await say(7010, '/start'); expect(String(last().payload.text)).toContain('خوش آمدید');
    await addChannel('t', '@pubchan');
    await say(7011, '/start');
    expect(String(last().payload.text)).toContain('عضویت در کانال');
    const kb = last().payload.reply_markup.inline_keyboard.flat();
    expect(kb.find((b: any) => b.url)).toMatchObject({ text: '📢 کانال عمومی', url: 'https://t.me/pubchan' });
    expect(kb.map((b: any) => b.callback_data)).toContain('chk:join');
    // every kind of update is blocked: commands, text, callbacks (even crafted ones)
    for (const f of [() => say(7011, '/services'), () => say(7011, 'hi'), () => tap(7011, 'menu:buy'), () => tap(7011, 'ov:abc'), () => tap(7011, 'sv:link:xyz')]) {
      api = []; await f();
      expect(String(last().payload.text)).toContain('عضویت در کانال');
      expect(String(last().payload.text)).not.toContain('خرید VPN');
    }
    expect(await prisma.order.count()).toBe(0);
    // pressing "I joined" without joining => alert, still blocked
    api = []; await tap(7011, 'chk:join');
    expect(api.some((c) => c.method === 'answerCallbackQuery' && c.payload.show_alert)).toBe(true);
    // joins => menu appears
    chats.pub.members.add(7011); api = [];
    await tap(7011, 'chk:join');
    expect(String(last().payload.text)).toContain('خوش آمدید');
    await tap(7011, 'menu:account'); expect(String(last().payload.text)).toContain('حساب من');
  });

  it('shows only the channels still missing; admins and unaffected users are exempt; new user is still announced while gated', async () => {
    await addChannel('t', '@pubchan');
    chats.priv.id = -100200000001; await addChannel('t', '-100200000001\nhttps://t.me/+SecretInvite');
    chats.pub.members.add(7020);
    await say(7020, '/start');
    const urls = last().payload.reply_markup.inline_keyboard.flat().filter((b: any) => b.url).map((b: any) => b.url);
    expect(urls).toEqual(['https://t.me/+SecretInvite']);
    expect(adminMsgs()).toHaveLength(1); // announced although gated
    await say(ADMIN, '/start'); // bot admins are exempt
    expect(String(last().payload.text)).toContain('خوش آمدید');
  });

  it('admin manages channels from the bot (add / test / toggle / delete) and non-admins cannot', async () => {
    await tap(ADMIN, 'adm:g:set');
    expect(last().payload.reply_markup.inline_keyboard.flat().map((b: any) => b.callback_data)).toContain('ch:l');
    await tap(ADMIN, 'ch:l'); expect(String(last().payload.text)).toContain('هنوز کانالی اضافه نشده');
    await tap(ADMIN, 'ch:n'); await say(ADMIN, '@noadmin');
    expect(String(last().payload.text)).toContain('ادمین'); // error, step kept
    await say(ADMIN, 'https://t.me/pubchan');
    const c = await prisma.requiredChannel.findFirstOrThrow();
    expect(String(last().payload.text)).toContain('اضافه شد');
    await tap(ADMIN, `ch:t:${c.id}`); expect(String(last().payload.text)).toContain('✅');
    await tap(ADMIN, `ch:tg:${c.id}`); expect((await prisma.requiredChannel.findUniqueOrThrow({ where: { id: c.id } })).isActive).toBe(false);
    await tap(7030, 'ch:l'); expect(String(last().payload.text)).toContain('دسترسی غیرمجاز');
    await tap(7030, `ch:d2:${c.id}`); expect(await prisma.requiredChannel.count()).toBe(1);
    await tap(ADMIN, `ch:d2:${c.id}`); expect(await prisma.requiredChannel.count()).toBe(0);
  });
});

describe('web panel channels API', () => {
  let web: http.Server; let base: string;
  beforeAll(async () => { web = createServer().listen(0, '127.0.0.1'); await new Promise((r) => web.once('listening', r)); base = `http://127.0.0.1:${(web.address() as AddressInfo).port}`; });
  afterAll(() => { web.close(); });
  const login = async (id: bigint) => { resetPanelRateLimits(); const r = await fetch(`${base}/admin/auth?token=${createLoginToken(id)}`, { redirect: 'manual' }); return r.headers.get('set-cookie')!.split(';')[0]; };
  const call = async (c: string, method: string, path: string, body?: unknown) => { const r = await fetch(`${base}/admin/api${path}`, { method, headers: { cookie: c, 'content-type': 'application/json', 'x-requested-with': 'admin-panel' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: (await r.json()) as any }; };
  it('add/list/test/toggle/delete, validation errors and permissions; new-user toggle is a setting', async () => {
    const c = await login(9000n);
    expect((await call(c, 'POST', '/channels', { ref: '@noadmin' })).status).toBe(400);
    const add = await call(c, 'POST', '/channels', { ref: 'https://t.me/pubchan' });
    expect(add.status).toBe(200); expect(add.json.chatId).toBe('-1001');
    expect((await call(c, 'POST', '/channels', { ref: '@pubchan' })).status).toBe(409);
    expect((await call(c, 'GET', '/channels')).json.items).toHaveLength(1);
    expect((await call(c, 'POST', `/channels/${add.json.id}/test`)).json.ok).toBe(true);
    expect((await call(c, 'PATCH', `/channels/${add.json.id}`, { isActive: false })).json.isActive).toBe(false);
    expect((await call(c, 'PUT', '/settings', { key: 'notify.newUser', value: 'false' })).status).toBe(200);
    expect((await call(c, 'DELETE', `/channels/${add.json.id}`)).json.ok).toBe(true);
    await prisma.admin.create({ data: { telegramId: 91n, role: 'SUPPORT_ADMIN' } });
    expect((await call(await login(91n), 'GET', '/channels')).status).toBe(403);
  });
});
