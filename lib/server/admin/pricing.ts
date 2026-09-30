import { z } from "zod";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/server/errors";
import { audit, pageParams, type AdminCtx, type Db } from "@/lib/server/admin/core";
import { loadRuleIndex, recomputePrices, resolveRule, ruleLabel, type PriceChange } from "@/lib/server/price-engine/rules";
import { loadActiveDiscounts, resolveUnitDiscount } from "@/lib/server/price-engine/discounts";
import { getWholesalePolicy, wholesaleProblem } from "@/lib/server/price-engine/wholesale";
import { lineCtx } from "@/lib/server/price-engine/line";

/* ───────── "preview → confirm" without duplicating any logic: run the real operation, then roll the transaction back ───────── */
class PreviewAbort<T> extends Error { constructor(readonly result: T) { super("preview"); } }
async function previewable<T>(preview: boolean, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<{ preview: boolean; result: T }> {
  try {
    const result = await db.$transaction(async (tx) => { const out = await fn(tx); if (preview) throw new PreviewAbort(out); return out; }, { timeout: 60_000, maxWait: 10_000 });
    return { preview: false, result };
  } catch (e) {
    if (e instanceof PreviewAbort) return { preview: true, result: e.result as T };
    throw e;
  }
}

const money = z.coerce.number().int("عدد صحیح وارد کنید.").min(0).max(2_000_000_000);
const humanMargin = (type: "PERCENT" | "FIXED", v: number) => (type === "PERCENT" ? Math.round(v * 100) : Math.round(v));
const marginHuman = (type: string, v: number) => (type === "PERCENT" ? v / 100 : v);

/* ───────────────────────── pricing rules ───────────────────────── */
export const ruleSchema = z.object({
  scope: z.enum(["GLOBAL", "CATEGORY", "PRODUCT", "VARIANT"]),
  targetId: z.string().trim().max(40).default(""),
  marginType: z.enum(["PERCENT", "FIXED"]),
  marginValue: z.coerce.number().min(0, "سود نمی‌تواند منفی باشد.").max(2_000_000_000),
  roundTo: z.coerce.number().int().min(0).max(10_000_000).default(0),
  note: z.string().trim().max(200).optional(),
  isActive: z.boolean().default(true),
  preview: z.boolean().default(false),
  reason: z.string().trim().max(300).optional(),
});

async function assertTarget(tx: Db, scope: string, targetId: string) {
  if (scope === "GLOBAL") { if (targetId) throw badRequest("قانون سراسری هدف ندارد.", "validation"); return; }
  if (!targetId) throw badRequest("هدف قانون را انتخاب کنید.", "validation");
  const n = scope === "CATEGORY" ? await tx.category.count({ where: { id: targetId } }) : scope === "PRODUCT" ? await tx.product.count({ where: { id: targetId } }) : await tx.productVariant.count({ where: { id: targetId } });
  if (!n) throw notFound("هدف انتخاب‌شده پیدا نشد.");
}

export async function listRules() {
  const rows = await db.pricingRule.findMany({ orderBy: [{ scope: "asc" }, { createdAt: "asc" }] });
  const [cats, prods, vars] = await Promise.all([
    db.category.findMany({ where: { id: { in: rows.filter((r) => r.scope === "CATEGORY").map((r) => r.targetId) } }, select: { id: true, name: true } }),
    db.product.findMany({ where: { id: { in: rows.filter((r) => r.scope === "PRODUCT").map((r) => r.targetId) } }, select: { id: true, name: true } }),
    db.productVariant.findMany({ where: { id: { in: rows.filter((r) => r.scope === "VARIANT").map((r) => r.targetId) } }, select: { id: true, sku: true, product: { select: { name: true } } } }),
  ]);
  return rows.map((r) => ({
    ...r, marginHuman: marginHuman(r.marginType, r.marginValue),
    targetLabel: r.scope === "GLOBAL" ? "همهٔ محصولات" : r.scope === "CATEGORY" ? cats.find((c) => c.id === r.targetId)?.name : r.scope === "PRODUCT" ? prods.find((p) => p.id === r.targetId)?.name : (() => { const v = vars.find((x) => x.id === r.targetId); return v ? `${v.product.name} (${v.sku})` : undefined; })(),
  }));
}

/** Creates or updates the rule for (scope, target) and reprices everything automatic. `preview: true` shows the effect and changes nothing. */
export async function saveRule(body: unknown, a: AdminCtx) {
  const d = ruleSchema.parse(body);
  const marginValue = humanMargin(d.marginType, d.marginValue);
  if (d.marginType === "PERCENT" && marginValue > 1_000_000) throw badRequest("درصد سود بیش از حد بزرگ است.", "validation");
  return previewable(d.preview, async (tx) => {
    await assertTarget(tx, d.scope, d.targetId);
    const oldIdx = await loadRuleIndex(tx);
    const cur = await tx.pricingRule.findUnique({ where: { scope_targetId: { scope: d.scope, targetId: d.targetId } } });
    const rule = cur
      ? await tx.pricingRule.update({ where: { id: cur.id }, data: { marginType: d.marginType, marginValue, roundTo: d.roundTo, note: d.note ?? null, isActive: d.isActive } })
      : await tx.pricingRule.create({ data: { scope: d.scope, targetId: d.targetId, marginType: d.marginType, marginValue, roundTo: d.roundTo, note: d.note ?? null, isActive: d.isActive } });
    await audit(a, cur ? "pricing.rule.update" : "pricing.rule.create", "pricing_rule", rule.id, cur ?? undefined, rule, tx);
    const res = await recomputePrices(tx, { all: true }, { apply: true, adminId: a.admin.id, source: "rule", reason: d.reason ?? `قانون ${ruleLabel(rule)}`, oldIdx, wholesale: { policy: await getWholesalePolicy(tx), onConflict: "skip" } });
    if (res.changes.length) await audit(a, "pricing.recompute", "pricing_rule", rule.id, undefined, { changed: res.changes.length, skipped: res.skipped.length }, tx);
    return { rule, ...summarise(res) };
  });
}

export async function deleteRule(id: string, body: unknown, a: AdminCtx) {
  const { preview, reason } = z.object({ preview: z.boolean().default(false), reason: z.string().trim().max(300).optional() }).parse(body ?? {});
  return previewable(preview, async (tx) => {
    const cur = await tx.pricingRule.findUnique({ where: { id } });
    if (!cur) throw notFound("قانون پیدا نشد.");
    const oldIdx = await loadRuleIndex(tx);
    await tx.pricingRule.delete({ where: { id } });
    await audit(a, "pricing.rule.delete", "pricing_rule", id, cur, undefined, tx);
    const res = await recomputePrices(tx, { all: true }, { apply: true, adminId: a.admin.id, source: "rule", reason: reason ?? "حذف قانون", oldIdx, wholesale: { policy: await getWholesalePolicy(tx), onConflict: "skip" } });
    return { rule: cur, ...summarise(res) };
  });
}

const summarise = (res: { changes: PriceChange[]; skipped: { productId: string; variantId: string | null; sku: string; reason: string; code: string }[] }) => ({
  changedCount: res.changes.length, skippedCount: res.skipped.length, wholesaleConflictCount: res.skipped.filter((x) => x.code === "wholesale").length,
  changes: res.changes.slice(0, 200), skipped: [...res.skipped].sort((a, b) => Number(b.code === "wholesale") - Number(a.code === "wholesale")).slice(0, 100), // conflicts first
});

/* ───────────────────────── pricing table ───────────────────────── */
const SORTS: Record<string, Prisma.ProductVariantOrderByWithRelationInput> = {
  name: { product: { name: "asc" } }, sku: { sku: "asc" }, price: { retailPrice: "asc" }, cost: { costPrice: "asc" }, stock: { inventory: { quantity: "asc" } }, updated: { product: { updatedAt: "desc" } },
};

export async function listPricing(req: NextRequest) {
  const { take, skip, q, page, sp } = pageParams(req, 30);
  const where: Prisma.ProductVariantWhereInput = {};
  const and: Prisma.ProductVariantWhereInput[] = [];
  if (q) and.push({ OR: [{ sku: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { product: { name: { contains: q, mode: "insensitive" } } }, { product: { sku: { contains: q, mode: "insensitive" } } }] });
  if (sp.get("categoryId")) {
    const cats = await db.category.findMany({ where: { OR: [{ id: sp.get("categoryId")! }, { parentId: sp.get("categoryId")! }] }, select: { id: true } });
    and.push({ product: { categoryId: { in: cats.map((c) => c.id) } } });
  }
  if (sp.get("productBrandId")) and.push({ product: { brandId: sp.get("productBrandId")! } });
  if (sp.get("brandId")) and.push({ phoneModel: { brandId: sp.get("brandId")! } });
  if (sp.get("modelId")) and.push({ phoneModelId: sp.get("modelId")! });
  if (sp.get("colorId")) and.push({ colorId: sp.get("colorId")! });
  if (sp.get("mode") === "AUTOMATIC" || sp.get("mode") === "MANUAL") and.push({ pricingMode: sp.get("mode") as "AUTOMATIC" | "MANUAL" });
  if (sp.get("active") === "true" || sp.get("active") === "false") and.push({ isActive: sp.get("active") === "true" });
  if (sp.get("stock") === "out") and.push({ inventory: { is: { quantity: 0 } } });
  if (sp.get("stock") === "low") and.push({ inventory: { is: { quantity: { gt: 0, lte: 5 } } } });
  if (and.length) where.AND = and;
  const sortKey = sp.get("sort") ?? "name";
  const dir = sp.get("dir") === "desc" ? "desc" : "asc";
  const base = SORTS[sortKey] ?? SORTS.name!;
  const orderBy = [Object.fromEntries(Object.entries(base).map(([k, v]) => [k, typeof v === "string" ? dir : Object.fromEntries(Object.entries(v as object).map(([k2]) => [k2, dir]))])) as Prisma.ProductVariantOrderByWithRelationInput, { id: "asc" as const }];
  const policy = await getWholesalePolicy();
  const [rows, total, discounts, idx] = await Promise.all([
    db.productVariant.findMany({ where, orderBy, take, skip, include: { inventory: true, colorRef: true, phoneModel: { include: { brand: { select: { name: true } } } }, product: { include: { category: { select: { id: true, name: true, parentId: true } } } } } }),
    db.productVariant.count({ where }),
    loadActiveDiscounts(),
    loadRuleIndex(db),
  ]);
  const items = rows.map((v) => {
    const p = v.product;
    const price = v.retailPrice ?? p.retailPrice;
    const cost = v.costPrice ?? p.costPrice;
    const rule = v.pricingMode === "AUTOMATIC" ? resolveRule(idx, { variantId: v.id, productId: p.id, categoryId: p.categoryId }) : null;
    const disc = resolveUnitDiscount(discounts, lineCtx(p, v), price, p.retailDiscount);
    const qty = v.inventory?.quantity ?? 0;
    return {
      variantId: v.id, productId: p.id, product: p.name, variant: v.name, sku: v.sku, category: p.category.name,
      brand: v.phoneModel?.brand.name ?? null, model: v.phoneModel?.name ?? null, color: v.colorRef?.name ?? v.color ?? null,
      mode: v.pricingMode, cost, marginPercent: cost && cost > 0 ? Math.round(((price - cost) / cost) * 1000) / 10 : null,
      rule: rule ? { label: ruleLabel(rule), scope: rule.scope, marginType: rule.marginType, margin: marginHuman(rule.marginType, rule.marginValue), roundTo: rule.roundTo } : null,
      wholesale: v.wholesalePrice ?? p.wholesalePrice, wholesaleProblem: wholesaleProblem(price, v.wholesalePrice ?? p.wholesalePrice, policy),
      calculatedPrice: price, discount: disc.amount, discountLabel: disc.label, finalPrice: Math.max(0, price - disc.amount),
      stock: qty, lowStockThreshold: v.inventory?.lowStockThreshold ?? 5, isActive: v.isActive && p.isActive,
    };
  });
  return { items, total, page, pages: Math.max(1, Math.ceil(total / take)) };
}

/* ───────────────────────── bulk update with preview ───────────────────────── */
const filterSchema = z.object({
  categoryId: z.string().max(40).optional(), productBrandId: z.string().max(40).optional(), phoneBrandId: z.string().max(40).optional(),
  phoneModelId: z.string().max(40).optional(), colorId: z.string().max(40).optional(),
  productIds: z.array(z.string().max(40)).max(500).optional(), variantIds: z.array(z.string().max(40)).max(2000).optional(),
  q: z.string().trim().max(80).optional(), onlyActive: z.boolean().optional(),
});
const opSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("cost_percent"), value: z.coerce.number().min(-90).max(1000) }),
  z.object({ kind: z.literal("cost_delta"), value: z.coerce.number().int().min(-2_000_000_000).max(2_000_000_000) }),
  z.object({ kind: z.literal("cost_set"), value: money }),
  z.object({ kind: z.literal("margin_set"), marginType: z.enum(["PERCENT", "FIXED"]), value: z.coerce.number().min(0).max(2_000_000_000), roundTo: z.coerce.number().int().min(0).max(10_000_000).optional() }),
  z.object({ kind: z.literal("price_percent"), value: z.coerce.number().min(-90).max(1000) }),
  z.object({ kind: z.literal("price_delta"), value: z.coerce.number().int().min(-2_000_000_000).max(2_000_000_000) }),
  z.object({ kind: z.literal("mode_set"), mode: z.enum(["AUTOMATIC", "MANUAL"]) }),
]);
export const bulkSchema = z.object({ preview: z.boolean().default(true), filter: filterSchema, op: opSchema, reason: z.string().trim().max(300).optional() });
export type BulkOp = z.infer<typeof opSchema>;

