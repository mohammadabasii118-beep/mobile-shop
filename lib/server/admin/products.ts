import { z } from "zod";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/server/errors";
import { audit, diff, pageParams, type AdminCtx } from "@/lib/server/admin/core";
import { recordSlugChange } from "@/lib/server/redirects";
import { slug } from "@/lib/server/admin/resources";

const txt = (max: number) => z.string().trim().max(max).transform((v) => (v === "" ? null : v)).nullable().optional();
const money = z.coerce.number().int("عدد صحیح وارد کنید.").min(0).max(2_000_000_000);
const optMoney = z.union([z.null(), z.literal("").transform(() => null), money]).optional();
const imgUrl = z.string().trim().max(400).refine((v) => /^(\/(?!\/)|https:\/\/)/.test(v), "آدرس تصویر نامعتبر است.");

const variantSchema = z.object({
  id: z.string().max(40).optional(),
  sku: z.string().trim().min(1, "SKU لازم است.").max(60),
  name: z.string().trim().min(1, "نام تنوع لازم است.").max(80),
  color: txt(40), colorHex: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "کد رنگ نامعتبر است.").nullable().optional().or(z.literal("").transform(() => null)),
  retailPrice: optMoney, wholesalePrice: optMoney,
  isActive: z.boolean().optional(),
  stock: money.optional(), // initial stock, only honoured when the variant is created
});

const base = z.object({
  name: z.string().trim().min(2).max(160), slug, sku: z.string().trim().min(1).max(60),
  brandId: z.string().max(40).nullable().optional().transform((v) => v || null),
  categoryId: z.string().min(1).max(40),
  shortDescription: txt(400), description: txt(20000), badge: txt(30), isActive: z.boolean().optional(),
  retailPrice: money, retailDiscount: money.optional(),
  wholesalePrice: optMoney, wholesaleDiscount: money.optional(), minWholesaleQty: z.coerce.number().int().min(1).max(10000).optional(),
  seoTitle: txt(120), seoDescription: txt(300), canonical: txt(300),
  phoneModelIds: z.array(z.string().max(40)).max(200).optional(),
  images: z.array(z.object({ url: imgUrl, alt: txt(160) })).max(12).optional(),
  variants: z.array(variantSchema).max(60).optional(),
});

export const productCreateSchema = base.extend({ variants: z.array(variantSchema).min(1, "حداقل یک تنوع (SKU) لازم است.").max(60) });
export const productUpdateSchema = base.partial();

function checkPrices(d: { retailPrice?: number; retailDiscount?: number; wholesalePrice?: number | null; wholesaleDiscount?: number }, cur?: { retailPrice: number; retailDiscount: number; wholesalePrice: number | null; wholesaleDiscount: number }) {
  const retail = d.retailPrice ?? cur?.retailPrice ?? 0, rd = d.retailDiscount ?? cur?.retailDiscount ?? 0;
  const wp = d.wholesalePrice === undefined ? cur?.wholesalePrice ?? null : d.wholesalePrice, wd = d.wholesaleDiscount ?? cur?.wholesaleDiscount ?? 0;
  if (rd > retail) throw badRequest("تخفیف خرده نمی‌تواند بیشتر از قیمت باشد.", "validation");
  if (wp != null) {
    if (wd > wp) throw badRequest("تخفیف عمده نمی‌تواند بیشتر از قیمت عمده باشد.", "validation");
    if (wp > retail) throw badRequest("قیمت عمده نباید بیشتر از قیمت خرده باشد.", "validation");
  }
}

const detailInclude = {
  brand: { select: { id: true, name: true } }, category: { select: { id: true, name: true } },
  images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] }, phoneModels: { select: { phoneModelId: true } },
  variants: { orderBy: { sortOrder: "asc" }, include: { inventory: { select: { quantity: true, lowStockThreshold: true } } } },
} satisfies Prisma.ProductInclude;

