import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client';
import { FakeXui } from '../dev/fakeXui';
import { createBot } from '../src/bot';
import { XuiClient } from '../src/providers/vpn/xui/client';
import { XuiVpnProvider } from '../src/providers/vpn/xui/provider';
import { ProviderError } from '../src/providers/vpn/types';
import { setVpnProvider } from '../src/providers/vpn';
import { approvePayment } from '../src/modules/payments/service';
import { adminRenew, deleteServiceByUser, listUserServices, resumeService, rotateServiceLink, suspendService } from '../src/modules/vpn/service';
import { upsertUser } from '../src/modules/users/service';
import { makeOrder, makeProduct, makeUser, resetDb, setup, submit } from './helpers';

let panel: FakeXui;
beforeAll(async () => { panel = await new FakeXui().start(); });
afterAll(async () => { await panel.stop(); });
let prov: XuiVpnProvider;
beforeEach(async () => {
  await resetDb(); setup();
  panel.inbounds.get(1)!.settings.clients = []; panel.inbounds.get(1)!.traffic = {};
  setVpnProvider(prov = new XuiVpnProvider({ client: new XuiClient({ baseUrl: panel.url, username: 'admin', password: 'secret', timeoutMs: 2000 }), publicHost: 'vpn.example.com', subBaseUrl: 'https://sub.example.com:2096/sub/' }));
});

async function bought(telegramId?: number) {
  const u = telegramId ? await upsertUser({ id: telegramId, first_name: 'T' }) : await makeUser();
  const p = await makeProduct(); const o = await makeOrder(u.id, p.id);
  const pay = await submit(u.id, o.id, { trackingCode: String(Math.floor(Math.random() * 9e8) + 1e8) });
  await approvePayment(pay.id, { actor: 'admin' });
  return { u, p, o, svc: await prisma.vpnService.findUniqueOrThrow({ where: { orderId: o.id } }) };
}
const panelClient = (email: string) => (panel.inbounds.get(1)!.settings.clients as any[]).find((c) => c.email === email);

