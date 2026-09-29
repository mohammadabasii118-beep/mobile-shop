import { z } from "zod";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { Prisma, WholesaleStatus } from "@/lib/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/server/errors";
import { audit, pageParams, type AdminCtx } from "@/lib/server/admin/core";
import { notify } from "@/lib/server/notify";

const STATUSES = ["PENDING", "APPROVED", "REJECTED", "CHANGES_REQUESTED"] as const;

export async function listApplications(req: NextRequest) {
  const { take, skip, q, page, sp } = pageParams(req, 25);
  const where: Prisma.WholesaleApplicationWhereInput = {};
  const st = sp.get("status");
  if (st && (STATUSES as readonly string[]).includes(st)) where.status = st as WholesaleStatus;
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { storeName: { contains: q, mode: "insensitive" } }];
  const [items, total, counts] = await Promise.all([
    db.wholesaleApplication.findMany({ where, orderBy: { createdAt: "desc" }, take, skip, include: { files: { select: { id: true, originalName: true, mime: true, size: true } } } }),
    db.wholesaleApplication.count({ where }),
    db.wholesaleApplication.groupBy({ by: ["status"], _count: true }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / take)), counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) };
}

export async function getApplication(id: string) {
  const app = await db.wholesaleApplication.findUnique({ where: { id }, include: { user: { select: { id: true, phone: true, displayName: true, wholesaleProfile: { select: { tierId: true } } } }, files: { select: { id: true, originalName: true, mime: true, size: true } } } });
  if (!app) throw notFound("درخواست پیدا نشد.");
  const { documents, ...rest } = app;
  void documents;
  return rest;
}

const approveSchema = z.object({ tierId: z.string().min(1).max(40), note: z.string().trim().max(400).optional() });
const noteSchema = z.object({ note: z.string().trim().min(3, "توضیح لازم است.").max(400) });

async function decide(id: string, next: WholesaleStatus, note: string | undefined, a: AdminCtx, extra?: (tx: Prisma.TransactionClient, app: { id: string; userId: string | null; phone: string; storeName: string }) => Promise<void>) {
  return db.$transaction(async (tx) => {
    const app = await tx.wholesaleApplication.findUnique({ where: { id } });
    if (!app) throw notFound("درخواست پیدا نشد.");
    if (app.status === "APPROVED") throw conflict("این درخواست قبلاً تأیید شده است.", "already_approved");
    await extra?.(tx, app);
    await tx.wholesaleApplication.update({ where: { id }, data: { status: next, adminNote: note ?? null, reviewedById: a.admin.id, reviewedAt: new Date() } });
    await audit(a, `wholesale.${next.toLowerCase()}`, "wholesale_application", id, { status: app.status }, { status: next, note: note ?? null, phone: app.phone }, tx);
    return { status: next };
  });
}

/** Approve: links/creates the WholesaleProfile with the chosen tier and grants the wholesale_partner role. */
export async function approveApplication(id: string, body: unknown, a: AdminCtx) {
  const { tierId, note } = approveSchema.parse(body);
  return decide(id, "APPROVED", note, a, async (tx, app) => {
    const tier = await tx.wholesaleTier.findUnique({ where: { id: tierId } });
    if (!tier || !tier.isActive) throw badRequest("سطح همکار نامعتبر یا غیرفعال است.");
    const user = app.userId ? await tx.user.findUnique({ where: { id: app.userId } }) : await tx.user.findUnique({ where: { phone: app.phone } });
    if (!user) throw conflict("کاربری با این شماره ثبت‌نام نکرده است. از متقاضی بخواهید ابتدا وارد سایت شود.", "no_user");
    const role = await tx.role.findUniqueOrThrow({ where: { key: "wholesale_partner" } });
    await tx.wholesaleProfile.upsert({ where: { userId: user.id }, update: { tierId, storeName: app.storeName }, create: { userId: user.id, tierId, storeName: app.storeName } });
    await tx.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, update: {}, create: { userId: user.id, roleId: role.id } });
    await tx.wholesaleApplication.update({ where: { id: app.id }, data: { userId: user.id } });
    await notify(tx, user.id, "wholesale_approved", { title: "درخواست همکاری شما تأیید شد", body: `سطح ${tier.name} برای شما فعال شد.`, link: "/account/wholesale" });
  });
}
export async function rejectApplication(id: string, body: unknown, a: AdminCtx) {
  const { note } = noteSchema.parse(body);
  return decide(id, "REJECTED", note, a, async (tx, app) => {
    if (app.userId) await notify(tx, app.userId, "wholesale_rejected", { title: "درخواست همکاری رد شد", body: note, link: "/account/wholesale" });
  });
}
export async function requestChanges(id: string, body: unknown, a: AdminCtx) {
  const { note } = noteSchema.parse(body);
  return decide(id, "CHANGES_REQUESTED", note, a, async (tx, app) => {
    if (app.userId) await notify(tx, app.userId, "wholesale_changes", { title: "درخواست همکاری نیاز به اصلاح دارد", body: note, link: "/account/wholesale" });
  });
}

/** Move an existing partner to another tier, or revoke wholesale access entirely. */
export async function setPartnerTier(userId: string, body: unknown, a: AdminCtx) {
  const { tierId } = z.object({ tierId: z.string().min(1).max(40) }).parse(body);
  return db.$transaction(async (tx) => {
    const p = await tx.wholesaleProfile.findUnique({ where: { userId }, include: { tier: true } });
    if (!p) throw notFound("این کاربر همکار عمده نیست.");
    const tier = await tx.wholesaleTier.findUnique({ where: { id: tierId } });
    if (!tier || !tier.isActive) throw badRequest("سطح نامعتبر یا غیرفعال است.");
    await tx.wholesaleProfile.update({ where: { userId }, data: { tierId } });
    await audit(a, "wholesale.tier", "user", userId, { tier: p.tier.key }, { tier: tier.key }, tx);
    return { ok: true };
  });
}
export async function revokePartner(userId: string, a: AdminCtx) {
  return db.$transaction(async (tx) => {
    const p = await tx.wholesaleProfile.findUnique({ where: { userId }, include: { tier: true } });
    if (!p) throw notFound("این کاربر همکار عمده نیست.");
    await tx.wholesaleProfile.delete({ where: { userId } });
    await tx.userRole.deleteMany({ where: { userId, role: { key: "wholesale_partner" } } });
    await audit(a, "wholesale.revoke", "user", userId, { tier: p.tier.key }, undefined, tx);
    return { ok: true };
  });
}
