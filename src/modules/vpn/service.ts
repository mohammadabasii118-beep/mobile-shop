import { VpnService } from '@prisma/client';
import { prisma } from '../../db/client';
import { ConflictError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { DAY_MS } from '../../utils/misc';
import { audit } from '../admin/audit';
import { getNumberList } from '../settings/service';
import { notifyUser } from '../notifications/service';
import * as T from '../notifications/templates';
import { getVpnProvider } from '../../providers/vpn';
import { refOf } from './provisioning';
import { linkRemark, validateServiceName } from '../../utils/names';

export const listUserServices = (userId: string) =>
  prisma.vpnService.findMany({ where: { userId, provisioningStatus: 'SUCCESS' }, orderBy: { createdAt: 'desc' }, include: { product: true } });

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
  const st = await getVpnProvider().getServiceStatus(refOf(s));
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
  const rows = await prisma.vpnService.findMany({ where: { provisioningStatus: 'SUCCESS', status: { in: ['ACTIVE', 'EXPIRED', 'SUSPENDED'] } }, select: { id: true } });
  let ok = 0, failed = 0;
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
      try { await getVpnProvider().suspendService(refOf(s)); } catch { /* panel disables expired clients itself */ }
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
  await getVpnProvider().suspendService(refOf(s));
  await prisma.vpnService.update({ where: { id }, data: { status: 'SUSPENDED' } });
  await audit({ actor, action: 'vpn.suspend', target: 'VpnService', targetId: id });
}

export async function resumeService(id: string, actor: string) {
  const s = await mustBeProvisioned(id);
  await getVpnProvider().resumeService(refOf(s));
  await prisma.vpnService.update({ where: { id }, data: { status: s.expiresAt.getTime() > Date.now() ? 'ACTIVE' : 'EXPIRED' } });
  await audit({ actor, action: 'vpn.resume', target: 'VpnService', targetId: id });
}

export async function deleteService(id: string, actor: string) {
  const s = await prisma.vpnService.findUniqueOrThrow({ where: { id } });
  await getVpnProvider().deleteService(refOf(s));
  await prisma.vpnService.update({ where: { id }, data: { status: 'CANCELLED' } });
  await audit({ actor, action: 'vpn.delete', target: 'VpnService', targetId: id, metadata: { externalId: s.externalId } });
}

/** Re-fetch the real link from the panel (inbound settings may have changed). */
export async function refreshConfig(id: string) {
  const s = await mustBeProvisioned(id);
  const cfg = await getVpnProvider().getConfig({ ...refOf(s), subId: s.subId, remark: linkRemark(s.displayName, s.externalId) });
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
