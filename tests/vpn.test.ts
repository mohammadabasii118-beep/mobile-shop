import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client';
import { addLedgerTx, makeOrder, makeProduct, makeUser, resetDb, setup, submit } from './helpers';
import { approvePayment } from '../src/modules/payments/service';
import { adminRetry, retryDueProvisioning, runProvisioning, clientEmail } from '../src/modules/vpn/provisioning';
import { deleteService, getServiceForUser, processExpirations, resumeService, suspendService, syncService } from '../src/modules/vpn/service';
import { createOrder } from '../src/modules/orders/service';
import { GB } from '../src/utils/misc';
import { setSetting } from '../src/modules/settings/service';

let ctx: ReturnType<typeof setup>;
beforeEach(async () => { await resetDb(); ctx = setup(); });

async function paidOrder(over = {}) {
  const user = await makeUser();
  const product = await makeProduct(over);
  const order = await makeOrder(user.id, product.id);
  const p = await submit(user.id, order.id, { trackingCode: String(Math.floor(Math.random() * 1e9) + 1e8) });
  return { user, product, order, p };
}

describe('provisioning', () => {
  it('creates client with correct email, traffic bytes and expiry', async () => {
    const { user, order, p } = await paidOrder();
    await approvePayment(p.id, { actor: 'admin:1' });
    const svc = await prisma.vpnService.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(svc.externalId).toBe(clientEmail(user.telegramId, order.orderNumber));
    expect(svc.externalId).toMatch(/^tg_\d+_vpn-\d{6}-[a-f0-9]{6}$/);
    expect(svc.trafficLimit).toBe(50n * GB);
    const days = (svc.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.99); expect(days).toBeLessThan(30.01);
    expect(ctx.vpn.clients.get(svc.externalId)?.trafficLimitBytes).toBe(50n * GB);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('FULFILLED');
  });

  it('is idempotent: re-running provisioning never creates a second client', async () => {
    const { order, p } = await paidOrder();
    await approvePayment(p.id, { actor: 'admin:1' });
    expect(await runProvisioning(order.id)).toBe('skipped');
    expect(await runProvisioning(order.id, { force: true })).toBe('skipped');
    await Promise.all([runProvisioning(order.id), runProvisioning(order.id)]);
    expect(ctx.vpn.createCalls).toBe(1);
    expect(ctx.vpn.clients.size).toBe(1);
  });

  it('panel down => FAILED + admin alert with retry; auto retry succeeds without duplicates', async () => {
    ctx.vpn.failNext = 1;
    const { order, p } = await paidOrder();
    await approvePayment(p.id, { actor: 'admin:1' });
    const task = await prisma.provisioningTask.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(task.status).toBe('FAILED');
    expect(task.attempts).toBe(1);
    expect(task.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 50_000); // 1m backoff
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PROVISIONING');
    expect((await prisma.vpnService.findUniqueOrThrow({ where: { orderId: order.id } })).provisioningStatus).toBe('FAILED');
    const alert = ctx.sent.find((m) => m.text.includes('VPN provisioning failed'));
    expect(alert).toBeTruthy();
    expect(JSON.stringify(alert!.buttons)).toContain('av:retry:');
    // user never receives a config before success
    expect(ctx.sent.some((m) => m.text.includes('vless://'))).toBe(false);

    expect(await retryDueProvisioning()).toBe(0); // backoff not due yet
    await prisma.provisioningTask.update({ where: { orderId: order.id }, data: { nextAttemptAt: new Date() } });
    expect(await retryDueProvisioning()).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('FULFILLED');
    expect(ctx.vpn.clients.size).toBe(1);
    expect(ctx.sent.some((m) => m.text.includes('vless://'))).toBe(true);
  });

  it('exhausted retries alert admin once and stop auto retrying; admin retry still works', async () => {
    await setSetting('provisioning.maxRetries', '2');
    ctx.vpn.failNext = 99;
    const { order, p } = await paidOrder();
    await approvePayment(p.id, { actor: 'admin:1' });
    for (let i = 0; i < 4; i++) {
      await prisma.provisioningTask.update({ where: { orderId: order.id }, data: { nextAttemptAt: new Date() } });
      await retryDueProvisioning();
    }
    const t = await prisma.provisioningTask.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(t.attempts).toBe(3); // max 2 retries after the first try
    expect(t.adminAlerted).toBe(true);
    expect(ctx.sent.filter((m) => m.text.includes('حداکثر تلاش')).length).toBe(1);
    ctx.vpn.failNext = 0;
    expect(await adminRetry(order.id, 'admin:1')).toBe('done');
    expect(ctx.vpn.clients.size).toBe(1);
  });

  it('missing/disabled inbound => provisioning failed, no fake config', async () => {
    const { order, p } = await paidOrder({ xuiInboundId: 77 });
    await approvePayment(p.id, { actor: 'admin:1' });
    const svc = await prisma.vpnService.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(svc.provisioningStatus).toBe('FAILED');
    expect(svc.config).toBeNull();
    expect(ctx.vpn.clients.size).toBe(0);
  });

  it('admin fixes a wrong inbound on the product, retry then uses the corrected inbound', async () => {
    ctx.vpn.inbounds.set(23, { enable: true, protocol: 'vless' });
    const { product, order, p } = await paidOrder({ xuiInboundId: 99 });
    await approvePayment(p.id, { actor: 'admin:1' });
    expect((await prisma.vpnService.findUniqueOrThrow({ where: { orderId: order.id } })).provisioningStatus).toBe('FAILED');
    await prisma.product.update({ where: { id: product.id }, data: { xuiInboundId: 23 } });
    expect(await adminRetry(order.id, 'admin:1')).toBe('done');
    const svc = await prisma.vpnService.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(svc).toMatchObject({ inboundId: 23, provisioningStatus: 'SUCCESS' });
    expect(ctx.vpn.clients.size).toBe(1);
  });

  it('stale PROCESSING lock is recovered, fresh one is not', async () => {
    const { order, p } = await paidOrder();
    await prisma.provisioningTask.deleteMany();
    await approvePayment(p.id, { actor: 'x' }); // creates task + provisions
    await prisma.provisioningTask.update({ where: { orderId: order.id }, data: { status: 'PROCESSING', lockedAt: new Date() } });
    expect(await runProvisioning(order.id)).toBe('skipped');
    await prisma.provisioningTask.update({ where: { orderId: order.id }, data: { lockedAt: new Date(Date.now() - 3_600_000) } });
    expect(await runProvisioning(order.id)).toBe('done');
    expect(ctx.vpn.clients.size).toBe(1);
  });
});

