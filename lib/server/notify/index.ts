import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { enabledChannels, getChannel } from "@/lib/server/notify/channels";

type Tx = Prisma.TransactionClient | typeof db;

export type NotifyEvent =
  | "order_created" | "payment_approved" | "payment_rejected" | "order_status" | "order_tracking" | "order_cancelled"
  | "support_reply" | "wholesale_approved" | "wholesale_rejected" | "wholesale_changes"
  | "wallet_change" | "refund_requested" | "refund_completed" | "loyalty_change" | "review_reply" | "review_moderated";

export interface NotifyInput { title: string; body?: string | null; link?: string | null; data?: Prisma.InputJsonValue }

/**
 * Creates the in-app notification (always) and one queued delivery per enabled external channel.
 * Pass the transaction client so the notification commits together with the change that caused it.
 */
export async function notify(tx: Tx, userId: string, event: NotifyEvent, n: NotifyInput) {
  const row = await tx.notification.create({ data: { userId, type: event, event, title: n.title, body: n.body ?? null, link: n.link ?? null, data: n.data } });
  const channels = enabledChannels();
  if (channels.length) await tx.notificationDelivery.createMany({ data: channels.map((channel) => ({ notificationId: row.id, channel })) });
  return row;
}

/** Sends queued deliveries. Unconfigured channels are marked "skipped" (never silently dropped, never half-sent). */
export async function processDeliveries(limit = 50) {
  const rows = await db.notificationDelivery.findMany({ where: { status: "queued" }, orderBy: { createdAt: "asc" }, take: limit, include: { notification: { include: { user: { select: { phone: true, email: true } } } } } });
  let sent = 0, failed = 0, skipped = 0;
  for (const d of rows) {
    const ch = getChannel(d.channel);
    if (!ch || !ch.configured()) { await db.notificationDelivery.update({ where: { id: d.id }, data: { status: "skipped", error: "channel_not_configured", attempts: { increment: 1 } } }); skipped++; continue; }
    try {
      await ch.send(d.notification.user, { title: d.notification.title, body: d.notification.body, link: d.notification.link });
      await db.notificationDelivery.update({ where: { id: d.id }, data: { status: "sent", sentAt: new Date(), attempts: { increment: 1 } } }); sent++;
    } catch (e) {
      await db.notificationDelivery.update({ where: { id: d.id }, data: { status: "failed", error: String((e as Error).message).slice(0, 200), attempts: { increment: 1 } } }); failed++;
    }
  }
  return { sent, failed, skipped };
}

export const unreadCount = (userId: string) => db.notification.count({ where: { userId, readAt: null } });
