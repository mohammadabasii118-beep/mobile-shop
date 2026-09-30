import { z } from "zod";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/server/errors";
import { audit, diff, pageParams, type AdminCtx } from "@/lib/server/admin/core";
import { recordSlugChange } from "@/lib/server/redirects";
import { slug } from "@/lib/server/admin/resources";
import { recomputePrices, type OldCosts } from "@/lib/server/price-engine/rules";

const txt = (max: number) => z.string().trim().max(max).transform((v) => (v === "" ? null : v)).nullable().optional();
const money = z.coerce.number().int("عدد صحیح وارد کنید.").min(0).max(2_000_000_000);
const optMoney = z.union([z.null(), z.literal("").transform(() => null), money]).optional();
const imgUrl = z.string().trim().max(400).refine((v) => /^(\/(?!\/)|https:\/\/)/.test(v), "آدرس تصویر نامعتبر است.");

const variantSchema = z.object({
  id: z.string().max(40).optional(),
  sku: z.string().trim().min(1, "SKU لازم است.").max(60),
  name: z.string().trim().max(80).optional(), // generated from model + colour when empty
  phoneModelId: z.string().max(40).nullable().optional().transform((v) => v || null),
  colorId: z.string().max(40).nullable().optional().transform((v) => v || null),
  costPrice: optMoney, pricingMode: z.enum(["AUTOMATIC", "MANUAL"]).optional(),
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
  retailPrice: money.optional(), retailDiscount: money.optional(), costPrice: optMoney, pricingMode: z.enum(["AUTOMATIC", "MANUAL"]).optional(),
  wholesalePrice: optMoney, wholesaleDiscount: money.optional(), minWholesaleQty: z.coerce.number().int().min(1).max(10000).optional(),
  seoTitle: txt(120), seoDescription: txt(300), canonical: txt(300),
  phoneModelIds: z.array(z.string().max(40)).max(200).optional(),
  images: z.array(z.object({ url: imgUrl, alt: txt(160) })).max(12).optional(),
  variants: z.array(variantSchema).max(60).optional(),
});

export const productCreateSchema = base.extend({ variants: z.array(variantSchema).min(1, "حداقل یک تنوع (SKU) لازم است.").max(60) })
  .superRefine((d, ctx) => { if (d.pricingMode !== "AUTOMATIC" && d.retailPrice === undefined) ctx.addIssue({ code: "custom", path: ["retailPrice"], message: "قیمت خرده لازم است." }); });
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
  variants: { orderBy: { sortOrder: "asc" }, include: { inventory: { select: { quantity: true, lowStockThreshold: true } }, phoneModel: { select: { id: true, name: true, brandId: true } }, colorRef: { select: { id: true, name: true, hex: true } } } },
} satisfies Prisma.ProductInclude;

type Caps = { cost: boolean };

/** Purchase cost is business-sensitive: only staff with pricing.read see it (the rest get null). */
function redactCost<T extends { costPrice?: number | null; variants?: { costPrice: number | null }[]; priceHistory?: { oldCost: number | null; newCost: number | null }[] }>(p: T, caps: Caps): T {
  if (caps.cost) return p;
  return { ...p, costPrice: null, variants: p.variants?.map((v) => ({ ...v, costPrice: null })), priceHistory: p.priceHistory?.map((h) => ({ ...h, oldCost: null, newCost: null })) };
}

/** Without pricing.write a caller may not set costs or switch pricing modes: those inputs are ignored, existing values stay. */
function stripPricingInput<T extends { costPrice?: unknown; pricingMode?: unknown; variants?: { costPrice?: unknown; pricingMode?: unknown }[] }>(d: T, canPrice: boolean): T {
  if (canPrice) return d;
  const { costPrice: _c, pricingMode: _m, ...rest } = d; void _c; void _m;
  return { ...rest, ...(d.variants ? { variants: d.variants.map(({ costPrice: _vc, pricingMode: _vm, ...v }) => { void _vc; void _vm; return v; }) } : {}) } as T;
}

