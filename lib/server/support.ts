import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { badRequest, conflict, forbidden, notFound } from "@/lib/server/errors";
import { rateLimit } from "@/lib/server/rate-limit";
import { getStorage } from "@/lib/server/storage";
import { validateReceipt } from "@/lib/server/upload";
import { notify } from "@/lib/server/notify";
import { audit, type AdminCtx } from "@/lib/server/admin/core";
import type { SessionUser } from "@/lib/server/auth/session";
import { CATEGORIES, TICKET_STATUSES } from "@/lib/support-meta";

export interface UploadedFile { name: string; type: string; size: number; buffer: Buffer }
export const MAX_FILES = 3;
export { CATEGORIES, TICKET_STATUSES } from "@/lib/support-meta";
export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export const ticketSchema = z.object({
  subject: z.string().trim().min(3, "موضوع را بنویسید.").max(120),
  message: z.string().trim().min(3, "پیام را بنویسید.").max(4000),
  category: z.enum(Object.keys(CATEGORIES) as [keyof typeof CATEGORIES, ...(keyof typeof CATEGORIES)[]]).default("general"),
  orderNumber: z.coerce.number().int().positive().optional(),
});
export const messageSchema = z.object({ message: z.string().trim().min(1, "پیام را بنویسید.").max(4000) });

/** Parses multipart form data (text fields + up to 3 files) shared by the customer and admin endpoints. */
export async function readForm(req: Request) {
  const form = await req.formData();
  const fields: Record<string, string> = {};
  const files: UploadedFile[] = [];
  for (const [k, v] of form.entries()) {
    if (typeof v === "string") fields[k] = v;
    else if (v.size > 0) files.push({ name: v.name, type: v.type, size: v.size, buffer: Buffer.from(await v.arrayBuffer()) });
  }
  if (files.length > MAX_FILES) throw badRequest(`حداکثر ${MAX_FILES} فایل مجاز است.`, "too_many_files");
  return { fields, files };
}

export async function storeFiles(scope: string, files: UploadedFile[]) {
  const stored: { storageKey: string; originalName: string; mime: string; size: number }[] = [];
  const storage = getStorage();
  try {
    for (const f of files) {
      const v = validateReceipt(f, f.buffer); // same strict rules as receipts: real image/PDF, ≤5 MB, matching extension
      const storageKey = `${scope}/${randomUUID()}.${v.ext}`;
      await storage.put(storageKey, f.buffer);
      stored.push({ storageKey, originalName: v.originalName, mime: v.mime, size: v.size });
    }
  } catch (e) {
    await Promise.all(stored.map((s) => storage.delete(s.storageKey).catch(() => {})));
    throw e;
  }
  return stored;
}
export const cleanup = (keys: string[]) => Promise.all(keys.map((k) => getStorage().delete(k).catch(() => {})));

const messageInclude = (internal: boolean) => ({
  messages: { where: internal ? {} : { isInternal: false }, orderBy: { createdAt: "asc" as const }, include: { files: { select: { id: true, originalName: true, mime: true, size: true } }, author: { select: { displayName: true, phone: true } } } },
});

/* ───────── customer side ───────── */
export const listMyTickets = (userId: string) =>
  db.supportTicket.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { id: true, number: true, subject: true, status: true, priority: true, category: true, orderId: true, createdAt: true, updatedAt: true, _count: { select: { messages: { where: { isInternal: false } } } } } });

export async function createTicket(user: SessionUser, fields: Record<string, string>, files: UploadedFile[]) {
  await rateLimit(`ticket:create:${user.id}`, 5, 3600);
  const d = ticketSchema.parse({ subject: fields.subject, message: fields.message, category: fields.category || undefined, orderNumber: fields.orderNumber || undefined });
  let orderId: string | null = null;
  if (d.orderNumber) {
    const o = await db.order.findFirst({ where: { number: d.orderNumber, userId: user.id }, select: { id: true } });
    if (!o) throw notFound("سفارش انتخاب‌شده پیدا نشد.");
    orderId = o.id;
  }
  const ticketId = randomUUID();
  const stored = await storeFiles(`support/${ticketId}`, files);
  try {
    return await db.$transaction(async (tx) => {
      const t = await tx.supportTicket.create({ data: { userId: user.id, subject: d.subject, category: d.category, orderId, messages: { create: { authorId: user.id, body: d.message } } }, include: { messages: true } });
      if (stored.length) await tx.supportAttachment.createMany({ data: stored.map((s) => ({ ...s, messageId: t.messages[0]!.id })) });
      return { id: t.id, number: t.number };
    });
  } catch (e) { await cleanup(stored.map((s) => s.storageKey)); throw e; }
}