describe('renewal', () => {
  it('renews the SAME client: extends expiry and adds traffic, no new client', async () => {
    const { user, product, order, p } = await paidOrder();
    await approvePayment(p.id, { actor: 'a' });
    const before = await prisma.vpnService.findUniqueOrThrow({ where: { orderId: order.id } });
    const { order: ro } = await createOrder({ userId: user.id, productId: product.id, paymentMethod: 'CARD_TO_CARD', renewalOfServiceId: before.id });
    await addLedgerTx(ro.finalAmount, '800800800');
    await submit(user.id, ro.id, { trackingCode: '800800800' });
    const after = await prisma.vpnService.findUniqueOrThrow({ where: { id: before.id } });
    expect(ctx.vpn.createCalls).toBe(1);
    expect(ctx.vpn.clients.size).toBe(1);
    expect(after.expiresAt.getTime() - before.expiresAt.getTime()).toBe(30 * 86_400_000);
    expect(after.trafficLimit).toBe(100n * GB);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: ro.id } })).status).toBe('FULFILLED');
    expect(await prisma.vpnService.count()).toBe(1);
    expect(ctx.sent.some((m) => m.text.includes('تمدید'))).toBe(true);
  });

  it("cannot renew someone else's service or with an incompatible inbound", async () => {
    const { product, order, p } = await paidOrder();
    await approvePayment(p.id, { actor: 'a' });
    const svc = await prisma.vpnService.findUniqueOrThrow({ where: { orderId: order.id } });
    const other = await makeUser();
    await expect(createOrder({ userId: other.id, productId: product.id, paymentMethod: 'CARD_TO_CARD', renewalOfServiceId: svc.id })).rejects.toThrow();
    const p2 = await makeProduct({ name: 'other inbound', xuiInboundId: 2 });
    await expect(createOrder({ userId: svc.userId, productId: p2.id, paymentMethod: 'CARD_TO_CARD', renewalOfServiceId: svc.id })).rejects.toThrow(/مناسب/);
  });

  it('renewal retry after a failure applies absolute targets once', async () => {
    const { user, product, order, p } = await paidOrder();
    await approvePayment(p.id, { actor: 'a' });
    const svc = await prisma.vpnService.findUniqueOrThrow({ where: { orderId: order.id } });
    const { order: ro } = await createOrder({ userId: user.id, productId: product.id, paymentMethod: 'CARD_TO_CARD', renewalOfServiceId: svc.id });
    ctx.vpn.failNext = 1;
    const rp = await submit(user.id, ro.id, { trackingCode: '700700700' });
    await approvePayment(rp.id, { actor: 'a' });
    await prisma.provisioningTask.update({ where: { orderId: ro.id }, data: { nextAttemptAt: new Date() } });
    await retryDueProvisioning();
    await prisma.provisioningTask.update({ where: { orderId: ro.id }, data: { status: 'FAILED', nextAttemptAt: new Date() } });
    await retryDueProvisioning(); // re-applying must not extend twice
    const after = await prisma.vpnService.findUniqueOrThrow({ where: { id: svc.id } });
    expect(after.expiresAt.getTime() - svc.expiresAt.getTime()).toBe(30 * 86_400_000);
    expect(after.trafficLimit).toBe(100n * GB);
  });
});

