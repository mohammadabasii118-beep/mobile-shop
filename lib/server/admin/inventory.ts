import { z } from "zod";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { conflict, notFound } from "@/lib/server/errors";
import { audit, pageParams, type AdminCtx } from "@/lib/server/admin/core";

export const adjustSchema = z.object({
  mode: z.enum(["add", "remove", "set"]),
  quantity: z.coerce.number().int("عدد صحیح وارد کنید.").min(0).max(1_000_000),
  reason: z.enum(["restock", "manual", "damage", "correction", "return"]).default("manual"),
  note: z.string().trim().max(300).optional(),
});
export const thresholdSchema = z.object({ lowStockThreshold: z.coerce.number().int().min(0).max(100000) });

export async function listInventory(req: NextRequest) {
  const { take, skip, q, page, sp } = pageParams(req, 30);
  const where: Prisma.ProductVariantWhereInput = {};
  if (q) where.OR = [{ sku: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { product: { name: { contains: q, mode: "insensitive" } } }];
  const ids = sp.get("low") === "1" ? (await db.$queryRaw<{ id: string }[]>`SELECT v."id" FROM "ProductVariant" v JOIN "Inventory" i ON i."variantId" = v."id" WHERE i."quantity" <= i."lowStockThreshold"`).map((r) => r.id) : null;
  if (ids) where.id = { in: ids };
  const [rows, total] = await Promise.all([
    db.productVariant.findMany({ where, orderBy: [{ product: { name: "asc" } }, { sortOrder: "asc" }], take, skip, include: { product: { select: { id: true, name: true, slug: true } }, inventory: true } }),
    db.productVariant.count({ where }),
  ]);
  return { items: rows.map((v) => ({ variantId: v.id, sku: v.sku, variant: v.name, product: v.product, quantity: v.inventory?.quantity ?? 0, lowStockThreshold: v.inventory?.lowStockThreshold ?? 5, low: (v.inventory?.quantity ?? 0) <= (v.inventory?.lowStockThreshold ?? 5) })), total, page, pages: Math.max(1, Math.ceil(total / take)) };
}

/** The only place admin stock changes: atomic, never negative, every change writes a movement + audit row. */
export async function adjustStock(variantId: string, body: unknown, a: AdminCtx) {
  const d = adjustSchema.parse(body);
  if ((d.mode === "remove" || d.mode === "set") && d.reason !== "damage" && !d.note) throw conflict("برای کاهش یا تنظیم موجودی، توضیح ثبت کنید.", "note_required");
  return db.$transaction(async (tx) => {
    const v = await tx.productVariant.findUnique({ where: { id: variantId }, include: { inventory: true } });
    if (!v) throw notFound("تنوع پیدا نشد.");
    const inv = v.inventory ?? (await tx.inventory.create({ data: { variantId, quantity: 0 } }));
    let delta: number;
    if (d.mode === "add") delta = d.quantity;
    else if (d.mode === "remove") delta = -d.quantity;
    else delta = d.quantity - inv.quantity;
    if (delta === 0) return { quantity: inv.quantity, delta: 0 };
    // Conditional update: a concurrent order cannot push stock below zero through this path either.
    const updated = await tx.inventory.updateMany({ where: { id: inv.id, ...(delta < 0 ? { quantity: { gte: -delta } } : {}) }, data: { quantity: { increment: delta } } });
    if (updated.count !== 1) throw conflict("موجودی فعلی برای این کاهش کافی نیست.", "insufficient_stock");
    const after = await tx.inventory.findUniqueOrThrow({ where: { id: inv.id } });
    await tx.inventoryMovement.create({ data: { inventoryId: inv.id, delta, balanceAfter: after.quantity, reason: d.reason, note: d.note ?? null, createdById: a.admin.id } });
    await audit(a, "inventory.adjust", "inventory", variantId, { quantity: inv.quantity }, { quantity: after.quantity, delta, reason: d.reason, note: d.note ?? null, sku: v.sku }, tx);
    return { quantity: after.quantity, delta };
  });
}

export async function setThreshold(variantId: string, body: unknown, a: AdminCtx) {
  const { lowStockThreshold } = thresholdSchema.parse(body);
  return db.$transaction(async (tx) => {
    const inv = await tx.inventory.findUnique({ where: { variantId } });
    if (!inv) throw notFound();
    await tx.inventory.update({ where: { id: inv.id }, data: { lowStockThreshold } });
    await audit(a, "inventory.threshold", "inventory", variantId, { lowStockThreshold: inv.lowStockThreshold }, { lowStockThreshold }, tx);
    return { lowStockThreshold };
  });
}

export async function movements(variantId: string) {
  const inv = await db.inventory.findUnique({ where: { variantId } });
  if (!inv) throw notFound();
  const rows = await db.inventoryMovement.findMany({ where: { inventoryId: inv.id }, orderBy: { createdAt: "desc" }, take: 50 });
  const users = await db.user.findMany({ where: { id: { in: rows.map((r) => r.createdById).filter((x): x is string => !!x) } }, select: { id: true, displayName: true, phone: true } });
  return rows.map((r) => ({ ...r, by: users.find((u) => u.id === r.createdById)?.displayName ?? users.find((u) => u.id === r.createdById)?.phone ?? null }));
}
