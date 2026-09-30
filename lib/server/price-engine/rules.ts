import type { Prisma } from "@/lib/generated/prisma/client";
import { priceFromCost, type MarginRule } from "@/lib/server/price-engine/calc";

type Db = Prisma.TransactionClient;

export type Scope = "GLOBAL" | "CATEGORY" | "PRODUCT" | "VARIANT";
export interface RuleRow extends MarginRule { id: string; scope: Scope; targetId: string; isActive: boolean }

/** `GLOBAL::PERCENT:3000:1000` — stable machine label stored in price history. */
export const ruleLabel = (r: Pick<RuleRow, "scope" | "targetId" | "marginType" | "marginValue" | "roundTo"> | null) => (r ? `${r.scope}:${r.targetId}:${r.marginType}:${r.marginValue}:${r.roundTo}` : "MANUAL");

export interface RuleIndex { rules: RuleRow[]; parentOf: Map<string, string | null> }

export async function loadRuleIndex(tx: Db): Promise<RuleIndex> {
  const [rules, cats] = await Promise.all([
    tx.pricingRule.findMany({ where: { isActive: true } }),
    tx.category.findMany({ select: { id: true, parentId: true } }),
  ]);
  return { rules: rules as RuleRow[], parentOf: new Map(cats.map((c) => [c.id, c.parentId])) };
}

/** Category then its ancestors (nearest first), guarded against cycles. */
export function categoryChain(idx: RuleIndex, categoryId: string): string[] {
  const out: string[] = [];
  for (let cur: string | null | undefined = categoryId; cur && out.length < 10 && !out.includes(cur); cur = idx.parentOf.get(cur)) out.push(cur);
  return out;
}

/** The most specific active rule wins: VARIANT > PRODUCT > CATEGORY (nearest ancestor first) > GLOBAL. */
export function resolveRule(idx: RuleIndex, t: { variantId?: string | null; productId: string; categoryId: string }): RuleRow | null {
  const find = (scope: Scope, targetId: string) => idx.rules.find((r) => r.scope === scope && r.targetId === targetId) ?? null;
  if (t.variantId) { const r = find("VARIANT", t.variantId); if (r) return r; }
  const p = find("PRODUCT", t.productId); if (p) return p;
  for (const c of categoryChain(idx, t.categoryId)) { const r = find("CATEGORY", c); if (r) return r; }
  return find("GLOBAL", "");
}

export type Computed = { ok: true; price: number; cost: number; rule: RuleRow } | { ok: false; reason: "no_cost" | "no_rule" };

export function computeSelling(idx: RuleIndex, t: { variantId?: string | null; productId: string; categoryId: string; cost: number | null }): Computed {
  if (t.cost == null) return { ok: false, reason: "no_cost" };
  const rule = resolveRule(idx, t);
  if (!rule) return { ok: false, reason: "no_rule" };
  return { ok: true, price: priceFromCost(t.cost, rule), cost: t.cost, rule };
}

export interface PriceChange {
  productId: string; productName: string; variantId: string | null; sku: string;
  oldPrice: number; newPrice: number; oldCost: number | null; newCost: number | null; oldRule: string; newRule: string;
}
export interface RecomputeResult { changes: PriceChange[]; skipped: { productId: string; variantId: string | null; sku: string; reason: string }[] }

export interface RecomputeFilter { all?: boolean; productIds?: string[]; variantIds?: string[]; categoryIds?: string[] }

/**
 * Recomputes the stored selling price of every AUTOMATIC product / variant in scope from cost + rules.
 * MANUAL items are never touched. With `apply: false` nothing is written (preview). Every written change gets a PriceHistory row.
 */
