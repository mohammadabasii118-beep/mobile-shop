import { z } from "zod";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { conflict, forbidden, notFound } from "@/lib/server/errors";
import { audit, diff, pageParams, type AdminCtx } from "@/lib/server/admin/core";
import { destroyAllSessions } from "@/lib/server/auth/session";
import { toLatinDigits } from "@/lib/server/validation";

// passwordHash is never selected anywhere in this module.
const safeUser = { id: true, phone: true, email: true, firstName: true, lastName: true, displayName: true, isActive: true, phoneVerifiedAt: true, lastLoginAt: true, createdAt: true } as const;

export async function listCustomers(req: NextRequest) {
  const { take, skip, q, page, sp } = pageParams(req, 25);
  const where: Prisma.UserWhereInput = {};
  const qn = toLatinDigits(q);
  if (q) where.OR = [{ phone: { contains: qn } }, { displayName: { contains: q, mode: "insensitive" } }, { firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }];
  const role = sp.get("role");
  if (role) where.roles = { some: { role: { key: role } } };
  if (sp.get("isActive")) where.isActive = sp.get("isActive") === "true";
  const [rows, total] = await Promise.all([
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, take, skip, select: { ...safeUser, roles: { select: { role: { select: { key: true, name: true } } } }, _count: { select: { orders: true } } } }),
    db.user.count({ where }),
  ]);
  return { items: rows.map(({ roles, ...u }) => ({ ...u, roles: roles.map((r) => r.role) })), total, page, pages: Math.max(1, Math.ceil(total / take)) };
}

export async function getCustomer(id: string) {
  const u = await db.user.findUnique({
    where: { id },
    select: {
      ...safeUser, roles: { select: { role: { select: { id: true, key: true, name: true, isStaff: true } } } },
      addresses: { orderBy: { createdAt: "desc" } }, wallet: { select: { balance: true } }, loyalty: { select: { points: true } },
      wholesaleProfile: { include: { tier: { select: { id: true, key: true, name: true } } } },
      orders: { orderBy: { createdAt: "desc" }, take: 20, select: { number: true, status: true, paymentStatus: true, total: true, type: true, createdAt: true } },
    },
  });
  if (!u) throw notFound("کاربر پیدا نشد.");
  const stats = await db.order.aggregate({ where: { userId: id, paymentStatus: "PAID" }, _sum: { total: true }, _count: true });
  return { ...u, roles: u.roles.map((r) => r.role), spent: stats._sum.total ?? 0, paidOrders: stats._count };
}

const updateSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(), lastName: z.string().trim().min(1).max(60).optional(),
  displayName: z.string().trim().max(80).optional(), email: z.string().trim().toLowerCase().email().max(120).nullable().optional().or(z.literal("").transform(() => null)),
  isActive: z.boolean().optional(),
});

/** Profile + account-status edits (customer.write). Deactivating revokes every session at once. */
export async function updateCustomer(id: string, body: unknown, a: AdminCtx) {
  const d = updateSchema.parse(body);
  if (d.isActive === false && id === a.admin.id) throw conflict("نمی‌توانید حساب خودتان را غیرفعال کنید.", "self_deactivate");
  const res = await db.$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id }, select: { ...safeUser, roles: { select: { role: { select: { isStaff: true } } } } } });
    if (!u) throw notFound("کاربر پیدا نشد.");
    // Staff accounts can only be touched by someone who may manage roles.
    if (u.roles.some((r) => r.role.isStaff) && id !== a.admin.id && !a.admin.permissions.includes("role.manage")) throw forbidden("ویرایش حساب کارکنان فقط با مجوز «مدیریت نقش‌ها» ممکن است.");
    const df = diff(u, d);
    if (!df.changed) return { ok: true, revoked: false };
    await tx.user.update({ where: { id }, data: d });
    await audit(a, d.isActive === false ? "customer.deactivate" : d.isActive === true && u.isActive === false ? "customer.activate" : "customer.update", "user", id, df.old, df.next, tx);
    return { ok: true, revoked: d.isActive === false };
  });
  if (res.revoked) await destroyAllSessions(id);
  return { ok: true };
}

const rolesSchema = z.object({ roleKeys: z.array(z.string().max(40)).max(10) });
/** Role assignment (role.manage). You can only grant roles whose permissions you hold yourself (no privilege escalation). */
export async function setRoles(id: string, body: unknown, a: AdminCtx) {
  const { roleKeys } = rolesSchema.parse(body);
  const res = await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id }, include: { roles: { include: { role: true } } } });
    if (!user) throw notFound("کاربر پیدا نشد.");
    const wanted = await tx.role.findMany({ where: { key: { in: roleKeys } }, include: { permissions: { include: { permission: true } } } });
    if (wanted.length !== new Set(roleKeys).size) throw conflict("نقش نامعتبر است.");
    const oldKeys = user.roles.map((r) => r.role.key);
    const added = wanted.filter((r) => !oldKeys.includes(r.key));
    for (const r of added) {
      if (r.permissions.some((p) => !a.admin.permissions.includes(p.permission.key))) throw forbidden(`شما مجاز به اعطای نقش «${r.name}» نیستید.`);
    }
    const removed = user.roles.filter((r) => !roleKeys.includes(r.role.key));
    for (const r of removed) {
      const full = await tx.role.findUnique({ where: { id: r.roleId }, include: { permissions: { include: { permission: true } } } });
      if (full!.permissions.some((p) => !a.admin.permissions.includes(p.permission.key))) throw forbidden(`شما مجاز به حذف نقش «${r.role.name}» نیستید.`);
    }
    if (id === a.admin.id && removed.some((r) => r.role.key === "super_admin" || r.role.key === "admin")) throw conflict("نمی‌توانید نقش مدیریتی خودتان را حذف کنید.", "self_demote");
    await tx.userRole.deleteMany({ where: { userId: id } });
    if (wanted.length) await tx.userRole.createMany({ data: wanted.map((r) => ({ userId: id, roleId: r.id })) });
    await audit(a, "customer.roles", "user", id, { roles: oldKeys }, { roles: roleKeys }, tx);
    return { changed: added.length + removed.length > 0 };
  });
  void res; // permissions are read from the DB on every request, so a role change applies immediately
  return { ok: true };
}

export const listRoles = () => db.role.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, key: true, name: true, isStaff: true } });