describe('customer: change link', () => {
  it('replaces uuid + subscription id on the same client; old values are gone; traffic/expiry/name kept', async () => {
    const { u, svc } = await bought();
    const before = panelClient(svc.externalId);
    const n = await rotateServiceLink(u.id, svc.id);
    const after = panelClient(svc.externalId);
    expect(after.id).not.toBe(before.id); expect(after.subId).not.toBe(before.subId);
    expect(after.expiryTime).toBe(before.expiryTime); expect(after.totalGB).toBe(before.totalGB); expect(after.enable).toBe(true);
    expect(panel.clientCount()).toBe(1);
    expect(n).toMatchObject({ uuid: after.id, clientId: after.id, subId: after.subId });
    expect(n.subscriptionUrl).toBe(`https://sub.example.com:2096/sub/${after.subId}`);
    expect(n.subscriptionUrl).not.toContain(svc.subId);
    expect(n.config).toContain(after.id); expect(n.config).not.toContain(before.id);
    expect(await prisma.auditLog.count({ where: { action: 'vpn.rotate_link', targetId: svc.id } })).toBe(1);
    expect(JSON.stringify(await prisma.auditLog.findMany())).not.toContain(after.id);
  });
  it('10-minute cooldown, owner only, active only', async () => {
    const { u, svc } = await bought();
    await rotateServiceLink(u.id, svc.id);
    await expect(rotateServiceLink(u.id, svc.id)).rejects.toThrow(/چند دقیقه/);
    const stranger = await makeUser();
    await expect(rotateServiceLink(stranger.id, svc.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await prisma.vpnService.update({ where: { id: svc.id }, data: { status: 'EXPIRED' } });
    await prisma.auditLog.deleteMany();
    await expect(rotateServiceLink(u.id, svc.id)).rejects.toThrow(/فقط برای سرویس فعال/);
  });
  it('the panel stays the source of truth: even with a stale DB credential, suspend/resume/renew/delete still work', async () => {
    const { u, p, svc } = await bought();
    await rotateServiceLink(u.id, svc.id);
    await prisma.vpnService.update({ where: { id: svc.id }, data: { uuid: svc.uuid } }); // simulate "panel changed but DB write was lost"
    await suspendService(svc.id, 'admin'); expect(panelClient(svc.externalId).enable).toBe(false);
    await resumeService(svc.id, 'admin'); expect(panelClient(svc.externalId).enable).toBe(true);
    const before = panelClient(svc.externalId).expiryTime;
    await adminRenew(svc.id, p.id, 'admin');
    expect(panelClient(svc.externalId).expiryTime).toBeGreaterThan(before);
    await deleteServiceByUser(u.id, svc.id);
    expect(panel.clientCount()).toBe(0);
  });
});

describe('customer: failure handling', () => {
  it('double-tap on "change link" rotates once', async () => {
    const { u, svc } = await bought();
    const r = await Promise.allSettled([rotateServiceLink(u.id, svc.id), rotateServiceLink(u.id, svc.id)]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.auditLog.count({ where: { action: 'vpn.rotate_link', targetId: svc.id } })).toBe(1);
  });
  it('if re-reading the link fails after the panel accepted the change, the DB already has the new identity and the link is re-fetched on demand', async () => {
    const { u, svc } = await bought();
    const real = prov.getConfig.bind(prov);
    prov.getConfig = (async () => { throw new ProviderError('timeout', true); }) as any;
    await expect(rotateServiceLink(u.id, svc.id)).rejects.toThrow(/timeout/);
    prov.getConfig = real;
    const after = panelClient(svc.externalId);
    const row = await prisma.vpnService.findUniqueOrThrow({ where: { id: svc.id } });
    expect(row).toMatchObject({ uuid: after.id, subId: after.subId, config: null, subscriptionUrl: null }); // consistent with the panel, link to be re-read
    const { refreshConfig } = await import('../src/modules/vpn/service');
    const healed = await refreshConfig(svc.id);
    expect(healed.config).toContain(after.id); expect(healed.subscriptionUrl).toContain(after.subId);
  });
  it('a paid renewal that arrives after the customer deleted the service fails loudly (no silent success, no client resurrected)', async () => {
    const { u, p, svc } = await bought();
    const ren = await makeOrder(u.id, p.id, { renewalOfServiceId: svc.id } as any);
    const pay = await submit(u.id, ren.id, { trackingCode: '987654321' });
    await prisma.vpnService.update({ where: { id: svc.id }, data: { status: 'CANCELLED' } });
    await approvePayment(pay.id, { actor: 'admin' });
    const task = await prisma.provisioningTask.findUniqueOrThrow({ where: { orderId: ren.id } });
    expect(task.status).toBe('FAILED'); expect(task.lastError).toContain('service was deleted');
  });
});

describe('customer: delete service', () => {
  it('removes the client from the panel, cancels, hides it from the list; owner only; not while a renewal is open', async () => {
    const { u, p, svc } = await bought();
    const stranger = await makeUser();
    await expect(deleteServiceByUser(stranger.id, svc.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(panel.clientCount()).toBe(1);
    const ren = await makeOrder(u.id, p.id, { renewalOfServiceId: svc.id } as any); // unpaid renewal: must NOT block, it is cancelled with the service
    await prisma.order.update({ where: { id: ren.id }, data: { status: 'PAYMENT_SUBMITTED' } }); // …but a renewal that carries money does block
    await expect(deleteServiceByUser(u.id, svc.id)).rejects.toThrow(/تمدید پرداخت‌شده/);
    expect(panel.clientCount()).toBe(1);
    await prisma.order.update({ where: { id: ren.id }, data: { status: 'PENDING_PAYMENT' } });
    await deleteServiceByUser(u.id, svc.id);
    expect(panel.clientCount()).toBe(0);
    expect((await prisma.vpnService.findUniqueOrThrow({ where: { id: svc.id } })).status).toBe('CANCELLED');
    expect(await listUserServices(u.id)).toHaveLength(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: ren.id } })).status).toBe('CANCELLED');
    expect(await prisma.auditLog.count({ where: { action: 'vpn.delete', actor: `user:${u.id}` } })).toBe(1);
    await expect(deleteServiceByUser(u.id, svc.id)).rejects.toThrow(); // second time: nothing to delete
  });
});

