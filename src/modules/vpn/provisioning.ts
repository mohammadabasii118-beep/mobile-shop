import { randomBytes, randomUUID } from 'node:crypto';
import { Order, Prisma, Product, Protocol, VpnService } from '@prisma/client';
import { prisma } from '../../db/client';
import { logger } from '../../utils/logger';
import { addDays, gbToBytes } from '../../utils/misc';
import { audit } from '../admin/audit';
import { getNumber, getNumberList } from '../settings/service';
import { notifyAdmins, notifyUser } from '../notifications/service';
import { getVpnProvider } from '../../providers/vpn';
import { ProviderError, ServiceRef } from '../../providers/vpn/types';
import { deliveryMessage } from './messages';

export const refOf = (s: Pick<VpnService, 'inboundId' | 'externalId' | 'uuid' | 'protocol'>): ServiceRef => ({
  inboundId: s.inboundId, email: s.externalId, credential: s.uuid, protocol: s.protocol,
});

const credentialFor = (p: Protocol) => (p === 'VLESS' || p === 'VMESS' ? randomUUID() : randomBytes(18).toString('base64url'));
const subIdGen = () => randomBytes(8).toString('hex');

/** `tg_<telegramId>_<order>`: lowercase, [a-z0-9_-], <= 64 chars. Searchable in X-UI. */
export function clientEmail(telegramId: bigint, orderNumber: string) {
  return `tg_${telegramId}_${orderNumber}`.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 64);
}

const sanitizeErr = (e: unknown) => String((e as any)?.message ?? e).replace(/(password|token|secret)=\S+/gi, '$1=[REDACTED]').slice(0, 300);

/**
 * Idempotent provisioning for a PAID order.
 *  - SUCCESS task => no-op (never a 2nd client)
 *  - PROCESSING (not stale) => no-op
 *  - FAILED => retried only when nextAttemptAt is due (or force)
 *  - a timeout after addClient is safe: the retry finds the client by email and adopts it
 */
export async function runProvisioning(orderId: string, opts: { force?: boolean } = {}): Promise<'done' | 'skipped' | 'failed'> {
  const timeoutMs = (await getNumber('provisioning.processingTimeoutSeconds')) * 1000;
  const now = new Date();
  const claim = await prisma.provisioningTask.updateMany({
    where: {
      orderId,
      OR: [
        { status: 'PENDING', ...(opts.force ? {} : { nextAttemptAt: { lte: now } }) },
        { status: 'FAILED', ...(opts.force ? {} : { nextAttemptAt: { lte: now } }) },
        { status: 'PROCESSING', lockedAt: { lt: new Date(now.getTime() - timeoutMs) } },
      ],
    },
    data: { status: 'PROCESSING', lockedAt: now, attempts: { increment: 1 } },
  });
  if (claim.count !== 1) return 'skipped';

  const task = await prisma.provisioningTask.findUniqueOrThrow({ where: { orderId }, include: { order: { include: { product: true, user: true } } } });
  const { order } = task;
  await prisma.order.updateMany({ where: { id: orderId, status: { in: ['PAID', 'PROVISIONING'] } }, data: { status: 'PROVISIONING' } });
  await audit({ actor: 'system', action: 'vpn.provision.start', target: 'Order', targetId: orderId, metadata: { kind: task.kind, attempt: task.attempts } });

  try {
    if (task.kind === 'CREATE') await doCreate(order, order.product, order.user.telegramId);
    else await doRenew(task.id, order, order.product);
    await prisma.provisioningTask.update({ where: { id: task.id }, data: { status: 'SUCCESS', lockedAt: null, lastError: null } });
    return 'done';
  } catch (e) {
    await onFailure(task.id, orderId, task.attempts, e);
    return 'failed';
  }
}

