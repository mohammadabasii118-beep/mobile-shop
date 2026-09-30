/**
 * Phase 12 tests: per-variant wholesale (partner) price — inherit / override / reset — server-side in cart and checkout,
 * separation from retail discounts, tampering, and the order snapshot.
 * Server must be running in production mode:  ALLOW_INSECURE_HTTP=1 TRUST_PROXY=1 npm start -- -p 3300
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BASE, Client, db, loginWithPassword, registerAndLogin, uid } from "./test-utils";

let admin: Client, partner: Client;
const ok = (r: { status: number; json: any }, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.json)); return r.json?.data; };
const tag = uid();
const made = { cats: [] as string[], brands: [] as string[], products: [] as string[], colors: [] as string[], models: [] as string[], discounts: [] as string[] };

describe("Phase 12 — variant wholesale price", () => {
  let catId = "", pid = "", pslug = "", shipId = "", partnerAddr = "";
  const M: Record<string, string> = {}, C: Record<string, string> = {}, V: Record<string, string> = {};
  const key = (m: string, c: string) => `${m}|${c}`;

  const variantsOf = async () => ok(await admin.get(`/api/admin/products/${pid}`)).variants as any[];
  /** Full-variant PATCH body with per-variant overrides by "model|color". */
  const patchV = async (over: Record<string, Record<string, unknown>>, product: Record<string, unknown> = {}) => {
    const cur = await variantsOf();
    const body = cur.map((x) => { const k = Object.entries(V).find(([, id]) => id === x.id)![0]; return { id: x.id, sku: x.sku, phoneModelId: x.phoneModelId, colorId: x.colorId, isActive: x.isActive, ...(over[k] ?? {}) }; });
    return admin.patch(`/api/admin/products/${pid}`, { ...product, variants: body });
  };
  const clear = async (c: Client) => { for (const l of ok(await c.get("/api/cart")).lines as any[]) await c.del(`/api/cart/items/${l.id}`); };
  const unit = async (c: Client, k: string, qty = 2) => {
    await clear(c);
    ok(await c.post("/api/cart/items", { productSlug: pslug, variantId: V[k], quantity: qty }));
    return (ok(await c.get("/api/cart")).lines as any[]).find((l) => l.variantId === V[k]);
  };

  before(async () => {
    await db.rateLimit.deleteMany({});
    admin = await loginWithPassword("09120000001", "Admin@12345"); partner = await loginWithPassword("09120000003", "Partner@12345");
    ok(await admin.put("/api/admin/settings/wholesalePolicy", { minDiscountPercent: 0, maxDiscountPercent: 0, capAtRetail: true }));
    catId = ok(await admin.post("/api/admin/r/categories", { name: "دستهٔ دوازده " + tag, slug: "cat12-" + tag })).id; made.cats.push(catId);
    const brand = ok(await admin.post("/api/admin/r/brands", { name: "B12 " + tag, slug: "b12-" + tag })).id; made.brands.push(brand);
    for (const n of ["i13", "i14"]) { M[n] = ok(await admin.post("/api/admin/r/phone-models", { name: `${n} ${tag}`, slug: `${n}-${tag}`, brandId: brand })).id; made.models.push(M[n]); }
    for (const n of ["black", "white"]) { C[n] = ok(await admin.post("/api/admin/r/colors", { name: `${n} ${tag}` })).id; made.colors.push(C[n]); }
    shipId = (await db.shippingMethod.findFirstOrThrow({ where: { key: "post" } })).id;
    partnerAddr = ok(await partner.post("/api/addresses", { receiver: "همکار", phone: "09121234567", province: "تهران", city: "تهران", postalCode: "1234567890", address: "خیابان ولیعصر، پلاک ۱۰" })).id;
    pslug = "ws12-" + tag;
    const combos = [["i13", "black"], ["i13", "white"], ["i14", "black"], ["i14", "white"]];
    const p = ok(await admin.post("/api/admin/products", {
      name: "قاب همکاری " + tag, slug: pslug, sku: "W12-" + tag, categoryId: catId, retailPrice: 400_000, wholesalePrice: 250_000, minWholesaleQty: 2, productType: "VARIABLE",
      variants: combos.map(([m, c]) => ({ sku: `W12-${tag}-${m}-${c}`, phoneModelId: M[m], colorId: C[c], isActive: true, stock: 50 })),
    })); made.products.push(p.id); pid = p.id;
    for (const x of p.variants as any[]) V[key(Object.keys(M).find((k) => M[k] === x.phoneModelId)!, Object.keys(C).find((k) => C[k] === x.colorId)!)] = x.id;
  });
  after(async () => {
    await clear(partner).catch(() => {});
    await db.discount.updateMany({ where: { id: { in: made.discounts } }, data: { isActive: false } });
    await db.product.updateMany({ where: { id: { in: made.products } }, data: { isActive: false } });
    await db.category.updateMany({ where: { id: { in: made.cats } }, data: { isActive: false } });
    await db.brand.updateMany({ where: { id: { in: made.brands } }, data: { isActive: false } });
    await db.phoneModel.updateMany({ where: { id: { in: made.models } }, data: { isActive: false } });
    await db.color.updateMany({ where: { id: { in: made.colors } }, data: { isActive: false } });
    await db.$disconnect();
  });

  it("inherit: variants without their own wholesale price use the product's wholesale base price (partner only, at the minimum quantity)", async () => {
    const pl = await unit(partner, "i13|black");
    assert.equal(pl.unitPrice, 250_000); assert.equal(pl.priceType, "wholesale");
    const one = await unit(partner, "i13|black", 1);
    assert.equal(one.priceType, "retail", "below the minimum quantity the partner pays retail");
    const normal = await registerAndLogin();
    const nl = await unit(normal.c, "i13|black");
    assert.equal(nl.unitPrice, 400_000); assert.equal(nl.priceType, "retail");
  });

  it("override: a variant's own wholesale price wins; others keep inheriting", async () => {
    ok(await patchV({ "i14|black": { wholesalePrice: 270_000 }, "i14|white": { wholesalePrice: 265_000 } }));
    assert.equal((await unit(partner, "i14|black")).unitPrice, 270_000);
    assert.equal((await unit(partner, "i14|white")).unitPrice, 265_000);
    assert.equal((await unit(partner, "i13|white")).unitPrice, 250_000, "still inherits");
    // changing the product base moves inheriting variants only
    ok(await admin.patch(`/api/admin/products/${pid}`, { wholesalePrice: 240_000 }));
    assert.equal((await unit(partner, "i13|white")).unitPrice, 240_000);
    assert.equal((await unit(partner, "i14|black")).unitPrice, 270_000, "override untouched");
  });

  it("bulk-style set + reset to inherit", async () => {
    ok(await patchV({ "i13|black": { wholesalePrice: 230_000 }, "i13|white": { wholesalePrice: 230_000 } }));
    assert.equal((await unit(partner, "i13|black")).unitPrice, 230_000);
    ok(await patchV({ "i13|black": { wholesalePrice: null }, "i13|white": { wholesalePrice: null }, "i14|black": { wholesalePrice: null }, "i14|white": { wholesalePrice: null } }));
    for (const k of ["i13|black", "i13|white", "i14|black", "i14|white"]) assert.equal((await unit(partner, k)).unitPrice, 240_000, k + " is back to the product's wholesale price");
    assert.equal((await db.productVariant.findMany({ where: { productId: pid, wholesalePrice: { not: null } } })).length, 0, "overrides are removed, not zeroed");
  });

  it("the wholesale policy is enforced for variant overrides (wholesale above retail is refused)", async () => {
    const r = await patchV({ "i13|black": { wholesalePrice: 500_000 } });
    assert.equal(r.status, 400, JSON.stringify(r.json));
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: V["i13|black"] } })).wholesalePrice, null, "nothing was saved");
  });

  it("retail promotions and sale prices never mix into the partner price", async () => {
    ok(await patchV({ "i14|black": { wholesalePrice: 270_000, salePrice: 300_000 } }));
    const d = ok(await admin.post("/api/admin/r/discounts", { name: "ت12 " + tag, isActive: true, scope: "PRODUCT", targetId: pid, type: "PERCENT", value: 10 })); made.discounts.push(d.id);
    const normal = await registerAndLogin();
    assert.equal((await unit(normal.c, "i14|black")).unitPrice, 300_000, "customer: best single retail reduction (sale price beats 10% of 400k)");
    assert.equal((await unit(partner, "i14|black")).unitPrice, 270_000, "partner: untouched by the promotion and the sale price");
    await db.discount.update({ where: { id: d.id }, data: { isActive: false } });
    ok(await patchV({ "i14|black": { salePrice: null } }));
  });

  it("tampering: a normal customer cannot obtain or pay the wholesale price", async () => {
    const u = await registerAndLogin();
    await clear(u.c);
    const add = await u.c.post("/api/cart/items", { productSlug: pslug, variantId: V["i13|black"], quantity: 5, priceType: "wholesale", wholesale: true, unitPrice: 1, price: 1, role: "partner" });
    assert.ok([200, 400].includes(add.status));
    const line = (ok(await u.c.get("/api/cart")).lines as any[])[0];
    assert.equal(line.priceType, "retail"); assert.equal(line.unitPrice, 400_000);
    const addr = ok(await u.c.post("/api/addresses", { receiver: "تست", phone: "09121234567", province: "تهران", city: "تهران", postalCode: "1234567890", address: "خیابان ولیعصر، پلاک ۱۰" }));
    const q = ok(await u.c.get(`/api/checkout/quote?shippingMethodId=${shipId}&priceType=wholesale`));
    assert.equal(q.subtotal, 5 * 400_000);
    const o = ok(await u.c.post("/api/checkout/orders", { addressId: addr.id, shippingMethodId: shipId, paymentMethod: "card_to_card", useWallet: false, redeemPoints: 0, unitPrice: 1, total: 1, priceType: "wholesale" }));
    const item = (ok(await u.c.get(`/api/orders/${o.number}`)).items as any[])[0];
    assert.equal(item.unitPrice, 400_000); assert.equal(item.priceType, "retail");
  });

  it("checkout for a partner re-prices on the server and the order snapshots price + type; later changes do not touch it", async () => {
    ok(await patchV({ "i14|white": { wholesalePrice: 265_000 } }));
    await unit(partner, "i14|white", 12);
    const q = ok(await partner.get(`/api/checkout/quote?shippingMethodId=${shipId}`));
    assert.equal(q.subtotal, 12 * 265_000);
    const o = ok(await partner.post("/api/checkout/orders", { addressId: partnerAddr, shippingMethodId: shipId, paymentMethod: "card_to_card", useWallet: false, redeemPoints: 0 }));
    ok(await patchV({ "i14|white": { wholesalePrice: 100_000 } }));
    const item = (ok(await partner.get(`/api/orders/${o.number}`)).items as any[])[0];
    assert.equal(item.unitPrice, 265_000); assert.equal(item.priceType, "wholesale");
    assert.equal((await unit(partner, "i14|white")).unitPrice, 100_000, "a new cart sees the new price");
  });

  it("cart/checkout validation: an inactive or out-of-stock variant is refused for partners too", async () => {
    await unit(partner, "i13|white", 13);
    ok(await patchV({ "i13|white": { isActive: false } }));
    const r = await partner.post("/api/checkout/orders", { addressId: partnerAddr, shippingMethodId: shipId, paymentMethod: "card_to_card", useWallet: false, redeemPoints: 0 });
    assert.equal(r.status, 409, JSON.stringify(r.json));
    ok(await patchV({ "i13|white": { isActive: true, stock: 0 } }));
    const r2 = await partner.post("/api/checkout/orders", { addressId: partnerAddr, shippingMethodId: shipId, paymentMethod: "card_to_card", useWallet: false, redeemPoints: 0 });
    assert.equal(r2.status, 409, JSON.stringify(r2.json));
    await clear(partner);
    const add = await partner.post("/api/cart/items", { productSlug: pslug, variantId: V["i13|white"], quantity: 1 });
    assert.equal(add.status, 409);
  });

  it("the product page gives the partner price only to the partner session", async () => {
    ok(await patchV({ "i13|white": { stock: 10 }, "i14|black": { wholesalePrice: 271_000 } }));
    const anon = await (await fetch(`${BASE}/product/${pslug}`)).text();
    assert.ok(!anon.includes("271000"), "anonymous page carries no wholesale price");
    const mine = (await partner.get(`/product/${pslug}`)).text;
    assert.ok(mine.includes("271000"), "partner page carries the variant's wholesale price");
  });
});
