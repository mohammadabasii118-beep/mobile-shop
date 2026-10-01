import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client';
import { createBot } from '../src/bot';
import { FakeXui } from '../dev/fakeXui';
import { XuiClient } from '../src/providers/vpn/xui/client';
import { XuiVpnProvider } from '../src/providers/vpn/xui/provider';
import { runXuiCheck } from '../src/scripts/xuiCheck';
import { clientEmail } from '../src/modules/vpn/provisioning';
import { linkRemark, serviceCode, serviceLabel, slugify, validateServiceName } from '../src/utils/names';
import { approvePayment } from '../src/modules/payments/service';
import { renameService } from '../src/modules/vpn/service';
import { setOrderServiceName } from '../src/modules/orders/service';
import { makeOrder, makeProduct, makeUser, resetDb, setup, submit } from './helpers';

describe('name helpers', () => {
  it('validates customer names (any script, safe charset, 2–32)', () => {
    expect(validateServiceName('  لپ‌تاپ   من ')).toBe('لپ‌تاپ من');
    expect(validateServiceName('Ali-Phone (2)')).toBe('Ali-Phone (2)');
    for (const bad of ['a', 'x'.repeat(33), '<script>', 'a&b', 'name/with/slash', 'ab\u0000cd']) expect(() => validateServiceName(bad)).toThrow();
  });
  it('slug is latin-safe and may be empty; code/label/remark combine custom + automatic', () => {
    expect(slugify('My Phone #1!')).toBe('my-phone-1');
    expect(slugify('لپ‌تاپ')).toBe('');
    expect(serviceCode('tg_1_vpn-261001-7583f6_x')).toBe('7583F6');
    expect(serviceLabel('لپ‌تاپ', 'tg_1_vpn-261001-7583f6')).toBe('لپ‌تاپ · 7583F6');
    expect(serviceLabel(null, 'tg_1_vpn-261001-7583f6')).toBe('VPN-7583F6');
    expect(linkRemark('Ali', 'tg_1_vpn-261001-7583f6')).toBe('Ali | VPN-7583F6');
  });
  it('client email keeps the automatic part and appends the slug; <= 64 chars; stable', () => {
    expect(clientEmail(5n, 'VPN-261001-AB12CD')).toBe('tg_5_vpn-261001-ab12cd');
    expect(clientEmail(5n, 'VPN-261001-AB12CD', 'My Phone')).toBe('tg_5_vpn-261001-ab12cd_my-phone');
    expect(clientEmail(5n, 'VPN-261001-AB12CD', 'گوشی من')).toBe('tg_5_vpn-261001-ab12cd');
    expect(clientEmail(123456789012n, 'VPN-261001-AB12CD', 'a'.repeat(32)).length).toBeLessThanOrEqual(64);
  });
});

let ctx: ReturnType<typeof setup>;
beforeEach(async () => { await resetDb(); ctx = setup(); process.env.MOCK_SUB_BASE = 'https://sub.example.com/sub'; });
afterAll(() => { delete process.env.MOCK_SUB_BASE; });

async function paidWithName(name?: string) {
  const u = await makeUser(); const p = await makeProduct(); const o = await makeOrder(u.id, p.id);
  if (name) await setOrderServiceName(u.id, o.id, name);
  const pay = await submit(u.id, o.id, { trackingCode: String(Math.floor(Math.random() * 9e8) + 1e8) });
  await approvePayment(pay.id, { actor: 'a' });
  return { u, p, o, svc: await prisma.vpnService.findUniqueOrThrow({ where: { orderId: o.id } }) };
}

