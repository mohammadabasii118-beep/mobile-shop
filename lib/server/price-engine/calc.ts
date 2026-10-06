/**
 * Pure money arithmetic for the pricing engine: no database, no I/O, integers only (Toman).
 * Percentages are handled in integer basis points / whole percents, so no floating-point money ever exists.
 */

export type MarginType = "PERCENT" | "FIXED";
export interface MarginRule { marginType: MarginType; /** PERCENT: basis points (3000 = 30 %). FIXED: Toman. */ marginValue: number; /** Round the result UP to a multiple of this (0/1 = off). */ roundTo: number }

const int = (n: number, what: string) => { if (!Number.isSafeInteger(n)) throw new RangeError(`${what} must be an integer`); return n; };

/** cost + margin, optionally rounded up to a "nice" step. 300 000 with 30 % → 390 000. */
export function priceFromCost(cost: number, rule: MarginRule): number {
  int(cost, "cost"); int(rule.marginValue, "margin");
  if (cost < 0 || rule.marginValue < 0) throw new RangeError("negative cost or margin");
  const raw = rule.marginType === "PERCENT" ? cost + Math.round((cost * rule.marginValue) / 10_000) : cost + rule.marginValue;
  return rule.roundTo > 1 ? Math.ceil(raw / rule.roundTo) * rule.roundTo : raw;
}

export interface DiscountLike { id: string | null; label: string; type: "PERCENT" | "FIXED"; /** PERCENT: whole percent 1–100. FIXED: Toman per unit. */ value: number }

/** Amount taken off ONE unit priced at `price`. Never negative, never more than the price. */
export function discountAmount(price: number, d: Pick<DiscountLike, "type" | "value">): number {
  const raw = d.type === "PERCENT" ? Math.floor((price * d.value) / 100) : d.value;
  return Math.max(0, Math.min(price, raw));
}

export interface AppliedDiscount { amount: number; id: string | null; label: string | null }

/**
 * Discounts never stack: the single best (largest amount) candidate wins, so a price can never be reduced twice.
 * Ties go to the first candidate (callers pass the legacy product discount first, then promotions oldest-first).
 */
export function pickBestDiscount(price: number, candidates: DiscountLike[]): AppliedDiscount {
  let best: AppliedDiscount = { amount: 0, id: null, label: null };
  for (const c of candidates) {
    const amount = discountAmount(price, c);
    if (amount > best.amount) best = { amount, id: c.id, label: c.label };
  }
  return best;
}

/** Splits `total` across weights so the parts add up exactly (largest-remainder), e.g. a coupon share per order line. */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const o of order) { if (left <= 0) break; out[o.i]!++; left--; }
  return out;
}
