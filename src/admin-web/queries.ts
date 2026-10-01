/** Read-only listing queries for the web panel (no business logic). Everything comes from the database. */
import { Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import { PaymentFilter, filterWhere } from '../modules/payments/service';
import { dashboardStats } from '../modules/admin/stats';

export const PAGE_SIZE = 15;
export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number }
const paged = <T>(items: T[], total: number, page: number): Paged<T> => ({ items, total, page, pageSize: PAGE_SIZE });
const skip = (page: number) => ({ skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE });
const isNum = (s: string) => /^\d{1,15}$/.test(s);
const ci = (s: string) => ({ contains: s, mode: 'insensitive' as const });

export async function listUsers(q: string, status: string, page: number) {
  const where: Prisma.UserWhereInput = {
    ...(status === 'blocked' ? { isBlocked: true } : status === 'active' ? { isBlocked: false } : {}),
    ...(q ? { OR: [...(isNum(q) ? [{ telegramId: BigInt(q) }] : []), { username: ci(q) }, { firstName: ci(q) }, { lastName: ci(q) }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, ...skip(page), include: { _count: { select: { orders: true, services: { where: { status: 'ACTIVE', provisioningStatus: 'SUCCESS' } } } } } }),
    prisma.user.count({ where }),
  ]);
  return paged(rows.map((u) => ({ id: u.id, telegramId: u.telegramId, username: u.username, name: [u.firstName, u.lastName].filter(Boolean).join(' '), isBlocked: u.isBlocked, orders: u._count.orders, activeServices: u._count.services, createdAt: u.createdAt })), total, page);
}

export async function getUserDetail(id: string) {
  const u = await prisma.user.findUnique({ where: { id }, include: { orders: { orderBy: { createdAt: 'desc' }, take: 10, include: { product: true } }, services: { orderBy: { createdAt: 'desc' }, take: 10, include: { product: true } } } });
  return u;
}

export async function listOrders(q: string, status: string, page: number) {
  const where: Prisma.OrderWhereInput = {
    ...(status && status !== 'all' ? { status: status as any } : {}),
    ...(q ? { OR: [{ orderNumber: ci(q) }, { user: { username: ci(q) } }, ...(isNum(q) ? [{ user: { telegramId: BigInt(q) } }] : [])] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, ...skip(page), include: { user: true, product: true } }),
    prisma.order.count({ where }),
  ]);
  return paged(rows.map((o) => ({ id: o.id, orderNumber: o.orderNumber, status: o.status, amount: o.amount, discountAmount: o.discountAmount, finalAmount: o.finalAmount, currency: o.currency, paymentMethod: o.paymentMethod, isRenewal: !!o.renewalOfServiceId, createdAt: o.createdAt, product: o.product.name, user: { id: o.user.id, telegramId: o.user.telegramId, username: o.user.username, name: o.user.firstName } })), total, page);
}

