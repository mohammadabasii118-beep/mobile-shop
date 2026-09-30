/**
 * Phase 6b tests: wholesale/retail policy, storefront sort by effective price, product-brand vs phone-brand discounts.
 * Server must be running in production mode:  ALLOW_INSECURE_HTTP=1 TRUST_PROXY=1 npm start -- -p 3300
 */
import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { Client, db, loginWithPassword, registerAndLogin, uid } from "./test-utils";

let admin: Client, manager: Client, partner: Client, catId = "", catSlug = "";
const ok = (r: { status: number; json: any }, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.json)); return r.json?.data; };
const DAY = 86_400_000, iso = (ms: number) => new Date(Date.now() + ms).toISOString();
const B: Record<string, string> = {}, M: Record<string, string> = {}, C: Record<string, string> = {};
const DEFAULT_POLICY = { minDiscountPercent: 0, maxDiscountPercent: 0, capAtRetail: true };
const setPolicy = (p: Partial<typeof DEFAULT_POLICY>) => admin.put("/api/admin/settings/wholesalePolicy", { ...DEFAULT_POLICY, ...p });
const made: string[] = [];
const cats: string[] = [];
const discount = async (d: Record<string, unknown>) => { const x = ok(await admin.post("/api/admin/r/discounts", { name: "تخفیف 6b " + uid(), isActive: true, ...d })); made.push(x.id); return x; };

interface V { key: string; model?: string; color?: string; stock?: number; retail?: number; cost?: number; wholesale?: number }
async function mk(o: { variants?: V[]; retail?: number; brand?: string; legacy?: number; wholesale?: number; minQty?: number; mode?: "AUTOMATIC" | "MANUAL"; cost?: number; category?: string }) {
  const s = "p6b-" + uid();
  const variants = (o.variants ?? [{ key: "a" }]).map((v) => ({ sku: `V-${s}-${v.key}`, phoneModelId: v.model ? M[v.model] : null, colorId: v.color ? C[v.color] : null, stock: v.stock ?? 20, pricingMode: o.mode ?? "MANUAL", ...(v.retail !== undefined ? { retailPrice: v.retail } : {}), ...(v.cost !== undefined ? { costPrice: v.cost } : {}), ...(v.wholesale !== undefined ? { wholesalePrice: v.wholesale } : {}) }));
  const p = ok(await admin.post("/api/admin/products", { name: "کالای " + s, slug: s, sku: "SKU-" + s, categoryId: o.category ?? catId, pricingMode: o.mode ?? "MANUAL", ...(o.retail !== undefined ? { retailPrice: o.retail } : {}), brandId: o.brand ? B[o.brand] : null, retailDiscount: o.legacy ?? 0, ...(o.wholesale !== undefined ? { wholesalePrice: o.wholesale, minWholesaleQty: o.minQty ?? 2 } : {}), ...(o.cost !== undefined ? { costPrice: o.cost } : {}), variants }));
  const vs = p.variants as { id: string; sku: string }[];
  return { id: p.id as string, slug: s, vid: (k: string) => vs.find((v) => v.sku === `V-${s}-${k}`)!.id };
}
async function customer() {
  const r = await registerAndLogin();
  const a = await r.c.post("/api/addresses", { receiver: "تست", phone: "09121234567", province: "تهران", city: "تهران", postalCode: "1234567890", address: "خیابان ولیعصر، پلاک ۱۰" });
  return { ...r, addressId: ok(a).id as string };
}
const cartUnit = async (c: Client, slug: string, variantId: string | undefined, qty = 1) => {
  ok(await c.post("/api/cart/items", { productSlug: slug, ...(variantId ? { variantId } : {}), quantity: qty }));
  return (ok(await c.get("/api/cart")).lines as any[]).find((l) => (variantId ? l.variantId === variantId : l.slug === slug));
};
const variantRow = (id: string) => db.productVariant.findUniqueOrThrow({ where: { id } });