export async function recomputePrices(
  tx: Db, filter: RecomputeFilter, o: { apply: boolean; adminId: string | null; reason?: string | null; source: "rule" | "bulk" | "manual"; idx?: RuleIndex; /** Rules as they were BEFORE the change being applied (for history). */ oldIdx?: RuleIndex; /** Write PriceHistory rows (default true). Bulk operations write their own richer rows. */ log?: boolean },
): Promise<RecomputeResult> {
  const idx = o.idx ?? (await loadRuleIndex(tx));
  const where: Prisma.ProductWhereInput = { OR: [{ pricingMode: "AUTOMATIC" }, { variants: { some: { pricingMode: "AUTOMATIC" } } }] };
  const and: Prisma.ProductWhereInput[] = [where];
  if (filter.productIds) and.push({ id: { in: filter.productIds } });
  if (filter.variantIds) and.push({ variants: { some: { id: { in: filter.variantIds } } } });
  if (filter.categoryIds) {
    const all = new Set<string>();
    for (const c of filter.categoryIds) for (const [id] of idx.parentOf) if (categoryChain(idx, id).includes(c)) all.add(id);
    and.push({ categoryId: { in: [...all] } });
  }
  const products = await tx.product.findMany({ where: { AND: and }, include: { variants: { orderBy: { sortOrder: "asc" } } } });
  const res: RecomputeResult = { changes: [], skipped: [] };
  const before = (t: { variantId?: string | null; productId: string; categoryId: string }) => (o.oldIdx ? ruleLabel(resolveRule(o.oldIdx, t)) : "AUTOMATIC");

  for (const p of products) {
    const newVariantPrice = new Map<string, number>();
    for (const v of p.variants) {
      if (v.pricingMode !== "AUTOMATIC") continue;
      if (filter.variantIds && !filter.variantIds.includes(v.id)) continue;
      const c = computeSelling(idx, { variantId: v.id, productId: p.id, categoryId: p.categoryId, cost: v.costPrice ?? p.costPrice });
      if (!c.ok) { res.skipped.push({ productId: p.id, variantId: v.id, sku: v.sku, reason: c.reason === "no_cost" ? "هزینه خرید ثبت نشده است." : "هیچ قانون قیمت‌گذاری فعالی پیدا نشد." }); continue; }
      newVariantPrice.set(v.id, c.price);
      if (v.retailPrice !== c.price) {
        res.changes.push({ productId: p.id, productName: p.name, variantId: v.id, sku: v.sku, oldPrice: v.retailPrice ?? p.retailPrice, newPrice: c.price, oldCost: v.costPrice, newCost: v.costPrice ?? p.costPrice, oldRule: before({ variantId: v.id, productId: p.id, categoryId: p.categoryId }), newRule: ruleLabel(c.rule) });
        if (o.apply) await tx.productVariant.update({ where: { id: v.id }, data: { retailPrice: c.price } });
      }
    }
    if (p.pricingMode === "AUTOMATIC" && !filter.variantIds) {
      let price: number | null = null; let rule: RuleRow | null = null;
      if (p.costPrice != null) { const c = computeSelling(idx, { productId: p.id, categoryId: p.categoryId, cost: p.costPrice }); if (c.ok) { price = c.price; rule = c.rule; } else res.skipped.push({ productId: p.id, variantId: null, sku: p.sku, reason: c.reason === "no_cost" ? "هزینه خرید ثبت نشده است." : "هیچ قانون قیمت‌گذاری فعالی پیدا نشد." }); }
      else {
        // A "container" product: the listing price is the cheapest active variant.
        const prices = p.variants.filter((v) => v.isActive).map((v) => newVariantPrice.get(v.id) ?? v.retailPrice).filter((x): x is number => x != null);
        if (prices.length) price = Math.min(...prices);
      }
      if (price != null && price !== p.retailPrice) {
        res.changes.push({ productId: p.id, productName: p.name, variantId: null, sku: p.sku, oldPrice: p.retailPrice, newPrice: price, oldCost: p.costPrice, newCost: p.costPrice, oldRule: before({ productId: p.id, categoryId: p.categoryId }), newRule: ruleLabel(rule) });
        if (o.apply) await tx.product.update({ where: { id: p.id }, data: { retailPrice: price } });
      }
    }
  }
  if (o.apply && o.log !== false) {
    for (const c of res.changes) {
      await tx.priceHistory.create({ data: { productId: c.productId, variantId: c.variantId, type: "retail", oldPrice: c.oldPrice, newPrice: c.newPrice, oldCost: c.oldCost, newCost: c.newCost, oldRule: c.oldRule, newRule: c.newRule, reason: o.reason ?? null, source: o.source, adminId: o.adminId } });
    }
  }
  return res;
}