async function doCreate(order: Order, product: Product, telegramId: bigint) {
  const provider = getVpnProvider();
  const email = clientEmail(telegramId, order.orderNumber);
  let svc = await prisma.vpnService.findUnique({ where: { orderId: order.id } });
  const trafficLimit = gbToBytes(product.trafficGB);
  if (!svc) {
    // Persist identifiers BEFORE calling the panel, so retries reuse the same uuid/email.
    svc = await prisma.vpnService.create({
      data: {
        userId: order.userId, orderId: order.id, productId: product.id, provider: product.xuiProviderId,
        inboundId: product.xuiInboundId, externalId: email, uuid: credentialFor(product.protocol), subId: subIdGen(),
        protocol: product.protocol, trafficLimit, expiresAt: addDays(new Date(), product.durationDays), provisioningStatus: 'PROCESSING',
      },
    });
  } else {
    if (svc.provisioningStatus === 'SUCCESS') return; // idempotent
    svc = await prisma.vpnService.update({ where: { id: svc.id }, data: { provisioningStatus: 'PROCESSING', expiresAt: addDays(new Date(), product.durationDays) } });
  }

  const ref = refOf(svc);
  const { status, adopted } = await provider.createService({
    ...ref, subId: svc.subId, telegramId: String(telegramId), trafficLimitBytes: svc.trafficLimit, expiresAt: svc.expiresAt,
  });
  if (!status.exists) throw new ProviderError('client missing after create', true);
  const cfg = await provider.getConfig({ ...ref, subId: svc.subId });

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.vpnService.update({
      where: { id: svc!.id },
      data: {
        provisioningStatus: 'SUCCESS', status: 'ACTIVE', clientId: svc!.uuid, config: cfg.config, subscriptionUrl: cfg.subscriptionUrl ?? null,
        expiresAt: status.expiresAt ?? svc!.expiresAt, trafficLimit: status.trafficLimit || svc!.trafficLimit, lastSyncAt: new Date(),
      },
    });
    await tx.order.updateMany({ where: { id: order.id, status: { in: ['PAID', 'PROVISIONING'] } }, data: { status: 'FULFILLED' } });
    await audit({ actor: 'system', action: 'vpn.provision.success', target: 'VpnService', targetId: s.id, metadata: { orderId: order.id, adopted, inboundId: s.inboundId } }, tx);
    return s;
  });
  await notifyUser(order.userId, 'vpn_created', deliveryMessage(updated, product, 'created'), {
    buttons: deliveryButtons(updated),
    dedupeKey: `delivery:${updated.id}`,
  });
}

export const deliveryButtons = (s: Pick<VpnService, 'id' | 'subscriptionUrl'>) => [
  [{ text: '🔗 دریافت لینک', data: `sv:link:${s.id}` }, { text: '📋 دریافت کانفیگ', data: `sv:cfg:${s.id}` }],
  [{ text: '📱 QR Code', data: `sv:qr:${s.id}` }, { text: '📦 سرویس‌های من', data: 'menu:services' }],
];

async function doRenew(taskId: string, order: Order, product: Product) {
  const provider = getVpnProvider();
  const t = await prisma.provisioningTask.findUniqueOrThrow({ where: { id: taskId } });
  const svc = await prisma.vpnService.findUniqueOrThrow({ where: { id: order.renewalOfServiceId! } });
  // Absolute targets are computed ONCE and persisted => a retry never extends twice.
  let targetExpiry = t.targetExpiresAt;
  let targetLimit = t.targetTrafficLimit;
  if (!targetExpiry || targetLimit === null) {
    targetExpiry = addDays(svc.expiresAt.getTime() > Date.now() ? svc.expiresAt : new Date(), product.durationDays);
    targetLimit = svc.trafficLimit + gbToBytes(product.trafficGB);
    await prisma.provisioningTask.update({ where: { id: taskId }, data: { targetExpiresAt: targetExpiry, targetTrafficLimit: targetLimit } });
  }
  const status = await provider.renewService({ ...refOf(svc), trafficLimitBytes: targetLimit, expiresAt: targetExpiry });
  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.vpnService.update({
      where: { id: svc.id },
      data: { expiresAt: targetExpiry!, trafficLimit: targetLimit!, status: 'ACTIVE', provisioningStatus: 'SUCCESS', expiryNotified: Prisma.DbNull, trafficUsed: status.used, lastSyncAt: new Date() },
    });
    await tx.order.updateMany({ where: { id: order.id, status: { in: ['PAID', 'PROVISIONING'] } }, data: { status: 'FULFILLED' } });
    await audit({ actor: 'system', action: 'vpn.renew.success', target: 'VpnService', targetId: s.id, metadata: { orderId: order.id, expiresAt: targetExpiry } }, tx);
    return s;
  });
  await notifyUser(order.userId, 'vpn_renewed', deliveryMessage(updated, product, 'renewed'), { buttons: deliveryButtons(updated), dedupeKey: `renew:${order.id}` });
}