export async function listPayments(filter: string, q: string, page: number) {
  const where: Prisma.PaymentWhereInput = {
    ...(filter && filter !== 'all' ? filterWhere(filter as PaymentFilter) : {}),
    ...(q ? { OR: [{ order: { orderNumber: ci(q) } }, { trackingCode: { contains: q } }, { user: { username: ci(q) } }, ...(isNum(q) ? [{ user: { telegramId: BigInt(q) } }] : [])] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' }, ...skip(page), include: { order: { include: { product: true } }, user: true } }),
    prisma.payment.count({ where }),
  ]);
  return paged(rows.map((p) => ({ id: p.id, orderNumber: p.order.orderNumber, product: p.order.product.name, amount: p.amount, currency: p.currency, provider: p.provider, trackingCode: p.trackingCode, status: p.status, autoApproved: p.autoApproved, verificationStatus: p.verificationStatus, riskLevel: p.riskLevel, riskScore: p.riskScore, hasReceipt: !!p.receiptPath, ocrAmount: (p.receiptData as any)?.amount ?? null, createdAt: p.createdAt, submittedAt: p.submittedAt, user: { telegramId: p.user.telegramId, username: p.user.username, name: p.user.firstName } })), total, page);
}

export async function getPaymentDetail(id: string) {
  const p = await prisma.payment.findUnique({
    where: { id },
    include: { order: { include: { product: true, service: true } }, user: true, verifications: { orderBy: { createdAt: 'asc' } }, bankTx: true },
  });
  if (!p) return null;
  const targets: Prisma.AuditLogWhereInput[] = [{ target: 'Payment', targetId: id }, { target: 'Order', targetId: p.orderId }];
  if (p.order.service) targets.push({ target: 'VpnService', targetId: p.order.service.id });
  if (p.bankTx) targets.push({ target: 'BankTransaction', targetId: p.bankTx.id });
  const audit = await prisma.auditLog.findMany({ where: { OR: targets }, orderBy: { createdAt: 'asc' }, take: 100 });
  return { payment: p, audit };
}

export async function listServices(q: string, status: string, page: number) {
  const where: Prisma.VpnServiceWhereInput = {
    ...(status === 'failed' ? { provisioningStatus: { not: 'SUCCESS' } } : status && status !== 'all' ? { status: status as any } : {}),
    ...(q ? { OR: [{ externalId: ci(q) }, { user: { username: ci(q) } }, ...(isNum(q) ? [{ user: { telegramId: BigInt(q) } }] : [])] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.vpnService.findMany({ where, orderBy: { createdAt: 'desc' }, ...skip(page), include: { user: true, product: true, order: { include: { task: true } } } }),
    prisma.vpnService.count({ where }),
  ]);
  return paged(rows.map((s) => ({ id: s.id, orderId: s.orderId, externalId: s.externalId, uuid: s.uuid, protocol: s.protocol, inboundId: s.inboundId, product: s.product.name, status: s.status, provisioningStatus: s.provisioningStatus, trafficLimit: s.trafficLimit, trafficUsed: s.trafficUsed, synced: !!s.lastSyncAt, lastSyncAt: s.lastSyncAt, expiresAt: s.expiresAt, createdAt: s.createdAt, taskAttempts: s.order.task?.attempts ?? 0, lastError: s.order.task?.lastError ?? null, user: { telegramId: s.user.telegramId, username: s.user.username, name: s.user.firstName } })), total, page);
}

export async function getServiceDetail(id: string) {
  const s = await prisma.vpnService.findUnique({ where: { id }, include: { user: true, product: true, order: { include: { task: true } } } });
  if (!s) return null;
  const audit = await prisma.auditLog.findMany({ where: { OR: [{ target: 'VpnService', targetId: id }, { target: 'Order', targetId: s.orderId }] }, orderBy: { createdAt: 'desc' }, take: 30 });
  return { service: s, audit };
}

export async function listTickets(q: string, status: string, page: number) {
  const where: Prisma.TicketWhereInput = {
    ...(status && status !== 'all' ? { status: status as any } : {}),
    ...(q ? { OR: [{ subject: ci(q) }, { user: { username: ci(q) } }, ...(isNum(q) ? [{ user: { telegramId: BigInt(q) } }] : [])] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.ticket.findMany({ where, orderBy: { updatedAt: 'desc' }, ...skip(page), include: { user: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 }, _count: { select: { messages: true } } } }),
    prisma.ticket.count({ where }),
  ]);
  return paged(rows.map((t) => ({ id: t.id, subject: t.subject, category: t.category, status: t.status, messageCount: t._count.messages, lastMessage: t.messages[0] ? { text: t.messages[0].text.slice(0, 120), fromAdmin: t.messages[0].fromAdmin } : null, createdAt: t.createdAt, updatedAt: t.updatedAt, user: { telegramId: t.user.telegramId, username: t.user.username, name: t.user.firstName } })), total, page);
}

export const getTicketDetail = (id: string) => prisma.ticket.findUnique({ where: { id }, include: { user: true, messages: { orderBy: { createdAt: 'asc' } } } });

export async function listNotifications(status: string, audience: string, page: number) {
  const where: Prisma.NotificationWhereInput = { ...(status && status !== 'all' ? { status: status as any } : {}), ...(audience && audience !== 'all' ? { audience: audience as any } : {}) };
  const [rows, total, counts] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, ...skip(page) }),
    prisma.notification.count({ where }),
    prisma.notification.groupBy({ by: ['status'], _count: true }),
  ]);
  return { ...paged(rows.map((n) => ({ id: n.id, audience: n.audience, chatId: n.chatId, type: n.type, text: n.text.replace(/<[^>]+>/g, '').slice(0, 160), status: n.status, attempts: n.attempts, lastError: n.lastError, createdAt: n.createdAt, sentAt: n.sentAt })), total, page), counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) };
}

