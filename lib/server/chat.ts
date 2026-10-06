import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { badRequest, conflict, forbidden, notFound } from "@/lib/server/errors";
import { rateLimit } from "@/lib/server/rate-limit";
import { getStorage } from "@/lib/server/storage";
import { notify } from "@/lib/server/notify";
import { audit, type AdminCtx } from "@/lib/server/admin/core";
import type { SessionUser } from "@/lib/server/auth/session";
import { CATEGORIES, PRIORITIES, cleanup, readForm, storeFiles, type UploadedFile } from "@/lib/server/support";

/**
 * Live chat — its own system, separate from tickets (own tables, numbers and statuses).
 * waiting = the customer is waiting for a staff answer, active = staff answered, closed.
 * Real time is done with short, cursor-based polling (no extra infrastructure): the client asks only for messages after the last one it has.
 */
export const CHAT_STATUSES = ["waiting", "active", "closed"] as const;
const REOPEN_DAYS = 7; // a customer may continue a closed chat for this long; afterwards a new chat is started
const ONLINE_MS = 120_000; // staff count as online while their console heartbeat is newer than this
const MAX_TEXT = 2000;

/** Chat endpoints accept plain JSON (text only) or multipart form data (text + up to 3 images/PDFs). */
export async function readChatBody(req: Request): Promise<{ fields: Record<string, string>; files: UploadedFile[] }> {
  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    const j = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return { fields: Object.fromEntries(Object.entries(j).map(([k, v]) => [k, typeof v === "string" ? v : v == null ? "" : String(v)])), files: [] };
  }
  return readForm(req);
}

export const chatMessageSchema = z.object({ message: z.string().trim().max(MAX_TEXT, `پیام حداکثر ${MAX_TEXT} کاراکتر باشد.`).default("") });
const preview = (text: string, files: number) => (text || (files ? "📎 فایل" : "")).slice(0, 120);

export async function supportOnline(): Promise<boolean> {
  return (await db.chatAgent.count({ where: { lastSeenAt: { gt: new Date(Date.now() - ONLINE_MS) } } })) > 0;
}
export const touchAgent = (userId: string) => db.chatAgent.upsert({ where: { userId }, update: { lastSeenAt: new Date() }, create: { userId } });

const messageSelect = { id: true, isStaff: true, body: true, createdAt: true, readAt: true, files: { select: { id: true, originalName: true, mime: true, size: true } } } as const;