/** Validates the variant axes and derives the display name / legacy colour fields from them. */
async function resolveAxes(tx: Prisma.TransactionClient, v: { name?: string; phoneModelId: string | null; colorId: string | null; color?: string | null; colorHex?: string | null }) {
  const [model, color] = await Promise.all([
    v.phoneModelId ? tx.phoneModel.findUnique({ where: { id: v.phoneModelId }, select: { name: true } }) : null,
    v.colorId ? tx.color.findUnique({ where: { id: v.colorId } }) : null,
  ]);
  if (v.phoneModelId && !model) throw badRequest("مدل گوشی انتخاب‌شده پیدا نشد.", "validation");
  if (v.colorId && !color) throw badRequest("رنگ انتخاب‌شده پیدا نشد.", "validation");
  const generated = [model?.name, color?.name].filter(Boolean).join(" · ");
  const name = (v.name && v.name.trim()) || generated || "پیش‌فرض";
  return { name, ...(color ? { color: color.name, colorHex: color.hex } : {}) };
}

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

export async function getProduct(id: string, caps: Caps = { cost: false }) {
  const p = await db.product.findUnique({ where: { id }, include: detailInclude });
  if (!p) throw notFound("محصول پیدا نشد.");
  const history = await db.priceHistory.findMany({ where: { productId: id }, orderBy: { createdAt: "desc" }, take: 30 });
  return redactCost({ ...p, phoneModelIds: p.phoneModels.map((m) => m.phoneModelId), priceHistory: history }, caps);
}

async function syncImages(tx: Prisma.TransactionClient, productId: string, images: { url: string; alt?: string | null }[]) {
  await tx.productImage.deleteMany({ where: { productId } });
  if (images.length) await tx.productImage.createMany({ data: images.map((im, i) => ({ productId, url: im.url, alt: im.alt ?? null, isPrimary: i === 0, sortOrder: i })) });
}

const capsOf = (a: AdminCtx): Caps => ({ cost: a.admin.permissions.includes("pricing.read") || a.admin.permissions.includes("pricing.write") });
const canPrice = (a: AdminCtx) => a.admin.permissions.includes("pricing.write");

/** A model+colour pair may exist only once per product (legacy variants without axes are exempt). */
async function assertUniqueAxes(tx: Prisma.TransactionClient, productId: string, v: { id?: string; phoneModelId: string | null; colorId: string | null }) {
  if (!v.phoneModelId && !v.colorId) return;
  const dup = await tx.productVariant.findFirst({ where: { productId, phoneModelId: v.phoneModelId, colorId: v.colorId, ...(v.id ? { NOT: { id: v.id } } : {}) }, select: { id: true } });
  if (dup) throw conflict("این ترکیب مدل گوشی و رنگ قبلاً برای این محصول تعریف شده است.", "variant_duplicate");
}