describe('Telegram: buttons', () => {
  let api: { method: string; payload: any }[] = [];
  let bot: ReturnType<typeof createBot>;
  let uid = 1;
  beforeEach(() => {
    api = [];
    bot = createBot('123:TEST', { botInfo: { id: 123, is_bot: true, first_name: 'B', username: 'b', can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false, allows_users_to_create_topics: false } as any, fetchFile: async () => Buffer.from('x') });
    bot.api.config.use(async (_p, method, payload: any) => { api.push({ method, payload }); return { ok: true, result: method.startsWith('send') || method.startsWith('edit') ? { message_id: api.length, date: 0, chat: { id: payload.chat_id ?? 1, type: 'private' }, text: payload.text } : true } as any; });
  });
  const who = (id: number) => ({ from: { id, is_bot: false, first_name: 'T' }, chat: { id, type: 'private' as const } });
  const tap = (id: number, data: string) => bot.handleUpdate({ update_id: uid++, callback_query: { id: String(uid), from: who(id).from, chat_instance: 'x', data, message: { message_id: 1, date: 0, chat: who(id).chat, text: 'x' } } } as any);
  const last = () => api.filter((c) => ['sendMessage', 'editMessageText'].includes(c.method)).at(-1)!;
  const cbs = () => (last().payload.reply_markup?.inline_keyboard ?? []).flat().map((b: any) => b.callback_data) as string[];

  it('service card has both buttons; each asks for confirmation; link change shows the new link; delete removes the service', async () => {
    const { svc } = await bought(5151);
    await tap(5151, `sv:v:${svc.id}`);
    expect(cbs()).toEqual(expect.arrayContaining([`sv:rot:${svc.id}`, `sv:del:${svc.id}`]));
    await tap(5151, `sv:rot:${svc.id}`);
    expect(last().payload.text).toContain('همه‌ی لینک‌ها و کانفیگ‌های قبلی از کار می‌افتند'); expect(cbs()).toContain(`sv:rot2:${svc.id}`);
    expect((await prisma.vpnService.findUniqueOrThrow({ where: { id: svc.id } })).uuid).toBe(svc.uuid); // nothing changed yet
    await tap(5151, `sv:rot2:${svc.id}`);
    const n = await prisma.vpnService.findUniqueOrThrow({ where: { id: svc.id } });
    expect(n.uuid).not.toBe(svc.uuid);
    expect(last().payload.text).toContain('لینک جدید ساخته شد'); expect(last().payload.text).toContain(n.subId);
    await tap(5151, `sv:rot2:${svc.id}`); // double tap inside cooldown: friendly error, no second rotation
    expect(last().payload.text).toContain('چند دقیقه');
    expect((await prisma.vpnService.findUniqueOrThrow({ where: { id: svc.id } })).uuid).toBe(n.uuid);

    await tap(5151, `sv:del:${svc.id}`);
    expect(last().payload.text).toContain('قابل بازگشت نیست'); expect(cbs()).toContain(`sv:del2:${svc.id}`);
    expect(panel.clientCount()).toBe(1);
    await tap(5151, `sv:del2:${svc.id}`);
    expect(last().payload.text).toContain('سرویس حذف شد');
    expect(panel.clientCount()).toBe(0);
  });

  it("another user's callbacks are refused", async () => {
    const { svc } = await bought(5252);
    await upsertUser({ id: 5353, first_name: 'X' });
    for (const a of ['rot2', 'del2']) { await tap(5353, `sv:${a}:${svc.id}`); expect(last().payload.text).toContain('دسترسی'); }
    expect(panel.clientCount()).toBe(1);
  });
});