async function onFailure(taskId: string, orderId: string, attempts: number, e: unknown) {
  const msg = sanitizeErr(e);
  const maxRetries = await getNumber('provisioning.maxRetries');
  const backoff = await getNumberList('provisioning.backoffSeconds');
  const delay = backoff[Math.min(attempts - 1, backoff.length - 1)] ?? 3600;
  const exhausted = attempts > maxRetries;
  const task = await prisma.provisioningTask.update({
    where: { id: taskId },
    data: { status: 'FAILED', lockedAt: null, lastError: msg, nextAttemptAt: new Date(Date.now() + (exhausted ? 10 * 365 * 86_400_000 : delay * 1000)) },
    include: { order: true },
  });
  if (task.kind === 'CREATE') await prisma.vpnService.updateMany({ where: { orderId, provisioningStatus: { not: 'SUCCESS' } }, data: { provisioningStatus: 'FAILED' } });
  await audit({ actor: 'system', action: 'vpn.provision.failed', target: 'Order', targetId: orderId, metadata: { attempts, error: msg, exhausted } });
  logger.warn({ orderId, attempts, err: msg }, 'provisioning failed');

  if (attempts === 1 || (exhausted && !task.adminAlerted)) {
    await prisma.provisioningTask.update({ where: { id: taskId }, data: { adminAlerted: exhausted ? true : task.adminAlerted } });
    await notifyAdmins(
      'provisioning_failed',
      `⚠️ VPN provisioning failed\nسفارش: ${task.order.orderNumber}\nتلاش: ${attempts}\nخطا: ${msg}${exhausted ? '\n⛔ حداکثر تلاش خودکار تمام شد — نیاز به بررسی دستی.' : `\nتلاش بعدی خودکار طی ${Math.round(delay / 60)} دقیقه.`}`,
      { roles: ['VPN_ADMIN'], buttons: [[{ text: '🔁 Retry', data: `av:retry:${orderId}` }]], dedupeKey: `prov_fail:${orderId}:${exhausted ? 'x' : attempts}` },
    );
  }
}

/** Job: pick due FAILED/PENDING tasks and stale PROCESSING tasks. */
export async function retryDueProvisioning(): Promise<number> {
  const maxRetries = await getNumber('provisioning.maxRetries');
  const timeoutMs = (await getNumber('provisioning.processingTimeoutSeconds')) * 1000;
  const now = new Date();
  const tasks = await prisma.provisioningTask.findMany({
    where: {
      attempts: { lte: maxRetries },
      OR: [{ status: { in: ['PENDING', 'FAILED'] }, nextAttemptAt: { lte: now } }, { status: 'PROCESSING', lockedAt: { lt: new Date(now.getTime() - timeoutMs) } }],
    },
    take: 20,
  });
  let n = 0;
  for (const t of tasks) if ((await runProvisioning(t.orderId)) !== 'skipped') n++;
  return n;
}

/** Admin retry: resets the schedule and runs now (still idempotent). */
export async function adminRetry(orderId: string, actor: string) {
  await prisma.provisioningTask.updateMany({ where: { orderId, status: 'FAILED' }, data: { nextAttemptAt: new Date(), adminAlerted: false } });
  await audit({ actor, action: 'vpn.retry', target: 'Order', targetId: orderId });
  return runProvisioning(orderId, { force: false });
}