const MAX_TARGETS = 2000;

export interface BulkRow { variantId: string; productId: string; product: string; variant: string; sku: string; oldPrice: number; newPrice: number; oldCost: number | null; newCost: number | null; oldRule: string; newRule: string; note?: string }

export async function bulkPricing(body: unknown, a: AdminCtx) {
  const d = bulkSchema.parse(body);
  const f = d.filter;
  if (!Object.values(f).some((v) => v !== undefined && !(Array.isArray(v) && v.length === 0) && v !== "")) throw badRequest("حداقل یک فیلتر (دسته، برند، مدل، محصول، …) انتخاب کنید.", "validation");
  return previewable(d.preview, async (tx) => {
    const and: Prisma.ProductVariantWhereInput[] = [];
    if (f.categoryId) { const cats = await tx.category.findMany({ where: { OR: [{ id: f.categoryId }, { parentId: f.categoryId }] }, select: { id: true } }); and.push({ product: { categoryId: { in: cats.map((c) => c.id) } } }); }
    if (f.productBrandId) and.push({ product: { brandId: f.productBrandId } });
    if (f.phoneBrandId) and.push({ phoneModel: { brandId: f.phoneBrandId } });
    if (f.phoneModelId) and.push({ phoneModelId: f.phoneModelId });
    if (f.colorId) and.push({ colorId: f.colorId });
    if (f.productIds?.length) and.push({ productId: { in: f.productIds } });
    if (f.variantIds?.length) and.push({ id: { in: f.variantIds } });
    if (f.q) and.push({ OR: [{ sku: { contains: f.q, mode: "insensitive" } }, { product: { name: { contains: f.q, mode: "insensitive" } } }] });
    if (f.onlyActive) and.push({ isActive: true });
    const load = () => tx.productVariant.findMany({ where: { AND: and }, orderBy: [{ productId: "asc" }, { sortOrder: "asc" }], take: MAX_TARGETS + 1, include: { product: true } });
    const targets = await load();
    if (targets.length > MAX_TARGETS) throw conflict(`تعداد تنوع‌های انتخاب‌شده از ${MAX_TARGETS.toLocaleString("fa-IR")} بیشتر است؛ فیلتر را محدودتر کنید.`, "too_many");
    if (!targets.length) throw notFound("هیچ تنوعی با این فیلتر پیدا نشد.");

    const policy = await getWholesalePolicy(tx);
    const oldIdx = await loadRuleIndex(tx);
    const snap = (v: (typeof targets)[number], idx = oldIdx) => ({ price: v.retailPrice ?? v.product.retailPrice, cost: v.costPrice ?? v.product.costPrice, rule: v.pricingMode === "AUTOMATIC" ? ruleLabel(resolveRule(idx, { variantId: v.id, productId: v.productId, categoryId: v.product.categoryId })) : "MANUAL" });
    const before = new Map(targets.map((v) => [v.id, snap(v)]));
    const notes = new Map<string, string>();
    const op = d.op;

    if (op.kind === "cost_percent" || op.kind === "cost_delta" || op.kind === "cost_set") {
      for (const v of targets) {
        const cur = v.costPrice ?? v.product.costPrice;
        if (op.kind !== "cost_set" && cur == null) { notes.set(v.id, "هزینه خرید ثبت نشده است."); continue; }
        const next = op.kind === "cost_set" ? op.value : op.kind === "cost_delta" ? (cur ?? 0) + op.value : Math.round(((cur ?? 0) * (100 + op.value)) / 100);
        if (next < 0) { notes.set(v.id, "هزینهٔ جدید منفی می‌شود."); continue; }
        await tx.productVariant.update({ where: { id: v.id }, data: { costPrice: next } });
      }
    } else if (op.kind === "margin_set") {
      const value = humanMargin(op.marginType, op.value);
      const auto = targets.filter((v) => v.pricingMode === "AUTOMATIC");
      for (const v of targets) if (v.pricingMode !== "AUTOMATIC") notes.set(v.id, "قیمت‌گذاری دستی است؛ سود اثری ندارد.");
      // The coarsest rule that exactly matches the selection keeps the rule table small.
      const onlyCategory = f.categoryId && !f.productBrandId && !f.phoneBrandId && !f.phoneModelId && !f.colorId && !f.productIds?.length && !f.variantIds?.length && !f.q && !f.onlyActive;
      const upsert = async (scope: "CATEGORY" | "PRODUCT" | "VARIANT", targetId: string) => {
        const data = { marginType: op.marginType, marginValue: value, roundTo: op.roundTo ?? 0, isActive: true };
        const cur = await tx.pricingRule.findUnique({ where: { scope_targetId: { scope, targetId } } });
        const rule = cur ? await tx.pricingRule.update({ where: { id: cur.id }, data }) : await tx.pricingRule.create({ data: { scope, targetId, ...data } });
        await audit(a, cur ? "pricing.rule.update" : "pricing.rule.create", "pricing_rule", rule.id, cur ?? undefined, rule, tx);
      };
      if (onlyCategory) await upsert("CATEGORY", f.categoryId!);
      else if (f.productIds?.length && !f.categoryId && !f.productBrandId && !f.phoneBrandId && !f.phoneModelId && !f.colorId && !f.variantIds?.length && !f.q) for (const pid of new Set(auto.map((v) => v.productId))) await upsert("PRODUCT", pid);
      else { if (auto.length > 500) throw conflict("برای تغییر سود روی بیش از ۵۰۰ تنوع، دسته یا محصول را انتخاب کنید.", "too_many"); for (const v of auto) await upsert("VARIANT", v.id); }
    } else if (op.kind === "price_percent" || op.kind === "price_delta") {
      for (const v of targets) {
        if (v.pricingMode === "AUTOMATIC") { notes.set(v.id, "قیمت خودکار است؛ برای تغییر از «هزینه» یا «سود» استفاده کنید."); continue; }
        const cur = v.retailPrice ?? v.product.retailPrice;
        const next = op.kind === "price_delta" ? cur + op.value : Math.round((cur * (100 + op.value)) / 100);
        if (next < 0) { notes.set(v.id, "قیمت جدید منفی می‌شود."); continue; }
        const wp = wholesaleProblem(next, v.wholesalePrice ?? v.product.wholesalePrice, policy);
        if (wp) { notes.set(v.id, `اعمال نشد؛ ${wp}`); continue; }
        await tx.productVariant.update({ where: { id: v.id }, data: { retailPrice: next } });
      }
    } else if (op.kind === "mode_set") {
      const idx = await loadRuleIndex(tx);
      for (const v of targets) {
        if (op.mode === "AUTOMATIC") {
          const cost = v.costPrice ?? v.product.costPrice;
          if (cost == null) { notes.set(v.id, "برای حالت خودکار ابتدا هزینه خرید لازم است."); continue; }
          if (!resolveRule(idx, { variantId: v.id, productId: v.productId, categoryId: v.product.categoryId })) { notes.set(v.id, "هیچ قانون قیمت‌گذاری فعالی وجود ندارد."); continue; }
        }
        await tx.productVariant.update({ where: { id: v.id }, data: { pricingMode: op.mode } });
      }
    }

    // Reprice everything automatic that these products contain (the product-level "cheapest variant" price included).
    const newIdx = await loadRuleIndex(tx);
    const rc = await recomputePrices(tx, { productIds: [...new Set(targets.map((v) => v.productId))] }, { apply: true, adminId: a.admin.id, source: "bulk", reason: d.reason ?? null, idx: newIdx, log: false, wholesale: { policy, onConflict: "skip" } });
    for (const sk of rc.skipped) if (sk.variantId && !notes.has(sk.variantId) && targets.some((t) => t.id === sk.variantId)) notes.set(sk.variantId, sk.reason);

    const after = await tx.productVariant.findMany({ where: { id: { in: targets.map((v) => v.id) } }, include: { product: true } });
    const afterById = new Map(after.map((v) => [v.id, v]));
    const rows: BulkRow[] = [];
    for (const v of targets) {
      const b = before.get(v.id)!; const nv = afterById.get(v.id)!; const s = snap(nv, newIdx);
      if (b.price === s.price && b.cost === s.cost && b.rule === s.rule && nv.pricingMode === v.pricingMode) { if (notes.has(v.id)) rows.push({ variantId: v.id, productId: v.productId, product: v.product.name, variant: v.name, sku: v.sku, oldPrice: b.price, newPrice: s.price, oldCost: b.cost, newCost: s.cost, oldRule: b.rule, newRule: s.rule, note: notes.get(v.id) }); continue; }
      rows.push({ variantId: v.id, productId: v.productId, product: v.product.name, variant: v.name, sku: v.sku, oldPrice: b.price, newPrice: s.price, oldCost: b.cost, newCost: s.cost, oldRule: b.rule, newRule: s.rule, note: notes.get(v.id) });
      await tx.priceHistory.create({ data: { productId: v.productId, variantId: v.id, type: "retail", oldPrice: b.price, newPrice: s.price, oldCost: b.cost, newCost: s.cost, oldRule: b.rule, newRule: s.rule, reason: d.reason ?? null, source: "bulk", adminId: a.admin.id } });
    }
    const changed = rows.filter((r) => !r.note || r.oldPrice !== r.newPrice || r.oldCost !== r.newCost);
    await audit(a, "pricing.bulk", "pricing", null, { filter: f }, { op, targets: targets.length, changed: changed.length, reason: d.reason ?? null }, tx);
    return { targets: targets.length, changedCount: changed.filter((r) => !r.note).length, skippedCount: rows.filter((r) => r.note).length, rows: rows.slice(0, 300), truncated: rows.length > 300 };
  });
}

