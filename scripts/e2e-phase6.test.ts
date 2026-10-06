/**
 * Phase 6 integration tests: product variants (brand → model → colour), pricing engine, discounts, snapshots, bulk pricing, authorization, audit.
 * Server must be running in production mode:  ALLOW_INSECURE_HTTP=1 TRUST_PROXY=1 npm start -- -p 3300
 */
import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { Client, db, loginWithPassword, registerAndLogin, uid } from "./test-utils";

let admin: Client, manager: Client, freeShip = "", catId = "", catId2 = "";
const ok = (r: { status: number; json: any }, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.json)); return r.json?.data; };
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();
const DAY = 86_400_000;
const brands: Record<string, string> = {}, models: Record<string, string> = {}, colors: Record<string, string> = {};
let savedGlobal: { marginType: "PERCENT" | "FIXED"; marginValue: number; roundTo: number; isActive: boolean } | null = null;

interface VIn { key: string; model?: string; color?: string; stock?: number; cost?: number; mode?: "AUTOMATIC" | "MANUAL"; retailPrice?: number }
async function mkProduct(o: { variants: VIn[]; mode?: "AUTOMATIC" | "MANUAL"; retailPrice?: number; cost?: number; category?: string; legacyDiscount?: number; name?: string }) {
  const s = "p6-" + uid();
  const body = {
    name: o.name ?? "قاب تست " + s, slug: s, sku: "SKU-" + s, categoryId: o.category ?? catId, pricingMode: o.mode ?? "MANUAL", ...(o.retailPrice !== undefined ? { retailPrice: o.retailPrice } : {}), ...(o.cost !== undefined ? { costPrice: o.cost } : {}), ...(o.legacyDiscount ? { retailDiscount: o.legacyDiscount } : {}),
    variants: o.variants.map((v) => ({ sku: `V-${s}-${v.key}`, phoneModelId: v.model ? models[v.model] : null, colorId: v.color ? colors[v.color] : null, costPrice: v.cost, pricingMode: v.mode ?? o.mode ?? "MANUAL", ...(v.retailPrice !== undefined ? { retailPrice: v.retailPrice } : {}), stock: v.stock ?? 10 })),
  };
  const p = ok(await admin.post("/api/admin/products", body));
  const vs = p.variants as { id: string; sku: string; retailPrice: number | null }[];
  return { id: p.id as string, slug: s, product: p, vid: (key: string) => vs.find((v) => v.sku === `V-${s}-${key}`)!.id };
}
const rule = (scope: string, targetId: string, marginValue: number, extra: Record<string, unknown> = {}) => admin.post("/api/admin/pricing/rules", { scope, targetId, marginType: "PERCENT", marginValue, ...extra });
const madeDiscounts: string[] = [];
const discount = async (d: Record<string, unknown>) => { const x = ok(await admin.post("/api/admin/r/discounts", { name: "تخفیف تست " + uid(), isActive: true, ...d })); madeDiscounts.push(x.id); return x; };
async function customer() {
  const r = await registerAndLogin();
  const a = await r.c.post("/api/addresses", { receiver: "تست", phone: "09121234567", province: "تهران", city: "تهران", postalCode: "1234567890", address: "خیابان ولیعصر، پلاک ۱۰" });
  return { ...r, addressId: ok(a).id as string };
}
type Cust = Awaited<ReturnType<typeof customer>>;
const add = (cu: Cust, slug: string, variantId?: string, quantity = 1) => cu.c.post("/api/cart/items", { productSlug: slug, ...(variantId ? { variantId } : {}), quantity });
const cartLine = async (cu: Cust, variantId: string) => (ok(await cu.c.get("/api/cart")).lines as any[]).find((l) => l.variantId === variantId);
const place = (cu: Cust, extra: Record<string, unknown> = {}) => cu.c.post("/api/checkout/orders", { addressId: cu.addressId, shippingMethodId: freeShip, paymentMethod: "card_to_card", useWallet: false, redeemPoints: 0, ...extra });
const variantRow = (id: string) => db.productVariant.findUniqueOrThrow({ where: { id } });
const stockOf = async (variantId: string) => (await db.inventory.findUniqueOrThrow({ where: { variantId } })).quantity;
const logs = (action: string) => db.adminLog.count({ where: { action } });