describe("Phase 6b — wholesale policy, effective-price sort, brand discounts", () => {
  before(async () => {
    await db.rateLimit.deleteMany({});
    admin = await loginWithPassword("09120000001", "Admin@12345"); manager = await loginWithPassword("09120000006", "Manager@12345"); partner = await loginWithPassword("09120000003", "Partner@12345");
    ok(await setPolicy({}));
    const tag = uid();
    catSlug = "cat6b-" + tag; catId = ok(await admin.post("/api/admin/r/categories", { name: "دستهٔ ۶ب " + tag, slug: catSlug })).id; cats.push(catId);
    for (const [k, n] of [["Spigen", "Spigen"], ["Baseus", "Baseus"], ["Apple", "Apple"], ["Samsung", "Samsung"]]) B[k!] = ok(await admin.post("/api/admin/r/brands", { name: `${n} ${tag}`, slug: `${k!.toLowerCase()}-${tag}` })).id;
    M.i12 = ok(await admin.post("/api/admin/r/phone-models", { name: "iPhone 12 " + tag, slug: "i12b-" + tag, brandId: B.Apple })).id;
    M.s23 = ok(await admin.post("/api/admin/r/phone-models", { name: "Galaxy S23 " + tag, slug: "s23b-" + tag, brandId: B.Samsung })).id;
    C.white = ok(await admin.post("/api/admin/r/colors", { name: "سفید " + tag })).id;
  });
  afterEach(async () => { if (made.length) await db.discount.updateMany({ where: { id: { in: made.splice(0) } }, data: { isActive: false } }); });
  after(async () => {
    await setPolicy({});
    await db.category.updateMany({ where: { id: { in: cats } }, data: { isActive: false } });
    await db.brand.updateMany({ where: { id: { in: Object.values(B) } }, data: { isActive: false } });
    await db.phoneModel.updateMany({ where: { id: { in: Object.values(M) } }, data: { isActive: false } });
    await db.color.updateMany({ where: { id: { in: Object.values(C) } }, data: { isActive: false } });
    await db.$disconnect();
  });

  describe("Product brand and phone brand are different discount targets", () => {
    it("PRODUCT_BRAND matches only the product's own brand (any phone model); PHONE_BRAND matches only the variant's phone brand (any product brand)", async () => {
      const sp = await mk({ retail: 100_000, brand: "Spigen", variants: [{ key: "apple", model: "i12", color: "white", retail: 100_000 }, { key: "sam", model: "s23", color: "white", retail: 100_000 }] });
      const bs = await mk({ retail: 100_000, brand: "Baseus", variants: [{ key: "apple", model: "i12", color: "white", retail: 100_000 }] });
      const c = (await customer()).c;
      await discount({ type: "PERCENT", value: 20, scope: "PRODUCT_BRAND", targetId: B.Spigen });
      assert.equal((await cartUnit(c, sp.slug, sp.vid("apple"))).unitPrice, 80_000, "Spigen product, Apple variant");
      assert.equal((await cartUnit(c, sp.slug, sp.vid("sam"))).unitPrice, 80_000, "Spigen product, Samsung variant");
      assert.equal((await cartUnit(c, bs.slug, bs.vid("apple"))).unitPrice, 100_000, "another product brand is untouched");
    });
    it("a PHONE_BRAND discount ignores the product brand, and a PRODUCT_BRAND discount aimed at 'Apple' does NOT hit Apple phones", async () => {
      const sp = await mk({ retail: 100_000, brand: "Spigen", variants: [{ key: "apple", model: "i12", color: "white", retail: 100_000 }, { key: "sam", model: "s23", color: "white", retail: 100_000 }] });
      const apple = await mk({ retail: 100_000, brand: "Apple", variants: [{ key: "sam", model: "s23", color: "white", retail: 100_000 }] }); // a product MADE by "Apple" fitting a Samsung
      const c = (await customer()).c;
      const d = await discount({ type: "PERCENT", value: 10, scope: "PRODUCT_BRAND", targetId: B.Apple });
      assert.equal((await cartUnit(c, sp.slug, sp.vid("apple"))).unitPrice, 100_000, "Apple *phone* on a Spigen product is not an Apple *product*");
      assert.equal((await cartUnit(c, apple.slug, apple.vid("sam"))).unitPrice, 90_000, "…but a product whose brand is Apple is");
      await db.discount.update({ where: { id: d.id }, data: { isActive: false } });
      await discount({ type: "PERCENT", value: 10, scope: "PHONE_BRAND", targetId: B.Apple });
      assert.equal((await cartUnit(c, sp.slug, sp.vid("apple"))).unitPrice, 90_000, "Apple phone variant of a Spigen product");
      assert.equal((await cartUnit(c, sp.slug, sp.vid("sam"))).unitPrice, 100_000, "Samsung phone variant");
      assert.equal((await cartUnit(c, apple.slug, apple.vid("sam"))).unitPrice, 100_000, "an Apple-made product on a Samsung phone is not an Apple phone");
    });
    it("the two admin pickers are separate and labelled; the ambiguous legacy scope cannot be created any more but old rows keep working", async () => {
      const a = ok(await admin.get(`/api/admin/pricing/targets?scope=PRODUCT_BRAND&q=Spigen`)) as { id: string; label: string }[];
      assert.ok(a.some((x) => x.id === B.Spigen && x.label.includes("سازندهٔ")));
      assert.ok(!a.some((x) => x.id === B.Samsung), "a brand with no products is not a product-brand target");
      const p = ok(await admin.get(`/api/admin/pricing/targets?scope=PHONE_BRAND&q=Apple`)) as { id: string; label: string }[];
      assert.ok(p.some((x) => x.id === B.Apple && x.label.includes("برند گوشی")));
      assert.ok(!p.some((x) => x.id === B.Spigen), "a brand with no phone models is not a phone-brand target");
      assert.equal((await admin.post("/api/admin/r/discounts", { name: "x", type: "PERCENT", value: 5, scope: "BRAND", targetId: B.Apple })).status, 422);
      // A legacy row (from the first Phase 6 cut) keeps its old meaning until an admin re-targets it.
      const sp = await mk({ retail: 100_000, brand: "Spigen", variants: [{ key: "apple", model: "i12", retail: 100_000 }] });
      const legacy = await db.discount.create({ data: { name: "قدیمی " + uid(), type: "PERCENT", value: 10, scope: "BRAND", targetId: B.Apple, isActive: true } }); made.push(legacy.id);
      assert.equal((await cartUnit((await customer()).c, sp.slug, sp.vid("apple"))).unitPrice, 90_000);
      ok(await admin.patch(`/api/admin/r/discounts/${legacy.id}`, { scope: "PHONE_BRAND" }));
      assert.equal((await db.discount.findUniqueOrThrow({ where: { id: legacy.id } })).scope, "PHONE_BRAND");
      assert.equal((await admin.patch(`/api/admin/r/discounts/${legacy.id}`, { scope: "BRAND" })).status, 422);
    });
    it("the discount list labels each brand target by its kind", async () => {
      await discount({ type: "PERCENT", value: 5, scope: "PRODUCT_BRAND", targetId: B.Spigen }); await discount({ type: "PERCENT", value: 5, scope: "PHONE_BRAND", targetId: B.Apple });
      const rows = ok(await admin.get("/api/admin/discounts?per=50")).items as any[];
      assert.ok(rows.some((r) => r.scope === "PRODUCT_BRAND" && r.targetLabel.includes("Spigen")) && rows.some((r) => r.scope === "PHONE_BRAND" && r.targetLabel.includes("Apple")));
    });
  });

  describe("Storefront sort uses the effective (payable) price", () => {
    const orderOf = async (sort: string) => {
      const html = (await new Client().get(`/shop?cat=${catSlug}&sort=${sort}`)).text;
      return [...new Set([...html.matchAll(/\/product\/(p6b-[a-z0-9]+)/g)].map((m) => m[1]!))];
    };
    it("Original → Discount → Effective: ascending/descending follow the price the customer pays, and match the prices shown on the cards", async () => {
      const tag = uid(); catSlug = "sort6b-" + tag; catId = ok(await admin.post("/api/admin/r/categories", { name: "دستهٔ مرتب‌سازی " + tag, slug: catSlug })).id; cats.push(catId); // a clean category: only this test's products
      const P: Record<string, Awaited<ReturnType<typeof mk>>> = {};
      P.promo50 = await mk({ retail: 100_000 });                                                     // 100 000 − 50 % → 50 000
      P.plain = await mk({ retail: 80_000 });                                                        // 80 000
      P.legacy = await mk({ retail: 90_000, legacy: 45_000 });                                        // legacy fixed → 45 000
      P.variant = await mk({ retail: 70_000, variants: [{ key: "cheap", model: "i12", retail: 70_000 }, { key: "dear", model: "s23", retail: 120_000 }] }); // variant −30 % → 49 000
      P.expired = await mk({ retail: 60_000 });                                                       // expired 90 % → ignored → 60 000
      P.minOrder = await mk({ retail: 65_000 });                                                      // needs a cart minimum → not shown → 65 000
      P.phone = await mk({ retail: 55_000, variants: [{ key: "apple", model: "i12", retail: 55_000 }] }); // phone brand −10 % → 49 500
      P.pbrand = await mk({ retail: 90_000, brand: "Baseus" });                                       // product brand −25 % → 67 500
      P.exhausted = await mk({ retail: 95_000 });                                                     // capacity used up → 95 000
      await discount({ type: "PERCENT", value: 50, scope: "PRODUCT", targetId: P.promo50!.id });
      await discount({ type: "PERCENT", value: 30, scope: "VARIANT", targetId: P.variant!.vid("cheap") });
      await discount({ type: "PERCENT", value: 90, scope: "PRODUCT", targetId: P.expired!.id, startsAt: iso(-3 * DAY), endsAt: iso(-DAY) });
      await discount({ type: "PERCENT", value: 50, scope: "PRODUCT", targetId: P.minOrder!.id, minOrder: 500_000 });
      await discount({ type: "PERCENT", value: 10, scope: "PHONE_BRAND", targetId: B.Apple });          // also touches the Apple variants of the other products above (none of them are Apple-modelled except phone/variant)
      await discount({ type: "PERCENT", value: 25, scope: "PRODUCT_BRAND", targetId: B.Baseus });
      const ex = await discount({ type: "PERCENT", value: 60, scope: "PRODUCT", targetId: P.exhausted!.id, usageLimit: 1 }); await db.discount.update({ where: { id: ex.id }, data: { usedCount: 1 } });

      // Prices as the storefront shows them (TypeScript engine) …
      const catalog = (await (await fetch("http://localhost:3300/catalog.json")).json()) as { id: string; price: number }[];
      const shown = new Map(catalog.filter((c) => c.id.startsWith("p6b-")).map((c) => [c.id, c.price]));
      assert.equal(shown.get(P.promo50!.slug), 50_000); assert.equal(shown.get(P.legacy!.slug), 45_000); assert.equal(shown.get(P.variant!.slug), 49_000);
      assert.equal(shown.get(P.phone!.slug), 49_500); assert.equal(shown.get(P.pbrand!.slug), 67_500); assert.equal(shown.get(P.expired!.slug), 60_000); assert.equal(shown.get(P.minOrder!.slug), 65_000); assert.equal(shown.get(P.exhausted!.slug), 95_000); assert.equal(shown.get(P.plain!.slug), 80_000);
      // … must be exactly the order the SQL sort returns.
      const expected = [...Object.values(P)].map((p) => p.slug).sort((a, b) => shown.get(a)! - shown.get(b)!);
      assert.deepEqual(await orderOf("asc"), expected);
      assert.deepEqual(await orderOf("desc"), [...expected].reverse());
      assert.deepEqual(expected.map((s) => shown.get(s)), [45_000, 49_000, 49_500, 50_000, 60_000, 65_000, 67_500, 80_000, 95_000]);

      // Turning the promotion off moves the product: sorting follows what is payable right now.
      await db.discount.updateMany({ where: { scope: "PRODUCT", targetId: P.promo50!.id }, data: { isActive: false } });
      const after = await orderOf("asc"); assert.equal(after.at(-1), P.promo50!.slug, "100 000 is now the most expensive");
    });
    it("the default sort and other sorts still work, and no client-side price is involved (the page only renders server output)", async () => {
      for (const s of ["default", "newest", "popular", "rating"]) assert.equal((await new Client().get(`/shop?cat=${catSlug}&sort=${s}`)).status, 200, s);
      assert.equal((await new Client().get(`/shop?cat=${catSlug}&sort=asc'; DROP TABLE "Product";--`)).status, 200);
      assert.ok((await db.product.count()) > 0);
    });
  });

  describe("Wholesale vs retail policy", () => {
    it("default policy keeps the old guarantee (wholesale never above retail) with a clear 400", async () => {
      const p = await mk({ retail: 100_000, wholesale: 80_000 });
      const r = await admin.patch(`/api/admin/products/${p.id}`, { wholesalePrice: 100_001 }); assert.equal(r.status, 400); assert.equal(r.json.error.code, "wholesale_policy");
      ok(await admin.patch(`/api/admin/products/${p.id}`, { wholesalePrice: 100_000 }));
      assert.equal((await admin.post("/api/admin/products", { name: "ناسازگار", slug: "bad-" + uid(), sku: "BAD-" + uid(), categoryId: catId, retailPrice: 100_000, wholesalePrice: 150_000, variants: [{ sku: "BADV-" + uid(), stock: 1 }] })).status, 400);
    });
    it("minimum and maximum distance are configurable and enforced when saving, with the allowed range in the message", async () => {
      try {
        ok(await setPolicy({ minDiscountPercent: 10 }));
        const p = await mk({ retail: 100_000, wholesale: 85_000 });
        const r = await admin.patch(`/api/admin/products/${p.id}`, { wholesalePrice: 95_000 }); assert.equal(r.status, 400); assert.match(r.json.error.message, /۹۰٬۰۰۰/);
        ok(await admin.patch(`/api/admin/products/${p.id}`, { wholesalePrice: 90_000 }));
        ok(await setPolicy({ minDiscountPercent: 0, maxDiscountPercent: 30 }));
        const q = await mk({ retail: 100_000, wholesale: 80_000 });
        assert.equal((await admin.patch(`/api/admin/products/${q.id}`, { wholesalePrice: 60_000 })).status, 400); ok(await admin.patch(`/api/admin/products/${q.id}`, { wholesalePrice: 70_000 }));
        // variant-level pair is judged too (variant retail price vs its own / inherited wholesale price)
        const v = await mk({ retail: 100_000, wholesale: 90_000, variants: [{ key: "a", retail: 100_000 }] });
        const cur = ok(await admin.get(`/api/admin/products/${v.id}`));
        assert.equal((await admin.patch(`/api/admin/products/${v.id}`, { variants: cur.variants.map((x: any) => ({ id: x.id, sku: x.sku, name: x.name, retailPrice: 500_000, wholesalePrice: 100_000, isActive: true })) })).status, 400);
      } finally { ok(await setPolicy({})); }
    });
    it("the policy setting validates itself", async () => {
      assert.equal((await admin.put("/api/admin/settings/wholesalePolicy", { minDiscountPercent: 20, maxDiscountPercent: 10, capAtRetail: true })).status, 422);
      assert.equal((await admin.put("/api/admin/settings/wholesalePolicy", { minDiscountPercent: -1, maxDiscountPercent: 0, capAtRetail: true })).status, 422);
      assert.equal((await manager.put("/api/admin/settings/wholesalePolicy", DEFAULT_POLICY)).status, 403);
    });
    it("tightening the policy never rewrites stored prices; conflicts are reported; unrelated edits still work, bad price edits do not", async () => {
      const p = await mk({ retail: 100_000, wholesale: 95_000 });
      try {
        ok(await setPolicy({ minDiscountPercent: 10 }));
        assert.equal((await db.product.findUniqueOrThrow({ where: { id: p.id } })).wholesalePrice, 95_000, "nothing was rewritten");
        const rep = ok(await admin.get("/api/admin/pricing/wholesale")); assert.ok(rep.conflictCount >= 1); assert.ok(rep.items.some((i: any) => i.productId === p.id && i.problem));
        const tbl = ok(await admin.get(`/api/admin/pricing?q=${encodeURIComponent(p.slug)}`)); assert.ok(tbl.items[0].wholesaleProblem, "flagged in the pricing table");
        ok(await admin.patch(`/api/admin/products/${p.id}`, { name: "نام تازه " + uid() })); // unrelated edit is not blocked
        assert.equal((await admin.patch(`/api/admin/products/${p.id}`, { retailPrice: 101_000 })).status, 400); // a price edit that leaves it invalid is
        ok(await admin.patch(`/api/admin/products/${p.id}`, { retailPrice: 110_000 }));                       // …and one that fixes it is fine (95 000 ≤ 99 000)
        assert.equal((await manager.get("/api/admin/pricing/wholesale")).status, 403);
      } finally { ok(await setPolicy({})); }
    });
    it("automatic prices that would break the relationship are NOT applied: rule preview/save skip them, a product edit fails atomically", async () => {
      const P = await mk({ mode: "AUTOMATIC", retail: 0, wholesale: 380_000, variants: [{ key: "a", cost: 300_000, retail: 0 }] });
      ok(await admin.post("/api/admin/pricing/rules", { scope: "PRODUCT", targetId: P.id, marginType: "PERCENT", marginValue: 30 }));
      assert.equal((await variantRow(P.vid("a"))).retailPrice, 390_000);
      const pre = ok(await admin.post("/api/admin/pricing/rules", { scope: "PRODUCT", targetId: P.id, marginType: "PERCENT", marginValue: 10, preview: true }));
      assert.ok(pre.result.wholesaleConflictCount >= 1); assert.ok(pre.result.skipped.some((x: any) => x.sku.includes(P.slug) && x.code === "wholesale" && x.reason.includes("قیمت عمده")));
      const saved = ok(await admin.post("/api/admin/pricing/rules", { scope: "PRODUCT", targetId: P.id, marginType: "PERCENT", marginValue: 10 }));
      assert.ok(saved.result.skipped.some((x: any) => x.sku.includes(P.slug) && x.code === "wholesale"));
      assert.equal((await variantRow(P.vid("a"))).retailPrice, 390_000, "the old (valid) price stays");
      const cur = ok(await admin.get(`/api/admin/products/${P.id}`));
      const r = await admin.patch(`/api/admin/products/${P.id}`, { variants: cur.variants.map((v: any) => ({ id: v.id, sku: v.sku, name: v.name, costPrice: 200_000, pricingMode: "AUTOMATIC", isActive: true })) });
      assert.equal(r.status, 400); assert.equal(r.json.error.code, "wholesale_policy");
      assert.equal((await variantRow(P.vid("a"))).costPrice, 300_000, "the failed edit changed nothing");
    });
    it("bulk manual price changes and cost changes skip items whose new price would break the relationship", async () => {
      const P = await mk({ retail: 200_000, wholesale: 150_000, variants: [{ key: "a", retail: 200_000 }] });
      const pre = ok(await admin.post("/api/admin/pricing/bulk", { preview: true, filter: { productIds: [P.id] }, op: { kind: "price_percent", value: -50 } }));
      assert.equal(pre.result.changedCount, 0); assert.equal(pre.result.skippedCount, 1); assert.ok(pre.result.rows[0].note.includes("قیمت عمده"));
      ok(await admin.post("/api/admin/pricing/bulk", { preview: false, filter: { productIds: [P.id] }, op: { kind: "price_percent", value: -50 } }));
      assert.equal((await variantRow(P.vid("a"))).retailPrice, 200_000);
      ok(await admin.post("/api/admin/pricing/bulk", { preview: false, filter: { productIds: [P.id] }, op: { kind: "price_percent", value: -10 } }));
      assert.equal((await variantRow(P.vid("a"))).retailPrice, 180_000);
    });
    it("capAtRetail: a partner never pays more than the public price of the day (and the switch is honoured)", async () => {
      const P = await mk({ retail: 100_000, wholesale: 90_000, minQty: 2, variants: [{ key: "a", retail: 100_000 }] });
      await discount({ type: "PERCENT", value: 30, scope: "PRODUCT", targetId: P.id });
      try {
        ok(await setPolicy({ capAtRetail: true }));
        const capped = await cartUnit(partner, P.slug, P.vid("a"), 2);
        assert.equal(capped.priceType, "wholesale"); assert.equal(capped.unitPrice, 70_000, "public price after the promotion"); assert.equal(capped.discountLabel, "سقف قیمت خرده");
        ok(await setPolicy({ capAtRetail: false }));
        assert.equal((await cartUnit(partner, P.slug, P.vid("a"), 2)).unitPrice, 90_000, "cap switched off → the typed wholesale price");
      } finally { ok(await setPolicy({})); await partner.del("/api/cart/coupon"); }
    });
    it("without any promotion the partner keeps the normal wholesale price (existing wholesale behaviour is unchanged)", async () => {
      const P = await mk({ retail: 100_000, wholesale: 70_000, minQty: 2, variants: [{ key: "a", retail: 100_000 }] });
      assert.equal((await cartUnit(partner, P.slug, P.vid("a"), 2)).unitPrice, 70_000);
    });
  });
});
