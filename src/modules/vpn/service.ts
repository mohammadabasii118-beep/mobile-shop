import { VpnService } from '@prisma/client';
import { prisma } from '../../db/client';
import { ConflictError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { DAY_MS } from '../../utils/misc';
import { audit } from '../admin/audit';
import { getNumberList } from '../settings/service';
import { notifyUser } from '../notifications/service';
import * as T from '../notifications/templates';
import { vpnFor } from '../../providers/vpn';
import { credentialFor, refOf, subIdGen } from './provisioning';
import { linkRemark, validateServiceName } from '../../utils/names';

export const listUserServices = (userId: string) =>
  prisma.vpnService.findMany({ where: { userId, provisioningStatus: 'SUCCESS', status: { not: 'CANCELLED' } }, orderBy: { createdAt: 'desc' }, include: { product: true } });

/** Ownership-checked fetch. */
export async function getServiceForUser(userId: string, id: string) {
  const s = await prisma.vpnService.findUnique({ where: { id }, include: { product: true } });
  if (!s) throw new NotFoundError('service');
  if (s.userId !== userId) throw new ForbiddenError();
  return s;
}

export async function getServiceAdmin(id: string) {
  const s = await prisma.vpnService.findUnique({ where: { id }, include: { product: true, user: true, order: true } });
  if (!s) throw new NotFoundError('service');
  return s;
}

/** Pull real usage/expiry/enabled flag from the panel. Never fabricates numbers. */
export async function syncService(id: string): Promise<VpnService | null> {
  const s = await prisma.vpnService.findUniqueOrThrow({ where: { id } });
  if (s.provisioningStatus !== 'SUCCESS' || s.status === 'CANCELLED') return s;
  const st = await (await vpnFor(s.provider)).getServiceStatus(refOf(s));
  if (!st) {
    logger.warn({ id }, 'service missing in panel during sync');
    return null;
  }
  const expiresAt = st.expiresAt ?? s.expiresAt;
  const exhausted = st.trafficLimit > 0n && st.used >= st.trafficLimit;
  let status = s.status;
  if (expiresAt.getTime() <= Date.now() || exhausted) status = 'EXPIRED';
  else if (!st.enabled && s.status !== 'SUSPENDED') status = 'EXPIRED'; // panel disabled it
  else if (st.enabled && s.status === 'EXPIRED') status = 'ACTIVE';
  return prisma.vpnService.update({
    where: { id },
    data: { trafficUsed: st.used, trafficLimit: st.trafficLimit > 0n ? st.trafficLimit : s.trafficLimit, expiresAt, status, lastSyncAt: new Date() },
  });
}

export async function syncAllServices(): Promise<{ ok: number; failed: number }> {
  const all = await prisma.vpnService.findMany({ where: { provisioningStatus: 'SUCCESS', status: { in: ['ACTIVE', 'EXPIRED', 'SUSPENDED'] } }, select: { id: true, provider: true } });
  // One cheap probe per panel: an unreachable panel must not stall the whole sync with per-service timeouts.
  const { testPanel } = await import('../panels/service');
  const down = new Set<string>();
  for (const code of new Set(all.map((r) => r.provider))) if (!(await testPanel(code)).ok) down.add(code);
  const rows = all.filter((r) => !down.has(r.provider));
  let ok = 0, failed = down.size ? all.length - rows.length : 0;
  for (const r of rows) {
    try { await syncService(r.id); ok++; } catch (e: any) { failed++; logger.warn({ id: r.id, err: String(e?.message) }, 'sync failed'); }
  }
  return { ok, failed };
}

/** Local expiry fallback + notification thresholds. */
export async function processExpirations(now = new Date()): Promise<{ expired: number; notified: number }> {
  const thresholds = (await getNumberList('notify.expiryDays')).sort((a, b) => b - a);
  const rows = await prisma.vpnService.findMany({ where: { provisioningStatus: 'SUCCESS', status: 'ACTIVE' }, include: { product: true } });
  let expired = 0, notified = 0;
  for (const s of rows) {
    const flags = ((s.expiryNotified as Record<string, boolean> | null) ?? {});
    const left = s.expiresAt.getTime() - now.getTime();
    if (left <= 0) {
      await prisma.vpnService.update({ where: { id: s.id }, data: { status: 'EXPIRED', expiryNotified: { ...flags, expired: true } } });
      try { await (await vpnFor(s.provider)).suspendService(refOf(s)); } catch { /* panel disables expired clients itself */ }
      await audit({ actor: 'system', action: 'vpn.expire', target: 'VpnService', targetId: s.id });
      if (!flags.expired) {
        await notifyUser(s.userId, 'vpn_expired', await T.expired(s.product.name), {
          html: true,
          buttons: [[{ text: '🔄 تمدید', data: `sv:renew:${s.id}` }]], dedupeKey: `expired:${s.id}:${s.expiresAt.getTime()}`,
        });
        notified++;
      }
      expired++;
      continue;
    }
    // Only the tightest threshold that applies is sent (no duplicate bursts).
    const due = thresholds.filter((d) => left <= d * DAY_MS && !flags[String(d)]);
    if (due.length) {
      const d = Math.min(...due);
      const next = { ...flags, ...Object.fromEntries(due.map((x) => [String(x), true])) };
      await prisma.vpnService.update({ where: { id: s.id }, data: { expiryNotified: next } });
      await notifyUser(s.userId, 'vpn_expiring', await T.expiring(s.product.name, d, s.expiresAt), {
        html: true,
        buttons: [[{ text: '🔄 تمدید', data: `sv:renew:${s.id}` }]], dedupeKey: `expiring:${s.id}:${d}:${s.expiresAt.getTime()}`,
      });
      notified++;
    }
  }
  return { expired, notified };
}

/* ------------------------------ admin actions ----------------------------- */

async function mustBeProvisioned(id: string) {
  const s = await prisma.vpnService.findUniqueOrThrow({ where: { id } });
  if (s.provisioningStatus !== 'SUCCESS') throw new ConflictError('service is not provisioned');
  return s;
}

export async function suspendService(id: string, actor: string) {
  const s = await mustBeProvisioned(id);
  await (await vpnFor(s.provider)).suspendService(refOf(s));
  await prisma.vpnService.update({ where: { id }, data: { status: 'SUSPENDED' } });
  await audit({ actor, action: 'vpn.suspend', target: 'VpnService', targetId: id });
}

export async function resumeService(id: string, actor: string) {
  const s = await mustBeProvisioned(id);
  await (await vpnFor(s.provider)).resumeService(refOf(s));
  await prisma.vpnService.update({ where: { id }, data: { status: s.expiresAt.getTime() > Date.now() ? 'ACTIVE' : 'EXPIRED' } });
  await audit({ actor, action: 'vpn.resume', target: 'VpnService', targetId: id });
}

export async function deleteService(id: string, actor: string) {
  const s = await prisma.vpnService.findUniqueOrThrow({ where: { id } });
  await (await vpnFor(s.provider)).deleteService(refOf(s));
  await prisma.vpnService.update({ where: { id }, data: { status: 'CANCELLED' } });
  await audit({ actor, action: 'vpn.delete', target: 'VpnService', targetId: id, metadata: { externalId: s.externalId } });
}

/** Re-fetch the real link from the panel (inbound settings may have changed). */
export async function refreshConfig(id: string) {
  const s = await mustBeProvisioned(id);
  const cfg = await (await vpnFor(s.provider)).getConfig({ ...refOf(s), subId: s.subId, remark: linkRemark(s.displayName, s.externalId) });
  return prisma.vpnService.update({ where: { id }, data: { config: cfg.config, subscriptionUrl: cfg.subscriptionUrl ?? null } });
}

/** Admin-granted renewal: zero-priced PAID order + RENEW task, still fully audited and idempotent. */
export async function adminRenew(serviceId: string, productId: string, actor: string) {
  const { runProvisioning } = await import('./provisioning');
  const svc = await prisma.vpnService.findUniqueOrThrow({ where: { id: serviceId } });
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  if (svc.inboundId !== product.xuiInboundId || svc.provider !== product.xuiProviderId) throw new ConflictError('product does not match service inbound');
  const order = await prisma.order.create({
    data: {
      orderNumber: `ADM-${Date.now().toString(36).toUpperCase()}`, userId: svc.userId, productId, amount: product.price, discountAmount: product.price,
      finalAmount: 0, currency: product.currency, status: 'PAID', paymentMethod: 'CARD_TO_CARD', renewalOfServiceId: serviceId,
    },
  });
  await prisma.provisioningTask.create({ data: { orderId: order.id, kind: 'RENEW', serviceId } });
  await audit({ actor, action: 'vpn.admin_renew', target: 'VpnService', targetId: serviceId, metadata: { productId, orderId: order.id } });
  await runProvisioning(order.id);
  return order;
}

export const listServicesAdmin = (skip = 0, take = 8) =>
  prisma.vpnService.findMany({ orderBy: { createdAt: 'desc' }, skip, take, include: { product: true, user: true } });

/** Customer renames their service: DB name + the remark inside the direct link. The panel client email never changes. */
export async function renameService(userId: string, id: string, rawName: string | null) {
  const s = await getServiceForUser(userId, id);
  const name = rawName === null ? null : validateServiceName(rawName);
  await prisma.vpnService.update({ where: { id }, data: { displayName: name } });
  await audit({ actor: `user:${userId}`, action: 'vpn.rename', target: 'VpnService', targetId: id, metadata: { name } });
  if (s.provisioningStatus === 'SUCCESS') {
    try { await refreshConfig(id); } catch (e: any) { logger.warn({ id, err: String(e?.message) }, 'rename: config refresh failed (name saved)'); }
  }
  return prisma.vpnService.findUniqueOrThrow({ where: { id }, include: { product: true } });
}

/* --------------------------- customer self-service --------------------------- */

const ROTATE_COOLDOWN_MS = 10 * 60_000;
// Renewals that already carry money (or are being fulfilled) block self-delete; an unpaid one is simply cancelled with it.
const PAID_RENEWAL = ['PAYMENT_SUBMITTED', 'PAYMENT_REVIEW', 'PAID', 'PROVISIONING'] as const;
const inflight = new Set<string>(); // a double-tap must not rotate twice (single bot process)

/**
 * "Change link": new uuid/password + new subscription id on the SAME client (traffic, expiry and name are kept).
 * Every old link/config stops working at once — for when a link leaked or was shared.
 * The new identifiers are written to the DB right after the panel accepted them; only then is the link re-read, so a failure
 * afterwards leaves the DB pointing at the real (new) credentials and the link can simply be re-fetched.
 */
export async function rotateServiceLink(userId: string, id: string) {
  const s = await getServiceForUser(userId, id);
  if (s.provisioningStatus !== 'SUCCESS' || s.status !== 'ACTIVE') throw new ConflictError('تغییر لینک فقط برای سرویس فعال ممکن است.');
  if (inflight.has(s.id)) throw new ConflictError('تغییر لینک در حال انجام است؛ چند لحظه صبر کنید.');
  inflight.add(s.id);
  try {
    const recent = await prisma.auditLog.findFirst({ where: { action: 'vpn.rotate_link', targetId: s.id, createdAt: { gt: new Date(Date.now() - ROTATE_COOLDOWN_MS) } }, select: { id: true } });
    if (recent) throw new ConflictError('لینک همین چند دقیقه‌ی پیش تغییر کرده است؛ کمی بعد دوباره تلاش کنید.');
    const credential = credentialFor(s.protocol);
    const subId = subIdGen();
    const provider = await vpnFor(s.provider);
    await provider.rotateLink(refOf(s), { credential, subId });
    await prisma.vpnService.update({ where: { id: s.id }, data: { uuid: credential, clientId: credential, subId, config: null, subscriptionUrl: null } });
    await audit({ actor: `user:${userId}`, action: 'vpn.rotate_link', target: 'VpnService', targetId: s.id, metadata: { externalId: s.externalId } });
    return await refreshConfig(s.id); // if this fails the user can press "get link" again: it re-reads from the panel
  } finally { inflight.delete(s.id); }
}

/** The customer deletes their own service: the client is removed from the panel for good (no refund, no undo). */
export async function deleteServiceByUser(userId: string, id: string) {
  const s = await getServiceForUser(userId, id);
  if (s.provisioningStatus !== 'SUCCESS' || (s.status !== 'ACTIVE' && s.status !== 'EXPIRED')) throw new ConflictError('این سرویس را نمی‌توان حذف کرد؛ با پشتیبانی تماس بگیرید.');
  const paid = await prisma.order.count({ where: { renewalOfServiceId: s.id, status: { in: [...PAID_RENEWAL] } } });
  if (paid) throw new ConflictError('برای این سرویس یک تمدید پرداخت‌شده در جریان است؛ بعد از پایان آن می‌توانید حذفش کنید.');
  const { cancelOrder } = await import('../orders/service');
  for (const o of await prisma.order.findMany({ where: { renewalOfServiceId: s.id, status: 'PENDING_PAYMENT' }, select: { id: true } })) {
    await cancelOrder(userId, o.id).catch(() => undefined); // an unpaid renewal of a service that is being deleted is moot
  }
  await deleteService(s.id, `user:${userId}`);
  return s;
}