/** Messages strictly after the message with id `after` (stable order: createdAt, id). Without a cursor: the latest 100. */
async function messagesAfter(conversationId: string, after?: string | null) {
  if (after) {
    const ref = await db.chatMessage.findFirst({ where: { id: after, conversationId }, select: { createdAt: true, id: true } });
    if (ref) return db.chatMessage.findMany({ where: { conversationId, OR: [{ createdAt: { gt: ref.createdAt } }, { createdAt: ref.createdAt, id: { gt: ref.id } }] }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 200, select: messageSelect });
  }
  return (await db.chatMessage.findMany({ where: { conversationId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100, select: messageSelect })).reverse();
}

async function orderNumbers(ids: (string | null)[]) {
  const clean = [...new Set(ids.filter((x): x is string => !!x))];
  const rows = clean.length ? await db.order.findMany({ where: { id: { in: clean } }, select: { id: true, number: true } }) : [];
  return new Map(rows.map((o) => [o.id, o.number]));
}

/* ───────── customer side ───────── */
export async function listMyChats(user: SessionUser) {
  const [rows, online] = await Promise.all([
    db.chatConversation.findMany({ where: { userId: user.id }, orderBy: { lastMessageAt: "desc" }, take: 50 }),
    supportOnline(),
  ]);
  const orders = await orderNumbers(rows.map((c) => c.orderId));
  return {
    online,
    unread: rows.reduce((n, c) => n + c.unreadUser, 0),
    items: rows.map((c) => ({ id: c.id, number: c.number, status: c.status, unread: c.unreadUser, lastMessageAt: c.lastMessageAt, preview: c.lastMessagePreview, orderNumber: c.orderId ? orders.get(c.orderId) ?? null : null, createdAt: c.createdAt })),
  };
}

export async function startChat(user: SessionUser, fields: Record<string, string>, files: UploadedFile[]) {
  await rateLimit(`chat:start:${user.id}`, 10, 3600);
  const { message } = chatMessageSchema.parse({ message: fields.message });
  if (!message && !files.length) throw badRequest("پیام را بنویسید.");
  const open = await db.chatConversation.findFirst({ where: { userId: user.id, status: { not: "closed" } }, select: { id: true, number: true } });
  if (open) throw conflict("یک گفتگوی باز دارید؛ همان را ادامه دهید یا ابتدا آن را ببندید.", "chat_open", { id: open.id, number: open.number });
  let orderId: string | null = null;
  const orderNumber = Number(fields.orderNumber);
  if (fields.orderNumber && Number.isInteger(orderNumber) && orderNumber > 0) {
    const o = await db.order.findFirst({ where: { number: orderNumber, userId: user.id }, select: { id: true } });
    if (!o) throw notFound("سفارش انتخاب‌شده پیدا نشد.");
    orderId = o.id;
  }
  const id = randomUUID();
  const stored = await storeFiles(`chat/${id}`, files);
  try {
    return await db.$transaction(async (tx) => {
      const c = await tx.chatConversation.create({ data: { id, userId: user.id, orderId, status: "waiting", unreadStaff: 1, lastMessagePreview: preview(message, stored.length) } });
      const m = await tx.chatMessage.create({ data: { conversationId: c.id, authorId: user.id, body: message } });
      if (stored.length) await tx.chatAttachment.createMany({ data: stored.map((s) => ({ ...s, messageId: m.id })) });
      return { id: c.id, number: c.number };
    });
  } catch (e) { await cleanup(stored.map((s) => s.storageKey)); throw e; }
}

export async function getMyChat(user: SessionUser, id: string, after?: string | null) {
  const c = await db.chatConversation.findFirst({ where: { id, userId: user.id } });
  if (!c) throw notFound("گفتگو پیدا نشد.");
  const [messages, online] = await Promise.all([messagesAfter(id, after), supportOnline()]);
  // Fetching counts as reading: staff messages become "read" and the unread counter resets.
  if (c.unreadUser > 0 || messages.some((m) => m.isStaff && !m.readAt)) {
    await db.$transaction([
      db.chatMessage.updateMany({ where: { conversationId: id, isStaff: true, readAt: null }, data: { readAt: new Date() } }),
      db.chatConversation.update({ where: { id }, data: { unreadUser: 0 } }),
    ]);
  }
  const ownRead = (await db.chatMessage.findMany({ where: { conversationId: id, isStaff: false, readAt: { not: null } }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true } })).map((m) => m.id);
  const orders = await orderNumbers([c.orderId]);
  const tickets = await db.supportTicket.findMany({ where: { sourceChatId: id, userId: user.id }, select: { number: true } });
  return { conversation: { id: c.id, number: c.number, status: c.status, orderNumber: c.orderId ? orders.get(c.orderId) ?? null : null, closedAt: c.closedAt, closedBy: c.closedBy, tickets: tickets.map((t) => t.number) }, messages, ownRead, online };
}

export async function sendMyMessage(user: SessionUser, id: string, fields: Record<string, string>, files: UploadedFile[]) {
  await rateLimit(`chat:msg:${user.id}`, 60, 300);
  const { message } = chatMessageSchema.parse({ message: fields.message });
  if (!message && !files.length) throw badRequest("پیام را بنویسید.");
  const c = await db.chatConversation.findFirst({ where: { id, userId: user.id } });
  if (!c) throw notFound("گفتگو پیدا نشد.");
  if (c.status === "closed" && Date.now() - (c.closedAt?.getTime() ?? 0) > REOPEN_DAYS * 86400_000) throw conflict("این گفتگو بسته شده است؛ گفتگوی جدید شروع کنید.", "chat_closed");
  if (c.status === "closed" && (await db.chatConversation.count({ where: { userId: user.id, status: { not: "closed" } } }))) throw conflict("یک گفتگوی باز دیگر دارید.", "chat_open");
  const stored = await storeFiles(`chat/${id}`, files);
  try {
    const m = await db.$transaction(async (tx) => {
      const row = await tx.chatMessage.create({ data: { conversationId: id, authorId: user.id, body: message }, select: messageSelect });
      if (stored.length) await tx.chatAttachment.createMany({ data: stored.map((s) => ({ ...s, messageId: row.id })) });
      await tx.chatConversation.update({ where: { id }, data: { status: "waiting", closedAt: null, closedBy: null, unreadStaff: { increment: 1 }, lastMessageAt: new Date(), lastMessagePreview: preview(message, stored.length) } });
      return row;
    });
    return { id: m.id, createdAt: m.createdAt };
  } catch (e) { await cleanup(stored.map((s) => s.storageKey)); throw e; }
}

export async function closeMyChat(user: SessionUser, id: string) {
  const c = await db.chatConversation.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!c) throw notFound("گفتگو پیدا نشد.");
  await db.chatConversation.updateMany({ where: { id, status: { not: "closed" } }, data: { status: "closed", closedAt: new Date(), closedBy: "user" } });
  return { ok: true };
}