export async function listAudit(q: string, action: string, page: number) {
  const where: Prisma.AuditLogWhereInput = {
    ...(action && action !== 'all' ? { action: { startsWith: action } } : {}),
    ...(q ? { OR: [{ actor: ci(q) }, { action: ci(q) }, { targetId: { contains: q } }] } : {}),
  };
  const [rows, total] = await Promise.all([prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...skip(page) }), prisma.auditLog.count({ where })]);
  return paged(rows, total, page);
}

const tehranDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(d);

export async function dashboard(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const [stats, pay, ord, svc, failedProv, attention, recentOrders] = await Promise.all([
    dashboardStats(),
    prisma.$queryRaw<{ d: string; n: number; s: bigint }[]>`SELECT to_char(((("reviewedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tehran'))::date,'YYYY-MM-DD') d, count(*)::int n, COALESCE(sum(amount),0)::bigint s FROM "Payment" WHERE status='APPROVED' AND "reviewedAt" >= ${since} GROUP BY 1`,
    prisma.$queryRaw<{ d: string; n: number }[]>`SELECT to_char(((("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tehran'))::date,'YYYY-MM-DD') d, count(*)::int n FROM "Order" WHERE "createdAt" >= ${since} GROUP BY 1`,
    prisma.vpnService.groupBy({ by: ['status'], where: { provisioningStatus: 'SUCCESS' }, _count: true }),
    prisma.provisioningTask.count({ where: { status: 'FAILED' } }),
    prisma.payment.findMany({ where: { status: 'NEEDS_REVIEW' }, orderBy: { createdAt: 'asc' }, take: 5, include: { order: true, user: true } }),
    prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 6, include: { product: true, user: true } }),
  ]);
  const payMap = new Map(pay.map((r) => [r.d, r])), ordMap = new Map(ord.map((r) => [r.d, r.n]));
  const series = Array.from({ length: days }, (_, k) => {
    const day = tehranDay(new Date(Date.now() - (days - 1 - k) * 86_400_000));
    return { day, revenue: Number(payMap.get(day)?.s ?? 0), sales: payMap.get(day)?.n ?? 0, orders: ordMap.get(day) ?? 0 };
  });
  return {
    stats, series, failedProvisioning: failedProv,
    servicesByStatus: Object.fromEntries(svc.map((s) => [s.status, s._count])),
    attention: attention.map((p) => ({ id: p.id, orderNumber: p.order.orderNumber, amount: p.amount, riskLevel: p.riskLevel, createdAt: p.createdAt, user: { telegramId: p.user.telegramId, username: p.user.username } })),
    recentOrders: recentOrders.map((o) => ({ id: o.id, orderNumber: o.orderNumber, status: o.status, finalAmount: o.finalAmount, product: o.product.name, createdAt: o.createdAt, user: { telegramId: o.user.telegramId, username: o.user.username } })),
  };
}