describe("Phase 6 — variants, pricing engine, discounts", () => {
  before(async () => {
    await db.rateLimit.deleteMany({});
    admin = await loginWithPassword("09120000001", "Admin@12345");
    manager = await loginWithPassword("09120000006", "Manager@12345");
    freeShip = ok(await admin.post("/api/admin/r/shipping", { key: "free6-" + uid(), name: "تحویل حضوری تست", cost: 0 })).id;
    ok(await admin.put("/api/admin/settings/loyalty", { enabled: false, amountPerPoint: 10000, earnOn: "payment", minOrderTotal: 0, redeemEnabled: false, pointValue: 100, minRedeemPoints: 100, maxRedeemPercent: 30 }));
    const g = await db.pricingRule.findUnique({ where: { scope_targetId: { scope: "GLOBAL", targetId: "" } } });
    savedGlobal = g ? { marginType: g.marginType, marginValue: g.marginValue, roundTo: g.roundTo, isActive: g.isActive } : null;
    const tag = uid();
    catId = ok(await admin.post("/api/admin/r/categories", { name: "دستهٔ آزمون " + tag, slug: "cat6-" + tag })).id;
    catId2 = ok(await admin.post("/api/admin/r/categories", { name: "دستهٔ دوم " + tag, slug: "cat6b-" + tag })).id;
    for (const b of ["Apple", "Samsung"]) brands[b] = ok(await admin.post("/api/admin/r/brands", { name: `${b} ${tag}`, slug: `${b.toLowerCase()}-${tag}` })).id;
    const mk = async (key: string, brand: string, name: string) => { models[key] = ok(await admin.post("/api/admin/r/phone-models", { name: `${name} ${tag}`, slug: `${key}-${tag}`, brandId: brands[brand] })).id; };
    await mk("i12", "Apple", "iPhone 12"); await mk("i13", "Apple", "iPhone 13"); await mk("s23", "Samsung", "Galaxy S23");
    for (const [k, n] of [["white", "سفید یخی"], ["black", "مشکی"]]) colors[k!] = ok(await admin.post("/api/admin/r/colors", { name: `${n} ${tag}`, hex: k === "white" ? "#F2F7FA" : "#111111" })).id;
  });
  // Promotions from one test must never leak into the next (brands/models/categories are shared across the file).
  const madeCats: string[] = []; // test categories are switched off afterwards so they never pile up in the storefront menu
  afterEach(async () => { if (madeCats.length) await db.category.updateMany({ where: { id: { in: madeCats.splice(0) } }, data: { isActive: false } });
    if (madeDiscounts.length) await db.discount.updateMany({ where: { id: { in: madeDiscounts.splice(0) } }, data: { isActive: false } }); });
  after(async () => {
    // Keep the dev database's storefront small: test categories/brands/models/colours are retired (deactivated), not deleted.
    await db.category.updateMany({ where: { id: { in: [catId, catId2] } }, data: { isActive: false } });
    await db.brand.updateMany({ where: { id: { in: Object.values(brands) } }, data: { isActive: false } });
    await db.phoneModel.updateMany({ where: { id: { in: Object.values(models) } }, data: { isActive: false } });
    await db.color.updateMany({ where: { id: { in: Object.values(colors) } }, data: { isActive: false } });
    if (savedGlobal) await db.pricingRule.upsert({ where: { scope_targetId: { scope: "GLOBAL", targetId: "" } }, update: savedGlobal, create: { scope: "GLOBAL", targetId: "", ...savedGlobal } });
    else await db.pricingRule.deleteMany({ where: { scope: "GLOBAL" } });
    await db.$disconnect();
  });

  describe("Variants: brand → model → colour, independent stock", () => {
    it("Apple → iPhone 12 → سفید یخی selects exactly that variant; the page ships the whole matrix", async () => {
      const P = await mkProduct({ retailPrice: 200_000, variants: [{ key: "a", model: "i12", color: "white" }, { key: "b", model: "i12", color: "black" }, { key: "c", model: "i13", color: "white" }, { key: "d", model: "s23", color: "black" }] });
      const cu = await customer();
      ok(await add(cu, P.slug, P.vid("a")));
      const line = await cartLine(cu, P.vid("a"));
      assert.match(line.option, /iPhone 12/); assert.match(line.option, /سفید یخی/);
      assert.equal((await add(cu, P.slug)).status, 400); // no variant chosen for a variant product
      const page = await new Client().get(`/product/${P.slug}`);
      for (const s of ["iPhone 13", "Galaxy S23", "Apple", "Samsung"]) assert.ok(page.text.includes(s), s);
    });
    it("two colours keep independent stock; buying black leaves white untouched", async () => {
      const P = await mkProduct({ retailPrice: 100_000, variants: [{ key: "w", model: "i12", color: "white", stock: 10 }, { key: "k", model: "i12", color: "black", stock: 3 }] });
      const cu = await customer(); ok(await add(cu, P.slug, P.vid("k"), 1)); ok(await place(cu));
      assert.equal(await stockOf(P.vid("k")), 2); assert.equal(await stockOf(P.vid("w")), 10);
    });
    it("the same model + colour cannot be defined twice for one product", async () => {
      const s = "dup-" + uid();
      const r = await admin.post("/api/admin/products", { name: "تکراری " + s, slug: s, sku: "SKU-" + s, categoryId: catId, retailPrice: 1000, variants: [{ sku: "A-" + s, phoneModelId: models.i12, colorId: colors.white, stock: 1 }, { sku: "B-" + s, phoneModelId: models.i12, colorId: colors.white, stock: 1 }] });
      assert.equal(r.status, 409, JSON.stringify(r.json));
    });
    it("an out-of-stock variant cannot be added; a partly available one is limited to its stock", async () => {
      const P = await mkProduct({ retailPrice: 100_000, variants: [{ key: "z", model: "i13", color: "black", stock: 0 }, { key: "o", model: "i13", color: "white", stock: 2 }] });
      const cu = await customer();
      const r = await add(cu, P.slug, P.vid("z")); assert.equal(r.status, 409); assert.equal(r.json.error.code, "out_of_stock");
      assert.equal((await add(cu, P.slug, P.vid("o"), 3)).status, 409);
    });
    it("concurrent buyers can never oversell a variant (3 in stock, 6 buyers → exactly 3 orders)", async () => {
      const P = await mkProduct({ retailPrice: 100_000, variants: [{ key: "r", model: "s23", color: "black", stock: 3 }] });
      const cs = await Promise.all(Array.from({ length: 6 }, () => customer()));
      for (const c of cs) ok(await add(c, P.slug, P.vid("r")));
      const res = await Promise.all(cs.map((c) => place(c)));
      assert.equal(res.filter((r) => r.status === 200).length, 3, res.map((r) => r.status).join());
      assert.equal(await stockOf(P.vid("r")), 0);
    });
  });

  describe("Pricing engine", () => {
    it("cost + margin → selling price (300 000 @30 % = 390 000; 350 000 @30 % = 455 000)", async () => {
      const P = await mkProduct({ mode: "AUTOMATIC", variants: [{ key: "a", model: "i12", color: "white", cost: 300_000 }, { key: "b", model: "i13", color: "white", cost: 350_000 }] });
      ok(await rule("PRODUCT", P.id, 30));
      assert.equal((await variantRow(P.vid("a"))).retailPrice, 390_000); assert.equal((await variantRow(P.vid("b"))).retailPrice, 455_000);
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: P.id } })).retailPrice, 390_000, "container product lists the cheapest variant");
    });
    it("changing the purchase cost reprices automatically and records history (old/new cost and price)", async () => {
      const P = await mkProduct({ mode: "AUTOMATIC", variants: [{ key: "a", model: "i12", color: "white", cost: 300_000 }] });
      ok(await rule("PRODUCT", P.id, 30));
      const cur = ok(await admin.get(`/api/admin/products/${P.id}`));
      ok(await admin.patch(`/api/admin/products/${P.id}`, { variants: cur.variants.map((v: any) => ({ id: v.id, sku: v.sku, name: v.name, phoneModelId: v.phoneModelId, colorId: v.colorId, costPrice: 400_000, pricingMode: "AUTOMATIC", isActive: true })) }));
      assert.equal((await variantRow(P.vid("a"))).retailPrice, 520_000);
      const h = await db.priceHistory.findFirstOrThrow({ where: { variantId: P.vid("a"), newPrice: 520_000 } });
      assert.equal(h.oldPrice, 390_000); assert.equal(h.oldCost, 300_000); assert.equal(h.newCost, 400_000); assert.ok(h.adminId);
    });
    it("rule inheritance: variant > product > category > global; Manual Override beats every rule", async () => {
      ok(await rule("GLOBAL", "", 10));
      const P1 = await mkProduct({ mode: "AUTOMATIC", category: catId2, variants: [{ key: "a", cost: 100_000 }] });        // global 10 % (until category rule)
      ok(await rule("CATEGORY", catId2, 20));                                                                          // category 20 %
      assert.equal((await variantRow(P1.vid("a"))).retailPrice, 120_000);
      const P2 = await mkProduct({ mode: "AUTOMATIC", category: catId2, variants: [{ key: "a", cost: 100_000 }, { key: "b", cost: 100_000 }, { key: "m", cost: 100_000, mode: "MANUAL", retailPrice: 999_000 }] });
      ok(await rule("PRODUCT", P2.id, 30)); ok(await rule("VARIANT", P2.vid("b"), 40));
      assert.equal((await variantRow(P2.vid("a"))).retailPrice, 130_000, "product rule beats category");
      assert.equal((await variantRow(P2.vid("b"))).retailPrice, 140_000, "variant rule beats product");
      assert.equal((await variantRow(P2.vid("m"))).retailPrice, 999_000, "manual override ignores every rule");
      ok(await rule("GLOBAL", "", 50));
      assert.equal((await variantRow(P2.vid("m"))).retailPrice, 999_000);
    });
    it("rule preview shows the impact without changing anything; save then applies it", async () => {
      const P = await mkProduct({ mode: "AUTOMATIC", variants: [{ key: "a", cost: 200_000 }] });
      ok(await rule("PRODUCT", P.id, 10));
      const before = (await variantRow(P.vid("a"))).retailPrice;
      const pre = ok(await rule("PRODUCT", P.id, 50, { preview: true }));
      assert.equal(pre.preview, true); assert.ok(pre.result.changes.some((c: any) => c.sku === `V-${P.slug}-a` && c.newPrice === 300_000));
      assert.equal((await variantRow(P.vid("a"))).retailPrice, before);
      ok(await rule("PRODUCT", P.id, 50)); assert.equal((await variantRow(P.vid("a"))).retailPrice, 300_000);
    });
    it("automatic pricing without a cost or rule is rejected gracefully (nothing invented)", async () => {
      const P = await mkProduct({ mode: "AUTOMATIC", variants: [{ key: "a" }] }); // no cost, no product rule (other levels may exist)
      const v = await variantRow(P.vid("a"));
      assert.ok(v.retailPrice === null || v.retailPrice >= 0);
      assert.equal(v.costPrice, null);
    });
    it("the storefront price is the engine's price (product page JSON-LD and card)", async () => {
      const P = await mkProduct({ mode: "AUTOMATIC", variants: [{ key: "a", model: "i12", color: "white", cost: 300_000 }] });
      ok(await rule("PRODUCT", P.id, 30));
      const html = (await new Client().get(`/product/${P.slug}`)).text;
      assert.ok(html.includes("3900000"), "schema.org price = 390 000 Toman × 10 (IRR)");
    });
  });

  describe("Discounts", () => {
    const priced = async (P: Awaited<ReturnType<typeof mkProduct>>, key: string, qty = 1, cu?: Cust) => { const c = cu ?? (await customer()); ok(await add(c, P.slug, P.vid(key), qty)); return { c, line: await cartLine(c, P.vid(key)) }; };
    it("percentage discount on ONE variant only (iPhone 12 white −20 %, black untouched)", async () => {
      const P = await mkProduct({ retailPrice: 500_000, variants: [{ key: "w", model: "i12", color: "white" }, { key: "k", model: "i12", color: "black" }] });
      await discount({ type: "PERCENT", value: 20, scope: "VARIANT", targetId: P.vid("w") });
      const w = await priced(P, "w"); assert.equal(w.line.unitPrice, 400_000); assert.equal(w.line.originalPrice, 500_000); assert.equal(w.line.discountAmount, 100_000);
      assert.equal((await priced(P, "k")).line.unitPrice, 500_000);
    });
    it("fixed-amount discount on a product, on a category, on a brand and on a model", async () => {
      const P = await mkProduct({ retailPrice: 500_000, variants: [{ key: "a", model: "i12", color: "white" }, { key: "s", model: "s23", color: "white" }] });
      await discount({ type: "FIXED", value: 50_000, scope: "PRODUCT", targetId: P.id });
      assert.equal((await priced(P, "a")).line.unitPrice, 450_000);
      const Q = await mkProduct({ retailPrice: 300_000, variants: [{ key: "a", model: "i12", color: "white" }, { key: "s", model: "s23", color: "white" }] });
      await discount({ type: "PERCENT", value: 10, scope: "PHONE_BRAND", targetId: brands.Apple });
      assert.equal((await priced(Q, "a")).line.unitPrice, 270_000, "phone brand applies to that brand's variants");
      assert.equal((await priced(Q, "s")).line.unitPrice, 300_000, "…and not to another brand");
      const R = await mkProduct({ retailPrice: 100_000, category: catId2, variants: [{ key: "a" }] });
      await discount({ type: "PERCENT", value: 25, scope: "CATEGORY", targetId: catId2 });
      assert.equal((await priced(R, "a")).line.unitPrice, 75_000);
      const M = await mkProduct({ retailPrice: 200_000, variants: [{ key: "a", model: "i13", color: "white" }] });
      await discount({ type: "FIXED", value: 20_000, scope: "MODEL", targetId: models.i13 });
      assert.equal((await priced(M, "a")).line.unitPrice, 180_000);
    });
    it("time-limited: not started / expired do nothing, the active window applies", async () => {
      const P = await mkProduct({ retailPrice: 100_000, variants: [{ key: "a" }] });
      await discount({ type: "PERCENT", value: 50, scope: "PRODUCT", targetId: P.id, startsAt: iso(DAY) });
      await discount({ type: "PERCENT", value: 50, scope: "PRODUCT", targetId: P.id, startsAt: iso(-3 * DAY), endsAt: iso(-DAY) });
      assert.equal((await priced(P, "a")).line.unitPrice, 100_000);
      await discount({ type: "PERCENT", value: 10, scope: "PRODUCT", targetId: P.id, startsAt: iso(-DAY), endsAt: iso(DAY) });
      assert.equal((await priced(P, "a")).line.unitPrice, 90_000);
    });
    it("a disabled discount never applies; an invalid target or percent > 100 is refused", async () => {
      const P = await mkProduct({ retailPrice: 100_000, variants: [{ key: "a" }] });
      await discount({ type: "PERCENT", value: 40, scope: "PRODUCT", targetId: P.id, isActive: false });
      assert.equal((await priced(P, "a")).line.unitPrice, 100_000);
      assert.equal((await admin.post("/api/admin/r/discounts", { name: "x", type: "PERCENT", value: 120, scope: "ALL" })).status, 409);
      assert.equal((await admin.post("/api/admin/r/discounts", { name: "x", type: "FIXED", value: 10, scope: "PRODUCT", targetId: "nope" })).status, 409);
      assert.equal((await admin.post("/api/admin/r/discounts", { name: "x", type: "FIXED", value: 10, scope: "PRODUCT" })).status, 409);
    });
    it("discounts never stack: the single best one wins (also against the legacy product discount)", async () => {
      const P = await mkProduct({ retailPrice: 100_000, legacyDiscount: 5_000, variants: [{ key: "a" }] });
      await discount({ type: "PERCENT", value: 10, scope: "PRODUCT", targetId: P.id });
      await discount({ type: "FIXED", value: 8_000, scope: "PRODUCT", targetId: P.id });
      assert.equal((await priced(P, "a")).line.unitPrice, 90_000); // best = 10 %, not 10 % + 8 000 + 5 000
    });
    it("minimum order: applies only once the cart's retail subtotal reaches it", async () => {
      const P = await mkProduct({ retailPrice: 100_000, variants: [{ key: "a", stock: 50 }] });
      await discount({ type: "PERCENT", value: 10, scope: "PRODUCT", targetId: P.id, minOrder: 300_000 });
      const { c, line } = await priced(P, "a", 2); assert.equal(line.unitPrice, 100_000);
      ok(await add(c, P.slug, P.vid("a"), 1)); assert.equal((await cartLine(c, P.vid("a"))).unitPrice, 90_000);
    });
    it("usage limits: global capacity and per-user limit are enforced atomically and given back on cancel", async () => {
      const P = await mkProduct({ retailPrice: 100_000, variants: [{ key: "a", stock: 50 }] });
      const d = await discount({ type: "PERCENT", value: 20, scope: "PRODUCT", targetId: P.id, usageLimit: 1, perUserLimit: 1 });
      const a = await customer(); ok(await add(a, P.slug, P.vid("a")));
      const order = ok(await place(a)); assert.equal(order.total, 80_000);
      assert.equal((await db.discount.findUniqueOrThrow({ where: { id: d.id } })).usedCount, 1);
      const b = await customer(); ok(await add(b, P.slug, P.vid("a")));
      assert.equal((await cartLine(b, P.vid("a"))).unitPrice, 100_000, "global capacity used up");
      ok(await a.c.post(`/api/orders/${order.number}/cancel`, {}));
      assert.equal((await db.discount.findUniqueOrThrow({ where: { id: d.id } })).usedCount, 0, "cancel gives the use back");
      assert.equal((await cartLine(b, P.vid("a"))).unitPrice, 80_000);
      ok(await place(b)); // b consumes it; b's own second order must not get it (per-user limit 1)
      ok(await add(b, P.slug, P.vid("a"))); assert.equal((await cartLine(b, P.vid("a"))).unitPrice, 100_000);
    });
    it("Coupon after discount: the coupon applies to the already-discounted retail subtotal, discounts never double", async () => {
      const P = await mkProduct({ retailPrice: 100_000, variants: [{ key: "a", stock: 50 }] });
      await discount({ type: "PERCENT", value: 10, scope: "PRODUCT", targetId: P.id });
      const code = "P6" + uid().toUpperCase(); ok(await admin.post("/api/admin/r/coupons", { code, type: "fixed", value: 5_000, usageLimit: 5 }));
      const cu = await customer(); ok(await add(cu, P.slug, P.vid("a"), 2)); ok(await cu.c.post("/api/cart/coupon", { code }));
      const q = ok(await cu.c.get(`/api/checkout/quote?shippingMethodId=${freeShip}`));
      assert.equal(q.subtotal, 180_000); assert.equal(q.discount, 5_000); assert.equal(q.total, 175_000);
      const cartView = ok(await cu.c.get("/api/cart")); assert.equal(cartView.subtotal, q.subtotal, "cart and checkout agree to the Toman");
      assert.equal(ok(await place(cu)).total, 175_000);
    });
    it("wholesale partners keep their own pricing: promotions do not stack on it (the wholesale-policy cap at the public price is tested in phase 6b)", async () => {
      const P = await mkProduct({ retailPrice: 100_000, variants: [{ key: "a", stock: 50 }] });
      await admin.patch(`/api/admin/products/${P.id}`, { wholesalePrice: 70_000, minWholesaleQty: 2 });
      await discount({ type: "PERCENT", value: 10, scope: "PRODUCT", targetId: P.id }); // public price 90 000, still above the 70 000 wholesale price
      const partner = await loginWithPassword("09120000003", "Partner@12345");
      ok(await add({ c: partner } as Cust, P.slug, P.vid("a"), 2));
      const line = (ok(await partner.get("/api/cart")).lines as any[]).find((l) => l.variantId === P.vid("a"));
      assert.equal(line.priceType, "wholesale"); assert.equal(line.unitPrice, 70_000, "10 % promotion is not applied on top of wholesale");
    });
  });

  describe("Checkout safety and snapshots", () => {
    it("a price change between quote and order is detected (409 price_changed), never charged silently", async () => {
      const P = await mkProduct({ retailPrice: 100_000, variants: [{ key: "a", model: "i12", color: "white", stock: 20 }] });
      const cu = await customer(); ok(await add(cu, P.slug, P.vid("a")));
      const q1 = ok(await cu.c.get(`/api/checkout/quote?shippingMethodId=${freeShip}`)); assert.ok(q1.priceHash);
      ok(await admin.patch(`/api/admin/products/${P.id}`, { variants: [{ id: P.vid("a"), sku: `V-${P.slug}-a`, phoneModelId: models.i12, colorId: colors.white, retailPrice: 120_000, isActive: true }] }));
      const r = await place(cu, { priceHash: q1.priceHash });
      assert.equal(r.status, 409); assert.equal(r.json.error.code, "price_changed");
      const q2 = ok(await cu.c.get(`/api/checkout/quote?shippingMethodId=${freeShip}`)); assert.equal(q2.total, 120_000); assert.notEqual(q2.priceHash, q1.priceHash);
      assert.equal(ok(await place(cu, { priceHash: q2.priceHash })).total, 120_000);
    });
    it("the client cannot choose prices: extra price fields in the order body are ignored", async () => {
      const P = await mkProduct({ retailPrice: 100_000, variants: [{ key: "a", stock: 20 }] });
      const cu = await customer(); ok(await add(cu, P.slug, P.vid("a")));
      const o = ok(await place(cu, { total: 1, unitPrice: 1, subtotal: 1, items: [{ unitPrice: 1 }] })); assert.equal(o.total, 100_000);
    });
    it("Order snapshot keeps product, variant, brand, model, colour, original/unit price, discount, coupon share and totals", async () => {
      const P = await mkProduct({ retailPrice: 200_000, variants: [{ key: "a", model: "i12", color: "white", stock: 20 }, { key: "b", model: "i13", color: "black", stock: 20 }] });
      const d = await discount({ type: "PERCENT", value: 10, scope: "VARIANT", targetId: P.vid("a"), name: "جشنوارهٔ اسنپ‌شات" });
      const code = "S6" + uid().toUpperCase(); ok(await admin.post("/api/admin/r/coupons", { code, type: "fixed", value: 9_000, usageLimit: 5 }));
      const cu = await customer(); ok(await add(cu, P.slug, P.vid("a"), 2)); ok(await add(cu, P.slug, P.vid("b"), 1)); ok(await cu.c.post("/api/cart/coupon", { code }));
      const o = ok(await place(cu));
      const items = await db.orderItem.findMany({ where: { orderId: o.id }, orderBy: { unitPrice: "asc" } });
      const a = items.find((i) => i.variantId === P.vid("a"))!, b = items.find((i) => i.variantId === P.vid("b"))!;
      assert.equal(a.productId, P.id); assert.match(a.modelName!, /iPhone 12/); assert.match(a.brandName!, /Apple/); assert.match(a.colorName!, /سفید یخی/);
      assert.equal(a.originalPrice, 200_000); assert.equal(a.discountAmount, 20_000); assert.equal(a.discountLabel, "جشنوارهٔ اسنپ‌شات"); assert.equal(a.unitPrice, 180_000); assert.equal(a.total, 360_000);
      assert.equal(b.originalPrice, 200_000); assert.equal(b.discountAmount, 0); assert.equal(b.total, 200_000);
      assert.equal(a.couponDiscount + b.couponDiscount, 9_000, "coupon shares add up exactly"); assert.equal(a.finalTotal, a.total - a.couponDiscount);
      assert.equal(o.total, 360_000 + 200_000 - 9_000);
      const u = await db.discountUsage.count({ where: { orderId: o.id, discountId: d.id } }); assert.equal(u, 1);
    });
    it("changing prices, rules or discounts afterwards never changes an existing order", async () => {
      const P = await mkProduct({ mode: "AUTOMATIC", variants: [{ key: "a", model: "i12", color: "white", cost: 100_000, stock: 20 }] });
      ok(await rule("PRODUCT", P.id, 20));
      const cu = await customer(); ok(await add(cu, P.slug, P.vid("a"))); const o = ok(await place(cu)); assert.equal(o.total, 120_000);
      const before = await db.orderItem.findMany({ where: { orderId: o.id } });
      ok(await rule("PRODUCT", P.id, 100)); await discount({ type: "PERCENT", value: 90, scope: "PRODUCT", targetId: P.id });
      ok(await admin.post("/api/admin/pricing/bulk", { preview: false, filter: { productIds: [P.id] }, op: { kind: "cost_percent", value: 50 }, reason: "بعد از سفارش" }));
      assert.notEqual((await variantRow(P.vid("a"))).retailPrice, 120_000);
      const after = await db.orderItem.findMany({ where: { orderId: o.id } });
      assert.deepEqual(after, before);
      const view = ok(await cu.c.get(`/api/orders/${o.number}`)); assert.equal(view.total, 120_000);
    });
  });

  describe("Bulk pricing", () => {
    it("preview lists old → new prices and affected counts without touching data; confirm applies transactionally with history", async () => {
      const P = await mkProduct({ mode: "AUTOMATIC", category: catId, variants: [{ key: "a", model: "i12", color: "white", cost: 100_000 }, { key: "b", model: "s23", color: "black", cost: 200_000 }] });
      ok(await rule("PRODUCT", P.id, 25));
      const body = { filter: { productIds: [P.id] }, op: { kind: "cost_percent", value: 10 }, reason: "افزایش نرخ ارز" };
      const pre = ok(await admin.post("/api/admin/pricing/bulk", { ...body, preview: true }));
      assert.equal(pre.preview, true); assert.equal(pre.result.targets, 2); assert.equal(pre.result.changedCount, 2);
      const row = pre.result.rows.find((r: any) => r.variantId === P.vid("a")); assert.equal(row.oldPrice, 125_000); assert.equal(row.newPrice, 137_500);
      assert.equal((await variantRow(P.vid("a"))).retailPrice, 125_000); assert.equal((await variantRow(P.vid("a"))).costPrice, 100_000, "preview changed nothing");
      ok(await admin.post("/api/admin/pricing/bulk", { ...body, preview: false }));
      assert.equal((await variantRow(P.vid("a"))).costPrice, 110_000); assert.equal((await variantRow(P.vid("a"))).retailPrice, 137_500); assert.equal((await variantRow(P.vid("b"))).retailPrice, 275_000);
      const h = await db.priceHistory.findFirstOrThrow({ where: { variantId: P.vid("a"), source: "bulk" }, orderBy: { createdAt: "desc" } });
      assert.equal(h.oldPrice, 125_000); assert.equal(h.newPrice, 137_500); assert.equal(h.oldCost, 100_000); assert.equal(h.newCost, 110_000); assert.equal(h.reason, "افزایش نرخ ارز"); assert.ok(h.adminId);
    });
    it("margin change for a whole category (25 % → 30 %) and a manual-price bump (+10 %) with skipped items reported", async () => {
      const tag = uid();
      const cat = ok(await admin.post("/api/admin/r/categories", { name: "دستهٔ گروهی " + tag, slug: "bulk6-" + tag })).id; madeCats.push(cat);
      const A = await mkProduct({ mode: "AUTOMATIC", category: cat, variants: [{ key: "a", cost: 100_000 }] });
      const M = await mkProduct({ mode: "MANUAL", category: cat, retailPrice: 200_000, variants: [{ key: "a" }] });
      ok(await rule("CATEGORY", cat, 25)); assert.equal((await variantRow(A.vid("a"))).retailPrice, 125_000);
      ok(await admin.post("/api/admin/pricing/bulk", { preview: false, filter: { categoryId: cat }, op: { kind: "margin_set", marginType: "PERCENT", value: 30 } }));
      assert.equal((await variantRow(A.vid("a"))).retailPrice, 130_000);
      const pre = ok(await admin.post("/api/admin/pricing/bulk", { preview: true, filter: { categoryId: cat }, op: { kind: "price_percent", value: 10 } }));
      assert.ok(pre.result.rows.some((r: any) => r.variantId === A.vid("a") && r.note), "automatic items are skipped with a reason");
      ok(await admin.post("/api/admin/pricing/bulk", { preview: false, filter: { categoryId: cat }, op: { kind: "price_percent", value: 10 } }));
      assert.equal((await variantRow(M.vid("a"))).retailPrice, 220_000); assert.equal((await variantRow(A.vid("a"))).retailPrice, 130_000);
    });
    it("a bulk request needs a filter and refuses oversized selections", async () => {
      assert.equal((await admin.post("/api/admin/pricing/bulk", { preview: true, filter: {}, op: { kind: "cost_percent", value: 5 } })).status, 400);
      assert.equal((await admin.post("/api/admin/pricing/bulk", { preview: true, filter: { categoryId: "nope" }, op: { kind: "cost_percent", value: 5 } })).status, 404);
    });
  });

  describe("Authorization, cost privacy and audit", () => {
    it("pricing, rules, bulk and discount admin APIs require their permissions (anon 401, customer 403, limited staff 403)", async () => {
      const cu = await customer();
      for (const [m, p, b] of [["get", "/api/admin/pricing"], ["get", "/api/admin/pricing/rules"], ["get", "/api/admin/pricing/history"], ["get", "/api/admin/discounts"], ["post", "/api/admin/pricing/rules", { scope: "GLOBAL", marginType: "PERCENT", marginValue: 5 }], ["post", "/api/admin/pricing/bulk", { filter: { q: "x" }, op: { kind: "cost_percent", value: 1 } }], ["post", "/api/admin/r/discounts", { name: "x", type: "PERCENT", value: 5, scope: "ALL" }]] as [string, string, unknown][]) {
        const call = (c: Client) => (m === "get" ? c.get(p) : c.post(p, b));
        assert.equal((await call(new Client())).status, 401, "anon " + p); assert.equal((await call(cu.c)).status, 403, "customer " + p); assert.equal((await call(manager)).status, 403, "product manager " + p);
      }
    });
    it("staff without pricing.read never receive purchase costs and cannot set costs or pricing modes", async () => {
      const P = await mkProduct({ mode: "AUTOMATIC", variants: [{ key: "a", cost: 250_000 }] }); ok(await rule("PRODUCT", P.id, 20));
      const seen = ok(await manager.get(`/api/admin/products/${P.id}`)); assert.equal(seen.costPrice, null); assert.ok(seen.variants.every((v: any) => v.costPrice === null));
      const cur = ok(await admin.get(`/api/admin/products/${P.id}`)); assert.equal(cur.variants[0].costPrice, 250_000);
      ok(await manager.patch(`/api/admin/products/${P.id}`, { costPrice: 1, pricingMode: "MANUAL", variants: cur.variants.map((v: any) => ({ id: v.id, sku: v.sku, name: v.name, costPrice: 1, pricingMode: "MANUAL", isActive: true })) }));
      const v = await variantRow(P.vid("a")); assert.equal(v.costPrice, 250_000); assert.equal(v.pricingMode, "AUTOMATIC"); assert.equal(v.retailPrice, 300_000);
    });
    it("staff with pricing.read but not pricing.write may look but not change", async () => {
      const r = await registerAndLogin();
      const role = await db.role.create({ data: { key: "pricing_viewer_" + uid(), name: "مشاهده قیمت", isStaff: true } });
      for (const key of ["pricing.read", "dashboard.view"]) await db.rolePermission.create({ data: { roleId: role.id, permissionId: (await db.permission.findUniqueOrThrow({ where: { key } })).id } });
      await db.userRole.create({ data: { userId: r.userId, roleId: role.id } });
      assert.equal((await r.c.get("/api/admin/pricing")).status, 200);
      assert.equal((await r.c.post("/api/admin/pricing/rules", { scope: "GLOBAL", marginType: "PERCENT", marginValue: 5 })).status, 403);
      assert.equal((await r.c.post("/api/admin/pricing/bulk", { preview: true, filter: { q: "x" }, op: { kind: "cost_percent", value: 1 } })).status, 403);
    });
    it("every sensitive change lands in the audit log (price, rule, discount, bulk, inventory, variant)", async () => {
      const before = { rule: await logs("pricing.rule.create"), disc: await logs("discount.create"), bulk: await logs("pricing.bulk"), inv: await logs("inventory.adjust"), vc: await logs("variant.create"), pu: await logs("product.update"), vu: await logs("variant.update") };
      const P = await mkProduct({ mode: "AUTOMATIC", variants: [{ key: "a", cost: 100_000, model: "i12", color: "white" }] });
      ok(await rule("PRODUCT", P.id, 30)); await discount({ type: "FIXED", value: 1000, scope: "PRODUCT", targetId: P.id });
      ok(await admin.post("/api/admin/pricing/bulk", { preview: false, filter: { productIds: [P.id] }, op: { kind: "cost_delta", value: 10_000 } }));
      ok(await admin.post(`/api/admin/inventory/${P.vid("a")}/adjust`, { mode: "add", quantity: 5, reason: "restock" }));
      const cur = ok(await admin.get(`/api/admin/products/${P.id}`));
      ok(await admin.patch(`/api/admin/products/${P.id}`, { name: "نام جدید " + uid(), variants: cur.variants.map((v: any) => ({ id: v.id, sku: v.sku, name: v.name, phoneModelId: v.phoneModelId, colorId: v.colorId, costPrice: v.costPrice, pricingMode: "AUTOMATIC", isActive: false })) }));
      assert.ok(await logs("pricing.rule.create") > before.rule); assert.ok(await logs("discount.create") > before.disc); assert.ok(await logs("pricing.bulk") > before.bulk);
      assert.ok(await logs("inventory.adjust") > before.inv); assert.ok(await logs("variant.create") > before.vc); assert.ok(await logs("product.update") > before.pu); assert.ok(await logs("variant.update") > before.vu);
    });
    it("colours in use cannot be deleted; unused ones can; the price history and pricing table endpoints answer", async () => {
      const c = ok(await admin.post("/api/admin/r/colors", { name: "موقت " + uid(), hex: "#123456" }));
      ok(await admin.del(`/api/admin/r/colors/${c.id}`));
      assert.equal((await admin.del(`/api/admin/r/colors/${colors.white}`)).status, 409);
      const t = ok(await admin.get(`/api/admin/pricing?per=5&sort=price&dir=desc`)); assert.ok(t.items.length > 0 && "finalPrice" in t.items[0] && "calculatedPrice" in t.items[0] && "stock" in t.items[0]);
      const h = ok(await admin.get(`/api/admin/pricing/history?per=5`)); assert.ok(h.items.length > 0);
    });
  });
});