describe('customer service names', () => {
  it('latin name: stored, appended to the client email, shown with the automatic code, used in the link remark', async () => {
    const { svc } = await paidWithName('My Phone');
    expect(svc.displayName).toBe('My Phone');
    expect(svc.externalId).toMatch(/^tg_\d+_vpn-\d{6}-[a-f0-9]{6}_my-phone$/);
    expect(decodeURIComponent(svc.config!)).toContain(`#My Phone | VPN-${serviceCode(svc.externalId)}`);
    expect(ctx.vpn.clients.get(svc.externalId)).toBeTruthy();
    const msg = ctx.sent.find((m) => m.text.includes('سرویس شما آماده است'))!;
    expect(msg.text).toContain(`My Phone · ${serviceCode(svc.externalId)}`);
  });
  it('persian name: kept as display name, email stays automatic-only', async () => {
    const { svc } = await paidWithName('لپ‌تاپ من');
    expect(svc.displayName).toBe('لپ‌تاپ من');
    expect(svc.externalId).toMatch(/^tg_\d+_vpn-\d{6}-[a-f0-9]{6}$/);
  });
  it('no name: automatic label only', async () => {
    const { svc } = await paidWithName();
    expect(svc.displayName).toBeNull();
    expect(ctx.sent.find((m) => m.text.includes('سرویس شما آماده است'))!.text).toContain(`VPN-${serviceCode(svc.externalId)}`);
  });
  it('subscription link is presented first, the direct config second; buttons adapt', async () => {
    await paidWithName('Ali');
    const msg = ctx.sent.find((m) => m.text.includes('سرویس شما آماده است'))!;
    const iSub = msg.text.indexOf('لینک اشتراک'), iCfg = msg.text.indexOf('کانفیگ مستقیم');
    expect(iSub).toBeGreaterThan(-1); expect(iCfg).toBeGreaterThan(iSub);
    expect(msg.text).toContain('https://sub.example.com/sub/');
    const labels = JSON.stringify(msg.buttons);
    expect(labels).toContain('📡 لینک اشتراک'); expect(labels).toContain('✏️ نام سرویس');
  });
  it('rename: DB name + link remark change, client email/uuid never change; reset to automatic; ownership enforced', async () => {
    const { u, svc } = await paidWithName('Old');
    const r = await renameService(u.id, svc.id, 'لپ‌تاپ جدید');
    const after = await prisma.vpnService.findUniqueOrThrow({ where: { id: svc.id } });
    expect(r.displayName).toBe('لپ‌تاپ جدید');
    expect(after.externalId).toBe(svc.externalId); expect(after.uuid).toBe(svc.uuid);
    expect(decodeURIComponent(after.config!)).toContain('لپ‌تاپ جدید | VPN-');
    await renameService(u.id, svc.id, null);
    expect((await prisma.vpnService.findUniqueOrThrow({ where: { id: svc.id } })).displayName).toBeNull();
    const other = await makeUser();
    await expect(renameService(other.id, svc.id, 'hack')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(renameService(u.id, svc.id, '<b>x</b>')).rejects.toMatchObject({ code: 'VALIDATION' });
  });
  it('order naming is only possible before the service exists', async () => {
    const { u, o } = await paidWithName('X1');
    await expect(setOrderServiceName(u.id, o.id, 'Late')).rejects.toMatchObject({ code: 'CONFLICT' });
    const other = await makeUser(); const o2 = await makeOrder(other.id, (await makeProduct({ name: 'z' })).id);
    await expect(setOrderServiceName(u.id, o2.id, 'Steal')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('Telegram UI for names', () => {
  const U = 7001;
  let api: { method: string; payload: any }[] = [];
  let bot: ReturnType<typeof createBot>;
  let uid = 1;
  beforeEach(() => {
    api = [];
    bot = createBot('123:TEST', { botInfo: { id: 123, is_bot: true, first_name: 'B', username: 'b', can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false, allows_users_to_create_topics: false } as any, fetchFile: async () => Buffer.from('x') });
    bot.api.config.use(async (_p, method, payload: any) => { api.push({ method, payload }); return { ok: true, result: method.startsWith('send') || method.startsWith('edit') ? { message_id: api.length, date: 0, chat: { id: payload.chat_id ?? 1, type: 'private' }, text: payload.text } : true } as any; });
  });
  const from = { id: U, is_bot: false, first_name: 'علی', username: 'u' };
  const chat = { id: U, type: 'private' as const };
  const say = (text: string) => bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, chat, from, text } } as any);
  const tap = (data: string) => bot.handleUpdate({ update_id: uid++, callback_query: { id: String(uid), from, chat_instance: 'x', data, message: { message_id: 1, date: 0, chat, text: 'x' } } } as any);
  const last = () => api.filter((c) => ['sendMessage', 'editMessageText'].includes(c.method)).at(-1)!;
  const cbs = () => (last().payload.reply_markup?.inline_keyboard ?? []).flat().map((b: any) => b.callback_data);

  it('payment page offers a custom name; invalid names get a friendly error; valid name is stored and shown', async () => {
    const p = await makeProduct();
    await tap(`bo:${p.id}`);
    const o = await prisma.order.findFirstOrThrow();
    expect(last().payload.text).toContain('نام سرویس'); expect(last().payload.text).toContain('خودکار');
    expect(cbs()).toContain(`nm:o:${o.id}`);
    await tap(`nm:o:${o.id}`);
    expect(cbs()).toContain(`nm:oa:${o.id}`);
    await say('<b>');
    expect(last().payload.text).toMatch(/❌/);
    await say('گوشی علی');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).serviceName).toBe('گوشی علی');
    expect(last().payload.text).toContain('گوشی علی');
    await tap(`nm:oa:${o.id}`);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).serviceName).toBeNull();
  });

  it('service screen: shows name + code, rename flow works, other users cannot rename', async () => {
    const user = await makeUser(U); const p = await makeProduct();
    const o = await makeOrder(user.id, p.id); const pay = await submit(user.id, o.id, { trackingCode: '55667788' });
    await approvePayment(pay.id, { actor: 'a' });
    const svc = await prisma.vpnService.findFirstOrThrow();
    await tap(`sv:v:${svc.id}`);
    expect(last().payload.text).toContain(`VPN-${serviceCode(svc.externalId)}`);
    expect(cbs()).toEqual(expect.arrayContaining([`nm:s:${svc.id}`, `sv:link:${svc.id}`]));
    expect(JSON.stringify(last().payload.reply_markup)).toContain('📡 لینک اشتراک');
    await tap(`nm:s:${svc.id}`); await say('لپ‌تاپ کار');
    expect((await prisma.vpnService.findUniqueOrThrow({ where: { id: svc.id } })).displayName).toBe('لپ‌تاپ کار');
    expect(last().payload.text).toContain('لپ‌تاپ کار');
    // QR encodes the subscription link when available
    await tap(`sv:qr:${svc.id}`);
    expect(api.some((c) => c.method === 'sendPhoto' && String(c.payload.caption).includes('لینک اشتراک'))).toBe(true);
    // another user
    const other = { id: 7002, is_bot: false, first_name: 'x' };
    await bot.handleUpdate({ update_id: uid++, callback_query: { id: 'z', from: other, chat_instance: 'x', data: `nm:s:${svc.id}`, message: { message_id: 1, date: 0, chat: { id: 7002, type: 'private' }, text: 'x' } } } as any);
    expect(last().payload.text).toContain('دسترسی غیرمجاز');
    expect((await prisma.vpnService.findUniqueOrThrow({ where: { id: svc.id } })).displayName).toBe('لپ‌تاپ کار');
  });
});