/** Streams a chat attachment: the conversation's customer, or staff with chat access. */
export async function openChatAttachment(user: SessionUser, id: string) {
  const f = await db.chatAttachment.findUnique({ where: { id }, include: { message: { include: { conversation: { select: { userId: true } } } } } });
  if (!f) throw notFound();
  const staff = user.isStaff && (user.permissions.includes("chat.read") || user.permissions.includes("chat.reply"));
  if (!staff && f.message.conversation.userId !== user.id) throw forbidden();
  const obj = await getStorage().get(f.storageKey);
  return { ...obj, mime: f.mime, name: f.originalName };
}

/* ───────── staff side ───────── */
export async function adminListChats(a: AdminCtx, q: { tab?: string | null; search?: string; take: number; skip: number }) {
  await touchAgent(a.admin.id);
  const where: Prisma.ChatConversationWhereInput = {};
  const tab = q.tab ?? "open";
  if (tab === "waiting" || tab === "active" || tab === "closed") where.status = tab;
  else if (tab === "unread") { where.unreadStaff = { gt: 0 }; where.status = { not: "closed" }; }
  else where.status = { not: "closed" };
  if (q.search) {
    const n = Number(q.search);
    where.OR = [...(/^\d{1,9}$/.test(q.search) ? [{ number: n }] : []), { user: { phone: { contains: q.search } } }, { user: { displayName: { contains: q.search, mode: "insensitive" as const } } }, { user: { email: { contains: q.search, mode: "insensitive" as const } } }];
  }
  const [items, total, groups, unread] = await Promise.all([
    db.chatConversation.findMany({ where, orderBy: { lastMessageAt: "desc" }, take: q.take, skip: q.skip, include: { user: { select: { displayName: true, phone: true } } } }),
    db.chatConversation.count({ where }),
    db.chatConversation.groupBy({ by: ["status"], _count: true }),
    db.chatConversation.count({ where: { unreadStaff: { gt: 0 }, status: { not: "closed" } } }),
  ]);
  const orders = await orderNumbers(items.map((c) => c.orderId));
  const counts: Record<string, number> = Object.fromEntries(groups.map((g) => [g.status, g._count]));
  return {
    items: items.map((c) => ({ id: c.id, number: c.number, status: c.status, unread: c.unreadStaff, lastMessageAt: c.lastMessageAt, preview: c.lastMessagePreview, user: c.user, orderNumber: c.orderId ? orders.get(c.orderId) ?? null : null })),
    total, pages: Math.max(1, Math.ceil(total / q.take)),
    counts: { waiting: counts.waiting ?? 0, active: counts.active ?? 0, closed: counts.closed ?? 0, unread, open: (counts.waiting ?? 0) + (counts.active ?? 0) },
  };
}

export async function adminGetChat(a: AdminCtx, id: string, after?: string | null) {
  await touchAgent(a.admin.id);
  const c = await db.chatConversation.findUnique({ where: { id }, include: { user: { select: { id: true, displayName: true, phone: true, email: true } }, tickets: { select: { number: true, subject: true, status: true } } } });
  if (!c) throw notFound("گفتگو پیدا نشد.");
  const messages = await messagesAfter(id, after);
  if (c.unreadStaff > 0 || messages.some((m) => !m.isStaff && !m.readAt)) {
    await db.$transaction([
      db.chatMessage.updateMany({ where: { conversationId: id, isStaff: false, readAt: null }, data: { readAt: new Date() } }),
      db.chatConversation.update({ where: { id }, data: { unreadStaff: 0 } }),
    ]);
  }
  const orders = await db.order.findMany({ where: { userId: c.userId }, orderBy: { createdAt: "desc" }, take: 6, select: { number: true, status: true, total: true, createdAt: true } });
  const linked = c.orderId ? await db.order.findUnique({ where: { id: c.orderId }, select: { number: true, status: true, total: true } }) : null;
  const { tickets, ...conv } = c;
  return { conversation: { ...conv, unreadStaff: 0 }, tickets, messages, orders, linkedOrder: linked, online: true };
}

export async function adminSendChat(a: AdminCtx, id: string, fields: Record<string, string>, files: UploadedFile[]) {
  const { message } = chatMessageSchema.parse({ message: fields.message });
  if (!message && !files.length) throw badRequest("پیام را بنویسید.");
  await touchAgent(a.admin.id);
  const c = await db.chatConversation.findUnique({ where: { id } });
  if (!c) throw notFound("گفتگو پیدا نشد.");
  if (c.status === "closed") throw conflict("گفتگو بسته است؛ ابتدا آن را دوباره باز کنید.", "chat_closed");
  const stored = await storeFiles(`chat/${id}`, files);
  try {
    const m = await db.$transaction(async (tx) => {
      const row = await tx.chatMessage.create({ data: { conversationId: id, authorId: a.admin.id, isStaff: true, body: message }, select: messageSelect });
      if (stored.length) await tx.chatAttachment.createMany({ data: stored.map((s) => ({ ...s, messageId: row.id })) });
      await tx.chatConversation.update({ where: { id }, data: { status: "active", assignedToId: c.assignedToId ?? a.admin.id, unreadUser: { increment: 1 }, lastMessageAt: new Date(), lastMessagePreview: preview(message, stored.length) } });
      // One unread "new chat message" notification per conversation at a time (no spam while the customer is away).
      const link = `/account/chat/${id}`;
      if (!(await tx.notification.count({ where: { userId: c.userId, event: "chat_message", link, readAt: null } }))) await notify(tx, c.userId, "chat_message", { title: "پیام جدید در چت آنلاین", body: preview(message, stored.length), link });
      return row;
    });
    return { id: m.id, createdAt: m.createdAt };
  } catch (e) { await cleanup(stored.map((s) => s.storageKey)); throw e; }
}

