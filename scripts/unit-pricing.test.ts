/** Pure unit tests for the pricing engine (no server, no database). */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allocate, discountAmount, pickBestDiscount, priceFromCost } from "../lib/server/price-engine/calc";
import { categoryChain, computeSelling, resolveRule, type RuleIndex, type RuleRow } from "../lib/server/price-engine/rules";

const rule = (scope: RuleRow["scope"], targetId: string, marginValue: number, extra: Partial<RuleRow> = {}): RuleRow => ({ id: `${scope}:${targetId}`, scope, targetId, marginType: "PERCENT", marginValue, roundTo: 0, isActive: true, ...extra });
const idx = (rules: RuleRow[]): RuleIndex => ({ rules, parentOf: new Map([["child", "parent"], ["parent", null], ["other", null]]) });

describe("priceFromCost", () => {
  it("cost + percent margin (spec examples)", () => {
    assert.equal(priceFromCost(300_000, { marginType: "PERCENT", marginValue: 3000, roundTo: 0 }), 390_000);
    assert.equal(priceFromCost(350_000, { marginType: "PERCENT", marginValue: 3000, roundTo: 0 }), 455_000);
  });
  it("fixed margin, fractional percent, rounding up to a step", () => {
    assert.equal(priceFromCost(300_000, { marginType: "FIXED", marginValue: 45_000, roundTo: 0 }), 345_000);
    assert.equal(priceFromCost(100_000, { marginType: "PERCENT", marginValue: 1250, roundTo: 0 }), 112_500);
    assert.equal(priceFromCost(333_333, { marginType: "PERCENT", marginValue: 3000, roundTo: 1000 }), 434_000);
  });
  it("never produces a float and rejects nonsense", () => {
    assert.ok(Number.isInteger(priceFromCost(199_999, { marginType: "PERCENT", marginValue: 3333, roundTo: 0 })));
    assert.throws(() => priceFromCost(-1, { marginType: "PERCENT", marginValue: 100, roundTo: 0 }));
    assert.throws(() => priceFromCost(1.5, { marginType: "PERCENT", marginValue: 100, roundTo: 0 }));
  });
});

describe("discounts", () => {
  it("percent floors, fixed is capped at the price", () => {
    assert.equal(discountAmount(390_000, { type: "PERCENT", value: 20 }), 78_000);
    assert.equal(discountAmount(999, { type: "PERCENT", value: 10 }), 99);
    assert.equal(discountAmount(30_000, { type: "FIXED", value: 50_000 }), 30_000);
  });
  it("only the best single discount applies (never stacked)", () => {
    const best = pickBestDiscount(100_000, [{ id: null, label: "legacy", type: "FIXED", value: 5_000 }, { id: "a", label: "10%", type: "PERCENT", value: 10 }, { id: "b", label: "8k", type: "FIXED", value: 8_000 }]);
    assert.deepEqual(best, { amount: 10_000, id: "a", label: "10%" });
    assert.deepEqual(pickBestDiscount(100_000, []), { amount: 0, id: null, label: null });
  });
});

describe("allocate (coupon share per line)", () => {
  it("parts always add up to the total", () => {
    for (const [total, w] of [[10, [1, 1, 1]], [100_000, [123, 456, 789]], [7, [5]], [1, [3, 3]]] as [number, number[]][]) {
      const parts = allocate(total, w); assert.equal(parts.reduce((a, b) => a + b, 0), total, JSON.stringify([total, w])); assert.ok(parts.every((p) => p >= 0));
    }
    assert.deepEqual(allocate(0, [1, 2]), [0, 0]);
    assert.deepEqual(allocate(50, [0, 0]), [0, 0]);
  });
});

describe("rule resolution: variant > product > category (nearest first) > global", () => {
  const all = idx([rule("GLOBAL", "", 1000), rule("CATEGORY", "parent", 2000), rule("CATEGORY", "child", 2500), rule("PRODUCT", "p1", 3000), rule("VARIANT", "v1", 4000)]);
  it("picks the most specific active rule", () => {
    assert.equal(resolveRule(all, { variantId: "v1", productId: "p1", categoryId: "child" })!.marginValue, 4000);
    assert.equal(resolveRule(all, { variantId: "v2", productId: "p1", categoryId: "child" })!.marginValue, 3000);
    assert.equal(resolveRule(all, { variantId: "v2", productId: "p2", categoryId: "child" })!.marginValue, 2500);
    assert.equal(resolveRule(all, { variantId: "v2", productId: "p2", categoryId: "parent" })!.marginValue, 2000);
    assert.equal(resolveRule(all, { variantId: "v2", productId: "p2", categoryId: "other" })!.marginValue, 1000);
  });
  it("a child category without its own rule inherits the parent's", () => {
    const only = idx([rule("CATEGORY", "parent", 2000), rule("GLOBAL", "", 1000)]);
    assert.equal(resolveRule(only, { productId: "p", categoryId: "child" })!.marginValue, 2000);
    assert.deepEqual(categoryChain(only, "child"), ["child", "parent"]);
  });
  it("no rule → nothing to compute; no cost → nothing to compute", () => {
    assert.equal(resolveRule(idx([]), { productId: "p", categoryId: "child" }), null);
    assert.deepEqual(computeSelling(idx([]), { productId: "p", categoryId: "child", cost: 100 }), { ok: false, reason: "no_rule" });
    assert.deepEqual(computeSelling(all, { productId: "p", categoryId: "child", cost: null }), { ok: false, reason: "no_cost" });
    const c = computeSelling(all, { variantId: "v1", productId: "p1", categoryId: "child", cost: 300_000 });
    assert.ok(c.ok && c.price === 420_000);
  });
});
