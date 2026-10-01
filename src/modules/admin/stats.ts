import { prisma } from '../../db/client';

export async function dashboardStats() {
  const [users, orders, revenue, pendingPayments, autoApproved, needsReview, activeVpn, expiredVpn, provisioningErrors, openTickets] = await Promise.all([
    prisma.user.count(),
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { finalAmount: true }, where: { status: { in: ['PAID', 'PROVISIONING', 'FULFILLED'] } } }),
    prisma.payment.count({ where: { status: { in: ['PENDING', 'SUBMITTED'] } } }),
    prisma.payment.count({ where: { status: 'APPROVED', autoApproved: true } }),
    prisma.payment.count({ where: { status: 'NEEDS_REVIEW' } }),
    prisma.vpnService.count({ where: { status: 'ACTIVE', provisioningStatus: 'SUCCESS' } }),
    prisma.vpnService.count({ where: { status: 'EXPIRED' } }),
    prisma.provisioningTask.count({ where: { status: 'FAILED' } }),
    prisma.ticket.count({ where: { status: { in: ['OPEN'] } } }),
  ]);
  return { users, orders, revenue: revenue._sum.finalAmount ?? 0, pendingPayments, autoApproved, needsReview, activeVpn, expiredVpn, provisioningErrors, openTickets };
}