export async function adminCloseChat(a: AdminCtx, id: string) {
  const c = await db.chatConversation.findUnique({ where: { id }, select: { status: true } });
  if (!c) throw notFound("گفتگو پیدا نشد.");
  await db.$transaction(async (tx) => {
    await tx.chatConversation.updateMany({ where: { id, status: { not: "closed" } }, data: { status: "closed", closedAt: new Date(), closedBy: "staff", unreadStaff: 0 } });
    await audit(a, "chat.close", "chat", id, { status: c.status }, { status: "closed" }, tx);
  });
  return { ok: true };
}

export async function adminReopenChat(a: AdminCtx, id: string) {
  const c = await db.chatConversation.findUnique({ where: { id }, select: { status: true, userId: true } });
  if (!c) throw notFound("گفتگو پیدا نشد.");
  if (c.status !== "closed") return { ok: true };
  if (await db.chatConversation.count({ where: { userId: c.userId, status: { not: "closed" }, id: { not: id } } })) throw conflict("این کاربر گفتگوی باز دیگری دارد.", "chat_open");
  await db.$transaction(async (tx) => {
    await tx.chatConversation.update({ where: { id }, data: { status: "active", closedAt: null, closedBy: null } });
    await audit(a, "chat.reopen", "chat", id, { status: "closed" }, { status: "active" }, tx);
  });
  return { ok: true };
}

export const ticketFromChatSchema = z.object({
  subject: z.string().trim().max(120).optional().transform((v) => (v && v.length >= 3 ? v : undefined)),
  category: z.enum(Object.keys(CATEGORIES) as [keyof typeof CATEGORIES, ...(keyof typeof CATEGORIES)[]]).optional(),
  priority: z.enum(PRIORITIES).optional(),
});
/**
 * Creates a REAL, independent ticket (own number, own messages) from a chat. The chat is not changed or moved: the ticket only keeps a reference
 * (`sourceChatId`) and starts with the conversation as context.
 */
export async function adminTicketFromChat(a: AdminCtx, id: string, body: unknown) {
  if (!a.admin.permissions.includes("support.reply")) throw forbidden("برای ساخت تیکت دسترسی «پاسخ به پشتیبانی» لازم است.");
  const d = ticketFromChatSchema.parse(body);
  const c = await db.chatConversation.findUnique({ where: { id }, include: { messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 30 } } });
  if (!c) throw notFound("گفتگو پیدا نشد.");
  const lines = [...c.messages].reverse().map((m) => `${new Date(m.createdAt).toLocaleString("fa-IR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })} ${m.isStaff ? "پشتیبانی" : "شما"}: ${m.body || "(فایل)"}`);
  let text = `این تیکت از گفتگوی آنلاین شماره ${c.number.toLocaleString("fa-IR", { useGrouping: false })} ثبت شد. خلاصهٔ گفتگو:\n\n${lines.join("\n")}`;
  if (text.length > 3900) text = text.slice(0, 3890) + "…";
  const t = await db.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.create({
      data: { userId: c.userId, sourceChatId: c.id, orderId: c.orderId, category: d.category ?? (c.orderId ? "order" : "general"), priority: d.priority ?? "normal", subject: d.subject ?? `پیگیری گفتگوی آنلاین ${c.number.toLocaleString("fa-IR", { useGrouping: false })}`, assignedToId: a.admin.id, status: "in_progress", messages: { create: { authorId: a.admin.id, isStaff: true, body: text } } },
      select: { id: true, number: true },
    });
    await notify(tx, c.userId, "support_reply", { title: `تیکت ${ticket.number.toLocaleString("fa-IR", { useGrouping: false })} از گفتگوی آنلاین شما ثبت شد`, body: "پیگیری رسمی شما در بخش تیکت‌ها قابل مشاهده است.", link: `/account/tickets/${ticket.number}` });
    await audit(a, "chat.ticket", "chat", id, undefined, { ticket: ticket.number }, tx);
    return ticket;
  });
  return { number: t.number };
}