export async function listProducts(req: NextRequest) {
  const { take, skip, q, page, sp } = pageParams(req, 25);
  const where: Prisma.ProductWhereInput = {};
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }];
  if (sp.get("categoryId")) where.categoryId = sp.get("categoryId")!;
  if (sp.get("brandId")) where.brandId = sp.get("brandId")!;
  if (sp.get("isActive")) where.isActive = sp.get("isActive") === "true";
  if (sp.get("low") === "1") where.variants = { some: { inventory: { is: { quantity: { lte: 5 } } } } };
  const [rows, total] = await Promise.all([
    db.product.findMany({ where, orderBy: { updatedAt: "desc" }, take, skip, include: { category: { select: { name: true } }, brand: { select: { name: true } }, images: { take: 1, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] }, variants: { select: { inventory: { select: { quantity: true } } } } } }),
    db.product.count({ where }),
  ]);
  const items = rows.map(({ variants, ...p }) => ({ ...p, stock: variants.reduce((s, v) => s + (v.inventory?.quantity ?? 0), 0), variantCount: variants.length }));
  return { items, total, page, pages: Math.max(1, Math.ceil(total / take)) };
}

export async function getProduct(id: string) {
  const p = await db.product.findUnique({ where: { id }, include: detailInclude });
  if (!p) throw notFound("محصول پیدا نشد.");
  const history = await db.priceHistory.findMany({ where: { productId: id }, orderBy: { createdAt: "desc" }, take: 30 });
  return { ...p, phoneModelIds: p.phoneModels.map((m) => m.phoneModelId), priceHistory: history };
}

async function syncImages(tx: Prisma.TransactionClient, productId: string, images: { url: string; alt?: string | null }[]) {
  await tx.productImage.deleteMany({ where: { productId } });
  if (images.length) await tx.productImage.createMany({ data: images.map((im, i) => ({ productId, url: im.url, alt: im.alt ?? null, isPrimary: i === 0, sortOrder: i })) });
}

export async function createProduct(body: unknown, a: AdminCtx) {
  const d = productCreateSchema.parse(body);
  checkPrices(d);
  const { phoneModelIds = [], images = [], variants, ...fields } = d;
  const id = await db.$transaction(async (tx) => {
    const p = await tx.product.create({ data: { ...fields, visualKind: "case", visualHue: 210 } });
    for (const [i, v] of variants.entries()) {
      const { stock = 0, id: _ignored, ...vf } = v; void _ignored;
      const row = await tx.productVariant.create({ data: { ...vf, productId: p.id, sortOrder: i, inventory: { create: { quantity: stock } } }, include: { inventory: true } });
      if (stock > 0) await tx.inventoryMovement.create({ data: { inventoryId: row.inventory!.id, delta: stock, balanceAfter: stock, reason: "restock", note: "موجودی اولیه", createdById: a.admin.id } });
    }
    if (phoneModelIds.length) await tx.productPhoneModel.createMany({ data: phoneModelIds.map((phoneModelId) => ({ productId: p.id, phoneModelId })) });
    await syncImages(tx, p.id, images);
    await tx.priceHistory.create({ data: { productId: p.id, type: "retail", oldPrice: 0, newPrice: p.retailPrice, adminId: a.admin.id } });
    if (p.wholesalePrice != null) await tx.priceHistory.create({ data: { productId: p.id, type: "wholesale", oldPrice: 0, newPrice: p.wholesalePrice, adminId: a.admin.id } });
    await audit(a, "product.create", "product", p.id, undefined, { name: p.name, sku: p.sku, retailPrice: p.retailPrice, wholesalePrice: p.wholesalePrice }, tx);
    return p.id;
  });
  return getProduct(id);
}