describe('lifecycle: sync / expiry / suspend / delete', () => {
  async function active() {
    const { user, order, p } = await paidOrder();
    await approvePayment(p.id, { actor: 'a' });
    return { user, svc: await prisma.vpnService.findUniqueOrThrow({ where: { orderId: order.id } }) };
  }

  it('traffic sync pulls real usage and never invents any', async () => {
    const { user, svc } = await active();
    expect((await getServiceForUser(user.id, svc.id)).trafficUsed).toBe(0n);
    ctx.vpn.clients.get(svc.externalId)!.up = 5n * GB; ctx.vpn.clients.get(svc.externalId)!.down = 7n * GB;
    const s = await syncService(svc.id);
    expect(s!.trafficUsed).toBe(12n * GB);
    expect(s!.lastSyncAt).not.toBeNull();
    ctx.vpn.clients.delete(svc.externalId);
    expect(await syncService(svc.id)).toBeNull(); // missing: nothing changed
    expect((await prisma.vpnService.findUniqueOrThrow({ where: { id: svc.id } })).trafficUsed).toBe(12n * GB);
  });

  it('exhausted traffic or panel-disabled => EXPIRED in db', async () => {
    const { svc } = await active();
    ctx.vpn.clients.get(svc.externalId)!.down = 51n * GB;
    expect((await syncService(svc.id))!.status).toBe('EXPIRED');
  });

  it('suspend / resume / delete go through the provider and are audited', async () => {
    const { svc } = await active();
    await suspendService(svc.id, 'admin:1');
    expect(ctx.vpn.clients.get(svc.externalId)!.enabled).toBe(false);
    expect((await prisma.vpnService.findUniqueOrThrow({ where: { id: svc.id } })).status).toBe('SUSPENDED');
    await resumeService(svc.id, 'admin:1');
    expect(ctx.vpn.clients.get(svc.externalId)!.enabled).toBe(true);
    await deleteService(svc.id, 'admin:1');
    expect(ctx.vpn.clients.size).toBe(0);
    const acts = (await prisma.auditLog.findMany()).map((a) => a.action);
    expect(acts).toEqual(expect.arrayContaining(['vpn.suspend', 'vpn.resume', 'vpn.delete']));
  });

  it('expiry notifications fire once per threshold; expiry marks EXPIRED', async () => {
    const { svc } = await active();
    await prisma.vpnService.update({ where: { id: svc.id }, data: { expiresAt: new Date(Date.now() + 2.5 * 86_400_000) } });
    await processExpirations(); await processExpirations();
    expect(ctx.sent.filter((m) => m.text.includes('منقضی می‌شود')).length).toBe(1);
    await prisma.vpnService.update({ where: { id: svc.id }, data: { expiresAt: new Date(Date.now() + 0.5 * 86_400_000) } });
    await processExpirations();
    expect(ctx.sent.filter((m) => m.text.includes('منقضی می‌شود')).length).toBe(2);
    await prisma.vpnService.update({ where: { id: svc.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const r = await processExpirations(); await processExpirations();
    expect(r.expired).toBe(1);
    expect((await prisma.vpnService.findUniqueOrThrow({ where: { id: svc.id } })).status).toBe('EXPIRED');
    expect(ctx.sent.filter((m) => m.text.includes('منقضی شد')).length).toBe(1);
  });
});