describe('xui:check subscription step', () => {
  let panel: FakeXui;
  beforeAll(async () => { panel = await new FakeXui().start(); });
  afterAll(async () => { await panel.stop(); });
  const mk = (sub?: string) => { const client = new XuiClient({ baseUrl: panel.url, username: 'admin', password: 'secret' }); return { client, provider: new XuiVpnProvider({ client, publicHost: 'h', subBaseUrl: sub }) }; };
  it('passes when the subscription URL really serves the client; fails with guidance when misconfigured; skips when unset', async () => {
    const ok = await runXuiCheck(...(Object.values(mk(`${panel.url}/sub`)) as [any, any]), 1);
    expect(ok.find((s) => s.name.startsWith('subscription'))).toMatchObject({ ok: true });
    expect(ok.find((s) => s.name.startsWith('subscription'))!.detail).toContain('HTTP 200');
    const bad = await runXuiCheck(...(Object.values(mk(`${panel.url}/wrongpath`)) as [any, any]), 1);
    expect(bad.find((s) => s.name.startsWith('subscription'))).toMatchObject({ ok: false });
    expect(bad.find((s) => s.name.startsWith('subscription'))!.detail).toContain('XUI_SUB_BASE_URL');
    expect(bad.at(-1)).toMatchObject({ name: 'cleanup (delete test client)', ok: true });
    const none = await runXuiCheck(...(Object.values(mk()) as [any, any]), 1);
    expect(none.find((s) => s.name.startsWith('subscription'))!.detail).toContain('skipped');
    expect(panel.clientCount()).toBe(0);
  });
});