export async function createProduct(body: unknown, a: AdminCtx) {
  const d = stripPricingInput(productCreateSchema.parse(body), canPrice(a));
  if (d.pricingMode !== "AUTOMATIC") checkPrices(d);
  const { phoneModelIds = [], images = [], variants, retailPrice, ...fields } = d;
  const id = await db.$transaction(async (tx) => {
    const p = await tx.product.create({ data: { ...fields, retailPrice: retailPrice ?? 0, visualKind: "case", visualHue: 210 } });
    const seen = new Set<string>();
    for (const [i, v] of variants.entries()) {
      const { stock = 0, id: _ignored, ...vf } = v; void _ignored;
      const axes = await resolveAxes(tx, vf);
      const key = `${vf.phoneModelId}|${vf.colorId}`; if ((vf.phoneModelId || vf.colorId) && seen.has(key)) throw conflict("این ترکیب مدل گوشی و رنگ تکراری است.", "variant_duplicate"); seen.add(key);
      const row = await tx.productVariant.create({ data: { ...vf, ...axes, productId: p.id, sortOrder: i, inventory: { create: { quantity: stock } } }, include: { inventory: true } });
      if (stock > 0) await tx.inventoryMovement.create({ data: { inventoryId: row.inventory!.id, delta: stock, balanceAfter: stock, reason: "restock", note: "موجودی اولیه", createdById: a.admin.id } });
      await audit(a, "variant.create", "variant", row.id, undefined, { sku: row.sku, name: row.name, phoneModelId: row.phoneModelId, colorId: row.colorId, pricingMode: row.pricingMode }, tx);
    }
    if (phoneModelIds.length) await tx.productPhoneModel.createMany({ data: phoneModelIds.map((phoneModelId) => ({ productId: p.id, phoneModelId })) });
    await syncImages(tx, p.id, images);
    await audit(a, "product.create", "product", p.id, undefined, { name: p.name, sku: p.sku, retailPrice: p.retailPrice, wholesalePrice: p.wholesalePrice, pricingMode: p.pricingMode }, tx);
    if (p.pricingMode === "AUTOMATIC" || variants.some((v) => v.pricingMode === "AUTOMATIC")) await recomputePrices(tx, { productIds: [p.id] }, { apply: true, adminId: a.admin.id, source: "manual", reason: "ایجاد محصول" });
    const fresh = await tx.product.findUniqueOrThrow({ where: { id: p.id } });
    await tx.priceHistory.create({ data: { productId: p.id, type: "retail", oldPrice: 0, newPrice: fresh.retailPrice, adminId: a.admin.id, oldCost: null, newCost: fresh.costPrice, source: "manual", reason: "ایجاد محصول" } });
    if (p.wholesalePrice != null) await tx.priceHistory.create({ data: { productId: p.id, type: "wholesale", oldPrice: 0, newPrice: p.wholesalePrice, adminId: a.admin.id } });
    return p.id;
  });
  return getProduct(id, capsOf(a));
}