export async function updateProduct(id: string, body: unknown, a: AdminCtx) {
  const d = productUpdateSchema.parse(body);
  const { phoneModelIds, images, variants, ...fields } = d;
  await db.$transaction(async (tx) => {
    const cur = await tx.product.findUnique({ where: { id } });
    if (!cur) throw notFound("محصول پیدا نشد.");
    checkPrices(fields, cur);
    const df = diff(cur, fields);
    if (df.changed) await tx.product.update({ where: { id }, data: fields });
    if (fields.slug && fields.slug !== cur.slug) await recordSlugChange(tx, "product", cur.slug, fields.slug);

    const priceLog: [string, number, number][] = [];
    if (fields.retailPrice !== undefined && fields.retailPrice !== cur.retailPrice) priceLog.push(["retail", cur.retailPrice, fields.retailPrice]);
    if (fields.wholesalePrice !== undefined && (fields.wholesalePrice ?? 0) !== (cur.wholesalePrice ?? 0)) priceLog.push(["wholesale", cur.wholesalePrice ?? 0, fields.wholesalePrice ?? 0]);
    for (const [type, oldPrice, newPrice] of priceLog) await tx.priceHistory.create({ data: { productId: id, type, oldPrice, newPrice, adminId: a.admin.id } });

    if (phoneModelIds) {
      await tx.productPhoneModel.deleteMany({ where: { productId: id } });
      if (phoneModelIds.length) await tx.productPhoneModel.createMany({ data: phoneModelIds.map((phoneModelId) => ({ productId: id, phoneModelId })) });
    }
    if (images) await syncImages(tx, id, images);
    if (variants) {
      const existing = await tx.productVariant.findMany({ where: { productId: id }, select: { id: true } });
      const keep = new Set(variants.filter((v) => v.id).map((v) => v.id!));
      for (const ex of existing) {
        if (keep.has(ex.id)) continue;
        // Variants that appear in past orders are deactivated instead of removed, so history stays intact.
        if (await tx.orderItem.count({ where: { variantId: ex.id } })) await tx.productVariant.update({ where: { id: ex.id }, data: { isActive: false } });
        else await tx.productVariant.delete({ where: { id: ex.id } });
      }
      for (const [i, v] of variants.entries()) {
        const { id: vid, stock = 0, ...vf } = v;
        if (vid) {
          if (!existing.some((e) => e.id === vid)) throw badRequest("تنوع نامعتبر است.");
          await tx.productVariant.update({ where: { id: vid }, data: { ...vf, sortOrder: i } });
        } else {
          const row = await tx.productVariant.create({ data: { ...vf, productId: id, sortOrder: i, inventory: { create: { quantity: stock } } }, include: { inventory: true } });
          if (stock > 0) await tx.inventoryMovement.create({ data: { inventoryId: row.inventory!.id, delta: stock, balanceAfter: stock, reason: "restock", note: "موجودی اولیه", createdById: a.admin.id } });
        }
      }
      if ((await tx.productVariant.count({ where: { productId: id, isActive: true } })) === 0 && fields.isActive !== false) { /* allowed: product simply shows as out of stock */ }
    }
    const change = { ...df.next, ...(phoneModelIds ? { phoneModelIds } : {}), ...(images ? { images: images.length } : {}), ...(variants ? { variants: variants.length } : {}) };
    if (Object.keys(change).length) await audit(a, "product.update", "product", id, { ...df.old, ...(priceLog.length ? { priceHistory: priceLog } : {}) }, change, tx);
  });
  return getProduct(id);
}

export async function deleteProduct(id: string, a: AdminCtx) {
  return db.$transaction(async (tx) => {
    const p = await tx.product.findUnique({ where: { id } });
    if (!p) throw notFound("محصول پیدا نشد.");
    if (await tx.orderItem.count({ where: { productId: id } })) throw conflict("این محصول در سفارش‌ها استفاده شده است؛ به‌جای حذف آن را غیرفعال کنید.", "product_ordered");
    await tx.product.delete({ where: { id } });
    await audit(a, "product.delete", "product", id, { name: p.name, sku: p.sku }, undefined, tx);
    return { deleted: true };
  });
}