export async function getMyTicket(user: SessionUser, number: number) {
  const t = await db.supportTicket.findFirst({ where: { number, userId: user.id }, include: messageInclude(false) });
  if (!t) throw notFound("تیکت پیدا نشد.");
  const order = t.orderId ? await db.order.findUnique({ where: { id: t.orderId }, select: { number: true } }) : null;
  const chat = t.sourceChatId ? await db.chatConversation.findFirst({ where: { id: t.sourceChatId, userId: user.id }, select: { id: true, number: true } }) : null;
  return { ...t, orderNumber: order?.number ?? null, sourceChat: chat };
}

export async function customerReply(user: SessionUser, number: number, fields: Record<string, string>, files: UploadedFile[]) {
  await rateLimit(`ticket:reply:${user.id}`, 30, 3600);
  const { message } = messageSchema.parse({ message: fields.message });
  const t = await db.supportTicket.findFirst({ where: { number, userId: user.id } });
  if (!t) throw notFound("تیکت پیدا نشد.");
  if (t.status === "closed" && Date.now() - (t.closedAt?.getTime() ?? 0) > 14 * 86400_000) throw conflict("این تیکت بسته شده است؛ تیکت جدید ثبت کنید.", "ticket_closed");
  const stored = await storeFiles(`support/${t.id}`, files);
  try {
    await db.$transaction(async (tx) => {
      const m = await tx.supportMessage.create({ data: { ticketId: t.id, authorId: user.id, body: message } });
      if (stored.length) await tx.supportAttachment.createMany({ data: stored.map((s) => ({ ...s, messageId: m.id })) });
      await tx.supportTicket.update({ where: { id: t.id }, data: { status: t.status === "in_progress" ? "in_progress" : "open", closedAt: null } });
    });
  } catch (e) { await cleanup(stored.map((s) => s.storageKey)); throw e; }
  return { ok: true };
}

export async function customerClose(user: SessionUser, number: number) {
  const t = await db.supportTicket.findFirst({ where: { number, userId: user.id }, select: { id: true } });
  if (!t) throw notFound("تیکت پیدا نشد.");
  await db.supportTicket.updateMany({ where: { id: t.id, status: { not: "closed" } }, data: { status: "closed", closedAt: new Date() } }); // closing twice is harmless
  return { ok: true };
}

/** Streams an attachment: the ticket owner (never internal-note files) or staff with support access. */
export async function openAttachment(user: SessionUser, id: string) {
  const f = await db.supportAttachment.findUnique({ where: { id }, include: { message: { include: { ticket: { select: { userId: true } } } } } });
  if (!f) throw notFound();
  const staff = user.isStaff && (user.permissions.includes("support.read") || user.permissions.includes("support.reply"));
  const owner = f.message.ticket.userId === user.id && !f.message.isInternal;
  if (!staff && !owner) throw forbidden();
  const obj = await getStorage().get(f.storageKey);
  return { ...obj, mime: f.mime, name: f.originalName };
}

/* ───────── staff side ───────── */
export async function adminListTickets(q: { status?: string | null; priority?: string | null; assignee?: string | null; category?: string | null; order?: string | null; userId?: string | null; from?: string | null; to?: string | null; search?: string; take: number; skip: number }) {
  const where: Prisma.SupportTicketWhereInput = {};
  if (q.status && (TICKET_STATUSES as readonly string[]).includes(q.status)) where.status = q.status;
  if (q.category && q.category in CATEGORIES) where.category = q.category;
  if (q.userId) where.userId = q.userId;
  if (q.order && /^\d{1,9}$/.test(q.order)) { const o = await db.order.findUnique({ where: { number: Number(q.order) }, select: { id: true } }); where.orderId = o?.id ?? "none"; }
  const day = (v: string | null | undefined, end: boolean) => { if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined; const d = new Date(`${v}T${end ? "23:59:59.999" : "00:00:00"}Z`); return Number.isNaN(d.getTime()) ? undefined : d; };
  const from = day(q.from, false), to = day(q.to, true);
  if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  if (q.priority && (PRIORITIES as readonly string[]).includes(q.priority)) where.priority = q.priority;
  if (q.assignee === "none") where.assignedToId = null; else if (q.assignee) where.assignedToId = q.assignee;
  if (q.search) { const n = Number(q.search); where.OR = [{ subject: { contains: q.search, mode: "insensitive" } }, ...(/^\d{1,9}$/.test(q.search) ? [{ number: n }] : []), { user: { phone: { contains: q.search } } }, { user: { displayName: { contains: q.search, mode: "insensitive" } } }]; }
  const [items, total, counts] = await Promise.all([
    db.supportTicket.findMany({ where, orderBy: [{ updatedAt: "desc" }], take: q.take, skip: q.skip, include: { user: { select: { displayName: true, phone: true } }, _count: { select: { messages: true } } } }),
    db.supportTicket.count({ where }),
    db.supportTicket.groupBy({ by: ["status"], _count: true }),
  ]);
  const assigneeIds = [...new Set(items.map((t) => t.assignedToId).filter((x): x is string => !!x))];
  const staff = assigneeIds.length ? await db.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, displayName: true, phone: true } }) : [];
  return { items: items.map((t) => ({ ...t, assignee: staff.find((s) => s.id === t.assignedToId) ?? null })), total, pages: Math.max(1, Math.ceil(total / q.take)), counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) };
}

