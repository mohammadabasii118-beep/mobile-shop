import { TicketCategory } from '@prisma/client';
import { prisma } from '../../db/client';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';
import { audit } from '../admin/audit';
import { notifyAdmins, notifyUser } from '../notifications/service';
import * as T from '../notifications/templates';

export async function createTicket(userId: string, category: TicketCategory, subject: string, text: string) {
  const t = text.trim();
  if (t.length < 3 || t.length > 3000) throw new ValidationError('متن پیام نامعتبر است');
  const ticket = await prisma.ticket.create({
    data: { userId, category, subject: subject.trim().slice(0, 100) || 'بدون موضوع', messages: { create: { text: t } } },
  });
  await notifyAdmins('ticket_new', `🎫 تیکت جدید #${ticket.id.slice(-6)}\n${ticket.subject}`, { roles: ['SUPPORT_ADMIN'], buttons: [[{ text: 'مشاهده', data: `at:v:${ticket.id}` }]] });
  return ticket;
}

export const listUserTickets = (userId: string) => prisma.ticket.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 10 });

export async function getTicketForUser(userId: string, id: string) {
  const t = await prisma.ticket.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
  if (!t) throw new NotFoundError('ticket');
  if (t.userId !== userId) throw new ForbiddenError();
  return t;
}

export async function userReply(userId: string, id: string, text: string) {
  const t = await getTicketForUser(userId, id);
  if (t.status === 'CLOSED') throw new ValidationError('تیکت بسته شده است');
  await prisma.$transaction([
    prisma.ticketMessage.create({ data: { ticketId: id, text: text.trim().slice(0, 3000) } }),
    prisma.ticket.update({ where: { id }, data: { status: 'OPEN' } }),
  ]);
  await notifyAdmins('ticket_reply', `💬 پاسخ کاربر در تیکت #${id.slice(-6)}`, { roles: ['SUPPORT_ADMIN'], buttons: [[{ text: 'مشاهده', data: `at:v:${id}` }]] });
}

export async function adminReply(adminTelegramId: bigint, id: string, text: string) {
  const t = await prisma.ticket.findUnique({ where: { id } });
  if (!t) throw new NotFoundError('ticket');
  await prisma.$transaction([
    prisma.ticketMessage.create({ data: { ticketId: id, fromAdmin: true, adminId: String(adminTelegramId), text: text.trim().slice(0, 3000) } }),
    prisma.ticket.update({ where: { id }, data: { status: 'ANSWERED' } }),
  ]);
  await audit({ actor: `admin:${adminTelegramId}`, action: 'ticket.reply', target: 'Ticket', targetId: id });
  await notifyUser(t.userId, 'ticket_answer', T.ticketAnswer(id, text.trim()), { html: true, buttons: [[{ text: '💬 پاسخ', data: `tk:r:${id}` }, { text: '🎫 تیکت‌ها', data: 'menu:support' }]] });
}

export async function closeTicket(actor: string, id: string) {
  await prisma.ticket.update({ where: { id }, data: { status: 'CLOSED' } });
  await audit({ actor, action: 'ticket.close', target: 'Ticket', targetId: id });
}
export const listOpenTickets = () => prisma.ticket.findMany({ where: { status: { in: ['OPEN', 'ANSWERED'] } }, orderBy: { updatedAt: 'desc' }, take: 15 });