/* ───────────────────────── history + pickers ───────────────────────── */
export async function priceHistoryList(req: NextRequest) {
  const { take, skip, page, sp } = pageParams(req, 30);
  const where: Prisma.PriceHistoryWhereInput = {};
  if (sp.get("productId")) where.productId = sp.get("productId")!;
  if (sp.get("variantId")) where.variantId = sp.get("variantId")!;
  if (sp.get("source")) where.source = sp.get("source")!;
  const [rows, total] = await Promise.all([
    db.priceHistory.findMany({ where, orderBy: { createdAt: "desc" }, take, skip, include: { product: { select: { name: true } }, variant: { select: { sku: true, name: true } } } }),
    db.priceHistory.count({ where }),
  ]);
  const admins = await db.user.findMany({ where: { id: { in: rows.map((r) => r.adminId).filter((x): x is string => !!x) } }, select: { id: true, displayName: true, phone: true } });
  return { items: rows.map((r) => ({ ...r, admin: admins.find((u) => u.id === r.adminId)?.displayName ?? admins.find((u) => u.id === r.adminId)?.phone ?? null })), total, page, pages: Math.max(1, Math.ceil(total / take)) };
}

/** Search-as-you-type target picker for discounts, rules and bulk filters. */
export async function targets(req: NextRequest) {
  const u = new URL(req.url);
  const scope = u.searchParams.get("scope") ?? "";
  const q = (u.searchParams.get("q") ?? "").trim().slice(0, 60);
  const like = q ? { contains: q, mode: "insensitive" as const } : undefined;
  switch (scope) {
    case "PRODUCT": return (await db.product.findMany({ where: like ? { OR: [{ name: like }, { sku: like }] } : {}, orderBy: { name: "asc" }, take: 20, select: { id: true, name: true, sku: true } })).map((p) => ({ id: p.id, label: `${p.name} (${p.sku})` }));
    case "VARIANT": return (await db.productVariant.findMany({ where: like ? { OR: [{ sku: like }, { name: like }, { product: { name: like } }] } : {}, orderBy: { sku: "asc" }, take: 20, select: { id: true, sku: true, name: true, product: { select: { name: true } } } })).map((v) => ({ id: v.id, label: `${v.product.name} — ${v.name} (${v.sku})` }));
    case "CATEGORY": return (await db.category.findMany({ where: like ? { name: like } : {}, orderBy: { name: "asc" }, take: 30, select: { id: true, name: true, parent: { select: { name: true } } } })).map((c) => ({ id: c.id, label: c.parent ? `${c.parent.name} › ${c.name}` : c.name }));
    // The two brand kinds are different things and are listed with what they contain, so the admin cannot mix them up.
    case "PRODUCT_BRAND": return (await db.brand.findMany({ where: { ...(like ? { name: like } : {}), products: { some: {} } }, orderBy: { name: "asc" }, take: 30, select: { id: true, name: true, _count: { select: { products: true } } } })).map((b) => ({ id: b.id, label: `${b.name} — سازندهٔ ${b._count.products.toLocaleString("fa-IR")} محصول` }));
    case "PHONE_BRAND": return (await db.brand.findMany({ where: { ...(like ? { name: like } : {}), phoneModels: { some: {} } }, orderBy: { name: "asc" }, take: 30, select: { id: true, name: true, _count: { select: { phoneModels: true } } } })).map((b) => ({ id: b.id, label: `${b.name} — برند گوشی، ${b._count.phoneModels.toLocaleString("fa-IR")} مدل` }));
    case "MODEL": return (await db.phoneModel.findMany({ where: like ? { name: like } : {}, orderBy: { name: "asc" }, take: 30, select: { id: true, name: true, brand: { select: { name: true } } } })).map((m) => ({ id: m.id, label: `${m.brand.name} › ${m.name}` }));
    default: throw badRequest("نوع هدف نامعتبر است.");
  }
}