export async function adminGetTicket(number: number) {
  const t = await db.supportTicket.findUnique({ where: { number }, include: { ...messageInclude(true), user: { select: { id: true, displayName: true, phone: true } }, sourceChat: { select: { id: true, number: true } } } });
  if (!t) throw notFound("تیکت پیدا نشد.");
  const order = t.orderId ? await db.order.findUnique({ where: { id: t.orderId }, select: { number: true, status: true, total: true } }) : null;
  const staff = await db.user.findMany({ where: { isActive: true, roles: { some: { role: { isStaff: true, permissions: { some: { permission: { key: { in: ["support.reply", "support.read"] } } } } } } } }, select: { id: true, displayName: true, phone: true } });
  return { ...t, order, staff };
}

export async function adminReply(number: number, fields: Record<string, string>, files: UploadedFile[], a: AdminCtx) {
  const { message } = messageSchema.parse({ message: fields.message });
  const internal = fields.internal === "true" || fields.internal === "1";
  const t = await db.supportTicket.findUnique({ where: { number } });
  if (!t) throw notFound("تیکت پیدا نشد.");
  const stored = await storeFiles(`support/${t.id}`, files);
  try {
    await db.$transaction(async (tx) => {
      const m = await tx.supportMessage.create({ data: { ticketId: t.id, authorId: a.admin.id, isStaff: true, isInternal: internal, body: message } });
      if (stored.length) await tx.supportAttachment.createMany({ data: stored.map((s) => ({ ...s, messageId: m.id })) });
      if (!internal) {
        const next = (TICKET_STATUSES as readonly string[]).includes(fields.status ?? "") && fields.status !== "open" ? (fields.status as string) : "answered";
        await tx.supportTicket.update({ where: { id: t.id }, data: { status: next, closedAt: next === "closed" ? new Date() : null, assignedToId: t.assignedToId ?? a.admin.id } });
        await notify(tx, t.userId, "support_reply", { title: `پاسخ جدید به تیکت ${t.number.toLocaleString("fa-IR", { useGrouping: false })}`, body: message.slice(0, 140), link: `/account/tickets/${t.number}`, data: { ticketNumber: t.number } });
      }
      await audit(a, internal ? "support.note" : "support.reply", "support_ticket", t.id, undefined, { number: t.number, files: stored.length }, tx);
    });
  } catch (e) { await cleanup(stored.map((s) => s.storageKey)); throw e; }
  return { ok: true };
}

export const ticketUpdateSchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assignedToId: z.string().max(40).nullable().optional(),
});
export async function adminUpdateTicket(number: number, body: unknown, a: AdminCtx) {
  const d = ticketUpdateSchema.parse(body);
  return db.$transaction(async (tx) => {
    const t = await tx.supportTicket.findUnique({ where: { number } });
    if (!t) throw notFound("تیکت پیدا نشد.");
    if (d.assignedToId) {
      const ok = await tx.user.findFirst({ where: { id: d.assignedToId, isActive: true, roles: { some: { role: { isStaff: true, permissions: { some: { permission: { key: { in: ["support.reply", "support.read"] } } } } } } } } });
      if (!ok) throw badRequest("کارمند انتخاب‌شده به پشتیبانی دسترسی ندارد.", "assignee_invalid");
    }
    const data: Prisma.SupportTicketUpdateInput = {};
    if (d.status) { data.status = d.status; data.closedAt = d.status === "closed" ? new Date() : null; }
    if (d.priority) data.priority = d.priority;
    if (d.assignedToId !== undefined) data.assignedToId = d.assignedToId;
    if (!Object.keys(data).length) throw badRequest("تغییری ارسال نشده است.");
    await tx.supportTicket.update({ where: { id: t.id }, data });
    await audit(a, "support.update", "support_ticket", t.id, { status: t.status, priority: t.priority, assignedToId: t.assignedToId }, d, tx);
    return { ok: true };
  });
}
