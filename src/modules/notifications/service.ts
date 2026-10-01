import { Prisma } from '@prisma/client';
import { prisma } from '../../db/client';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

export interface Button { text: string; data?: string; url?: string }
export interface OutMessage { chatId: bigint; text: string; buttons?: Button[][]; html?: boolean }
export type Sender = (msg: OutMessage) => Promise<void>;

let sender: Sender | undefined;
export const setSender = (s: Sender | undefined) => { sender = s; };

export interface NotifyInput {
  chatId: bigint;
  userId?: string;
  type: string;
  text: string;
  buttons?: Button[][];
  dedupeKey?: string;
  audience?: 'USER' | 'ADMIN';
  html?: boolean; // text is Telegram HTML (all dynamic parts already escaped)
}

/** Persist then try to deliver; undelivered rows are retried by flushPending(). */
export async function notify(input: NotifyInput) {
  try {
    const n = await prisma.notification.create({
      data: {
        audience: input.audience ?? 'USER',
        userId: input.userId,
        chatId: input.chatId,
        type: input.type,
        text: input.text,
        meta: input.buttons || input.html ? ({ buttons: input.buttons, html: input.html } as unknown as Prisma.InputJsonValue) : undefined,
        dedupeKey: input.dedupeKey,
      },
    });
    await deliver(n.id);
    return n.id;
  } catch (e: any) {
    if (e?.code === 'P2002') return null; // deduped
    throw e;
  }
}

async function deliver(id: string) {
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || n.status === 'SENT') return;
  if (!sender) return;
  try {
    const meta = n.meta as any;
    await sender({ chatId: n.chatId, text: n.text, buttons: meta?.buttons as Button[][] | undefined, html: !!meta?.html });
    await prisma.notification.update({ where: { id }, data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 } } });
  } catch (e: any) {
    logger.warn({ id, err: String(e?.message) }, 'notification delivery failed');
    await prisma.notification.update({
      where: { id },
      data: { attempts: { increment: 1 }, lastError: String(e?.message).slice(0, 300), status: n.attempts + 1 >= 5 ? 'FAILED' : 'PENDING' },
    });
  }
}

export async function flushPending(limit = 50) {
  const rows = await prisma.notification.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: limit });
  for (const r of rows) await deliver(r.id);
  return rows.length;
}

export async function adminChatIds(roles?: string[]): Promise<bigint[]> {
  const ids = new Set<bigint>();
  if (env().ADMIN_TELEGRAM_ID) ids.add(BigInt(env().ADMIN_TELEGRAM_ID!));
  const admins = await prisma.admin.findMany({
    where: { isActive: true, ...(roles ? { role: { in: roles as any } } : {}) },
  });
  admins.forEach((a) => ids.add(a.telegramId));
  return [...ids];
}

export async function notifyAdmins(type: string, text: string, opts: { roles?: string[]; buttons?: Button[][]; dedupeKey?: string } = {}) {
  const roles = opts.roles ? [...opts.roles, 'SUPER_ADMIN'] : undefined;
  for (const chatId of await adminChatIds(roles)) {
    await notify({
      chatId, type, text, buttons: opts.buttons, audience: 'ADMIN',
      dedupeKey: opts.dedupeKey ? `${opts.dedupeKey}:${chatId}` : undefined,
    });
  }
}

export async function notifyUser(userId: string, type: string, text: string, opts: { buttons?: Button[][]; dedupeKey?: string; html?: boolean } = {}) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return;
  return notify({ chatId: u.telegramId, userId, type, text, ...opts });
}