/* ───────────────────────── discounts list (with human target labels) ───────────────────────── */
export async function listDiscounts(req: NextRequest) {
  const { take, skip, q, page, sp } = pageParams(req, 30);
  const now = new Date();
  const where: Prisma.DiscountWhereInput = {};
  if (q) where.name = { contains: q, mode: "insensitive" };
  if (sp.get("scope")) where.scope = sp.get("scope") as never;
  const st = sp.get("status");
  if (st === "active") { where.isActive = true; where.AND = [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }]; }
  if (st === "scheduled") { where.isActive = true; where.startsAt = { gt: now }; }
  if (st === "expired") where.endsAt = { lt: now };
  if (st === "off") where.isActive = false;
  const [rows, total] = await Promise.all([db.discount.findMany({ where, orderBy: { createdAt: "desc" }, take, skip }), db.discount.count({ where })]);
  const ids = (s: string) => rows.filter((r) => r.scope === s).map((r) => r.targetId);
  const [prods, cats, vars, brands, models] = await Promise.all([
    db.product.findMany({ where: { id: { in: ids("PRODUCT") } }, select: { id: true, name: true } }),
    db.category.findMany({ where: { id: { in: ids("CATEGORY") } }, select: { id: true, name: true } }),
    db.productVariant.findMany({ where: { id: { in: ids("VARIANT") } }, select: { id: true, sku: true, product: { select: { name: true } } } }),
    db.brand.findMany({ where: { id: { in: [...ids("BRAND"), ...ids("PRODUCT_BRAND"), ...ids("PHONE_BRAND")] } }, select: { id: true, name: true } }),
    db.phoneModel.findMany({ where: { id: { in: ids("MODEL") } }, select: { id: true, name: true } }),
  ]);
  const label = (r: (typeof rows)[number]) => r.scope === "ALL" ? "همهٔ محصولات" : r.scope === "PRODUCT" ? prods.find((x) => x.id === r.targetId)?.name : r.scope === "CATEGORY" ? cats.find((x) => x.id === r.targetId)?.name : (r.scope === "BRAND" || r.scope === "PRODUCT_BRAND" || r.scope === "PHONE_BRAND") ? brands.find((x) => x.id === r.targetId)?.name : r.scope === "MODEL" ? models.find((x) => x.id === r.targetId)?.name : (() => { const v = vars.find((x) => x.id === r.targetId); return v ? `${v.product.name} (${v.sku})` : undefined; })();
  const status = (r: (typeof rows)[number]) => !r.isActive ? "off" : r.endsAt && r.endsAt < now ? "expired" : r.startsAt && r.startsAt > now ? "scheduled" : r.usageLimit != null && r.usedCount >= r.usageLimit ? "exhausted" : "active";
  return { items: rows.map((r) => ({ ...r, targetLabel: label(r) ?? "—", status: status(r) })), total, page, pages: Math.max(1, Math.ceil(total / take)) };
}


/* ───────────────────────── wholesale/retail consistency report ───────────────────────── */
/** Every stored price pair that currently breaks the wholesale policy (e.g. after the policy was tightened). Read-only: nothing is changed. */
export async function wholesaleConflicts() {
  const policy = await getWholesalePolicy();
  const rows = await db.productVariant.findMany({ where: { OR: [{ wholesalePrice: { not: null } }, { product: { wholesalePrice: { not: null } } }] }, include: { product: { select: { id: true, name: true, retailPrice: true, wholesalePrice: true } } }, orderBy: { sku: "asc" } });
  const bad = rows.map((v) => { const retail = v.retailPrice ?? v.product.retailPrice; const wholesale = v.wholesalePrice ?? v.product.wholesalePrice; const unpriced = v.pricingMode === "AUTOMATIC" && retail <= 0; return { variantId: v.id, productId: v.product.id, product: v.product.name, sku: v.sku, retail, wholesale, problem: unpriced ? null : wholesaleProblem(retail, wholesale, policy) }; }).filter((x) => x.problem);
  return { policy, checked: rows.length, conflictCount: bad.length, items: bad.slice(0, 200) };
}