export async function updateProduct(id: string, body: unknown, a: AdminCtx) {
  const d = stripPricingInput(productUpdateSchema.parse(body), canPrice(a));
  const { phoneModelIds, images, variants, ...fields } = d;
  await db.$transaction(async (tx) => {
    const cur = await tx.product.findUnique({ where: { id } });
    if (!cur) throw notFound("محصول پیدا نشد.");
    // Costs as they were before this edit, so price history can show old → new cost.
    const oldCosts: OldCosts = { product: cur.costPrice, variants: new Map((await tx.productVariant.findMany({ where: { productId: id }, select: { id: true, costPrice: true } })).map((v) => [v.id, v.costPrice])) };
    const nextMode = fields.pricingMode ?? cur.pricingMode;
    if (nextMode !== "AUTOMATIC") checkPrices(fields, cur);
    // In AUTOMATIC mode the selling price belongs to the engine; a typed value is ignored.
    if (nextMode === "AUTOMATIC" && fields.retailPrice !== undefined) delete fields.retailPrice;
    const df = diff(cur, fields);
    if (df.changed) await tx.product.update({ where: { id }, data: fields });
    if (fields.slug && fields.slug !== cur.slug) await recordSlugChange(tx, "product", cur.slug, fields.slug);

    const priceLog: [string, number, number][] = [];
    if (fields.retailPrice !== undefined && fields.retailPrice !== cur.retailPrice) priceLog.push(["retail", cur.retailPrice, fields.retailPrice]);
    if (fields.wholesalePrice !== undefined && (fields.wholesalePrice ?? 0) !== (cur.wholesalePrice ?? 0)) priceLog.push(["wholesale", cur.wholesalePrice ?? 0, fields.wholesalePrice ?? 0]);
    for (const [type, oldPrice, newPrice] of priceLog) await tx.priceHistory.create({ data: { productId: id, type, oldPrice, newPrice, oldCost: type === "retail" ? cur.costPrice : null, newCost: type === "retail" ? (fields.costPrice === undefined ? cur.costPrice : fields.costPrice) : null, adminId: a.admin.id, source: "manual" } });

    if (phoneModelIds) {
      await tx.productPhoneModel.deleteMany({ where: { productId: id } });
      if (phoneModelIds.length) await tx.productPhoneModel.createMany({ data: phoneModelIds.map((phoneModelId) => ({ productId: id, phoneModelId })) });
    }
    if (images) await syncImages(tx, id, images);
    if (variants) {
      const existing = await tx.productVariant.findMany({ where: { productId: id } });
      const keep = new Set(variants.filter((v) => v.id).map((v) => v.id!));
      for (const ex of existing) {
        if (keep.has(ex.id)) continue;
        // Variants that appear in past orders are deactivated instead of removed, so history stays intact.
        if (await tx.orderItem.count({ where: { variantId: ex.id } })) await tx.productVariant.update({ where: { id: ex.id }, data: { isActive: false } });
        else await tx.productVariant.delete({ where: { id: ex.id } });
        await audit(a, "variant.remove", "variant", ex.id, { sku: ex.sku, name: ex.name }, undefined, tx);
      }
      for (const [i, v] of variants.entries()) {
        const { id: vid, stock = 0, ...vf } = v;
        const axes = await resolveAxes(tx, vf);
        await assertUniqueAxes(tx, id, { id: vid, phoneModelId: vf.phoneModelId, colorId: vf.colorId });
        if (vid) {
          const before = existing.find((e) => e.id === vid);
          if (!before) throw badRequest("تنوع نامعتبر است.");
          const mode = vf.pricingMode ?? before.pricingMode;
          const data = { ...vf, ...axes, sortOrder: i, ...(mode === "AUTOMATIC" ? { retailPrice: undefined } : {}) };
          await tx.productVariant.update({ where: { id: vid }, data });
          const newRetail = mode === "AUTOMATIC" ? before.retailPrice : (vf.retailPrice === undefined ? before.retailPrice : vf.retailPrice);
          const newCost = vf.costPrice === undefined ? before.costPrice : vf.costPrice;
          if (mode !== "AUTOMATIC" && (newRetail ?? null) !== (before.retailPrice ?? null)) await tx.priceHistory.create({ data: { productId: id, variantId: vid, type: "retail", oldPrice: before.retailPrice ?? cur.retailPrice, newPrice: newRetail ?? fields.retailPrice ?? cur.retailPrice, oldCost: before.costPrice, newCost, adminId: a.admin.id, source: "manual" } });
          const ch = diff(before as unknown as Record<string, unknown>, { sku: vf.sku, name: axes.name, phoneModelId: vf.phoneModelId, colorId: vf.colorId, costPrice: vf.costPrice, pricingMode: vf.pricingMode, isActive: vf.isActive, retailPrice: vf.retailPrice, wholesalePrice: vf.wholesalePrice });
          if (ch.changed) await audit(a, "variant.update", "variant", vid, ch.old, ch.next, tx);
        } else {
          const row = await tx.productVariant.create({ data: { ...vf, ...axes, productId: id, sortOrder: i, inventory: { create: { quantity: stock } } }, include: { inventory: true } });
          if (stock > 0) await tx.inventoryMovement.create({ data: { inventoryId: row.inventory!.id, delta: stock, balanceAfter: stock, reason: "restock", note: "موجودی اولیه", createdById: a.admin.id } });
          await audit(a, "variant.create", "variant", row.id, undefined, { sku: row.sku, name: row.name, phoneModelId: row.phoneModelId, colorId: row.colorId }, tx);
        }
      }
    }
    const touchesPricing = "costPrice" in fields || "pricingMode" in fields || (variants ?? []).some((v) => v.costPrice !== undefined || v.pricingMode !== undefined);
    if (touchesPricing || nextMode === "AUTOMATIC" || variants) await recomputePrices(tx, { productIds: [id] }, { apply: true, adminId: a.admin.id, source: "manual", reason: "ویرایش محصول", oldCosts });
    const change = { ...df.next, ...(phoneModelIds ? { phoneModelIds } : {}), ...(images ? { images: images.length } : {}), ...(variants ? { variants: variants.length } : {}) };
    if (Object.keys(change).length) await audit(a, "product.update", "product", id, { ...df.old, ...(priceLog.length ? { priceHistory: priceLog } : {}) }, change, tx);
  });
  return getProduct(id, capsOf(a));
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
