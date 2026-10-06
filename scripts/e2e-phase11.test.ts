/**
 * Phase 11 tests: variable products (Brand → Series → Model, model × colour variants, variant price / sale price / stock / status / image),
 * custom attributes, and the server-side checks that keep a disabled or out-of-stock variant from being bought.
 * Server must be running in production mode:  ALLOW_INSECURE_HTTP=1 TRUST_PROXY=1 npm start -- -p 3300
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BASE, Client, db, loginWithPassword, registerAndLogin, uid } from "./test-utils";

let admin: Client;
const ok = (r: { status: number; json: any }, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.json)); return r.json?.data; };
const page = async (path: string) => (await fetch(BASE + path)).text();
const tag = uid();
const made = { cats: [] as string[], brands: [] as string[], products: [] as string[], colors: [] as string[], models: [] as string[], series: [] as string[], attrs: [] as string[] };

describe("Phase 11 — variable products", () => {
  let catId = "", brandId = "", brand2Id = "";
  let s13 = "", s14 = "";
  const M: Record<string, string> = {}, C: Record<string, string> = {};
  let pid = "", pslug = "";
  let v: Record<string, string> = {}; // "model|color" → variant id
  let shipId = "";

  before(async () => {
    await db.rateLimit.deleteMany({});
    admin = await loginWithPassword("09120000001", "Admin@12345");
    catId = ok(await admin.post("/api/admin/r/categories", { name: "دستهٔ یازده " + tag, slug: "cat11-" + tag })).id; made.cats.push(catId);
    brandId = ok(await admin.post("/api/admin/r/brands", { name: "Apple " + tag, slug: "apple-" + tag })).id; made.brands.push(brandId);
    brand2Id = ok(await admin.post("/api/admin/r/brands", { name: "Samsung " + tag, slug: "samsung-" + tag })).id; made.brands.push(brand2Id);
    s13 = ok(await admin.post("/api/admin/r/phone-series", { name: "iPhone 13", slug: "iphone13-" + tag, brandId })).id; made.series.push(s13);
    s14 = ok(await admin.post("/api/admin/r/phone-series", { name: "iPhone 14", slug: "iphone14-" + tag, brandId })).id; made.series.push(s14);
    for (const [k, name, series] of [["a13", "iPhone 13", s13], ["a13p", "iPhone 13 Pro", s13], ["a14", "iPhone 14", s14]] as const) {
      M[k] = ok(await admin.post("/api/admin/r/phone-models", { name: `${name} ${tag}`, slug: `${k}-${tag}`, brandId, seriesId: series })).id; made.models.push(M[k]);
    }
    C.black = ok(await admin.post("/api/admin/r/colors", { name: "مشکی " + tag, hex: "#000000" })).id; made.colors.push(C.black);
    C.pink = ok(await admin.post("/api/admin/r/colors", { name: "صورتی " + tag, hex: "#ff88aa" })).id; made.colors.push(C.pink);
    shipId = (await db.shippingMethod.findFirstOrThrow({ where: { key: "post" } })).id;
  });
  after(async () => {
    await db.product.updateMany({ where: { id: { in: made.products } }, data: { isActive: false } });
    await db.category.updateMany({ where: { id: { in: made.cats } }, data: { isActive: false } });
    await db.brand.updateMany({ where: { id: { in: made.brands } }, data: { isActive: false } });
    await db.phoneModel.updateMany({ where: { id: { in: made.models } }, data: { isActive: false } });
    await db.color.updateMany({ where: { id: { in: made.colors } }, data: { isActive: false } });
    await db.attribute.updateMany({ where: { id: { in: made.attrs } }, data: { isActive: false } });
    await db.$disconnect();
  });

  it("migration: system attributes exist and existing multi-variant / axis products are VARIABLE", async () => {
    const sys = await db.attribute.findMany({ where: { isSystem: true }, orderBy: { sortOrder: "asc" } });
    assert.deepEqual(sys.map((a) => a.systemKey), ["model", "color"]);
    const wrongSimple = await db.product.count({ where: { productType: "SIMPLE", OR: [{ variants: { some: { OR: [{ phoneModelId: { not: null } }, { colorId: { not: null } }] } } }] } });
    assert.equal(wrongSimple, 0);
  });

  it("series: models may stay ungrouped; a series of another brand is refused; a series with models cannot be deleted", async () => {
    const free = ok(await admin.post("/api/admin/r/phone-models", { name: "Galaxy " + tag, slug: "gx-" + tag, brandId: brand2Id })); made.models.push(free.id);
    assert.equal(free.seriesId, null);
    const bad = await admin.post("/api/admin/r/phone-models", { name: "Bad " + tag, slug: "bad-" + tag, brandId: brand2Id, seriesId: s13 });
    assert.equal(bad.status, 409, JSON.stringify(bad.json));
    const del = await admin.del(`/api/admin/r/phone-series/${s13}`);
    assert.equal(del.status, 409, JSON.stringify(del.json));
    const list = ok(await admin.get(`/api/admin/r/phone-models?seriesId=${s13}`));
    assert.equal((list.items as any[]).filter((m) => m.name.endsWith(tag)).length, 2);
  });

  it("attributes: system ones are protected; custom attribute + values can be chosen on a product and show in specs", async () => {
    const sys = await db.attribute.findFirstOrThrow({ where: { systemKey: "model" } });
    assert.equal((await admin.del(`/api/admin/r/attributes/${sys.id}`)).status, 409);
    assert.equal((await admin.post("/api/admin/r/attribute-values", { attributeId: sys.id, value: "x" + tag })).status, 409);
    const a = ok(await admin.post("/api/admin/r/attributes", { name: "جنس " + tag, slug: "material-" + tag })); made.attrs.push(a.id);
    const val = ok(await admin.post("/api/admin/r/attribute-values", { attributeId: a.id, value: "سیلیکون " + tag }));
    const p = ok(await admin.post("/api/admin/products", { name: "کالای ساده " + tag, slug: "simple11-" + tag, sku: "S11-" + tag, categoryId: catId, retailPrice: 50_000, attributeValueIds: [val.id], variants: [{ sku: "S11V-" + tag, stock: 3 }] })); made.products.push(p.id);
    assert.equal(p.productType, "SIMPLE");
    assert.deepEqual((await db.productAttributeValue.findMany({ where: { productId: p.id } })).map((x) => x.valueId), [val.id]);
    const html = await page(`/product/simple11-${tag}`);
    assert.ok(html.includes("سیلیکون " + tag) && html.includes("جنس " + tag));
    assert.equal((await admin.patch(`/api/admin/products/${p.id}`, { attributeValueIds: ["nope"] })).status, 400);
  });

  it("simple products cannot carry several variants or axes", async () => {
    const r = await admin.post("/api/admin/products", { name: "بد " + tag, slug: "bad11-" + tag, sku: "B11-" + tag, categoryId: catId, retailPrice: 1000, productType: "SIMPLE", variants: [{ sku: "B1-" + tag, phoneModelId: M.a13 }, { sku: "B2-" + tag }] });
    assert.equal(r.status, 400, JSON.stringify(r.json));
  });

  it("creates a variable product with generated (inactive) variants; inactive variants are hidden and cannot be bought", async () => {
    pslug = "var11-" + tag;
    const combos = [["a13", "black"], ["a13", "pink"], ["a13p", "black"], ["a14", "black"]] as const;
    const p = ok(await admin.post("/api/admin/products", {
      name: "قاب متغیر " + tag, slug: pslug, sku: "V11-" + tag, categoryId: catId, brandId, retailPrice: 688_000, pricingMode: "MANUAL", productType: "VARIABLE",
      images: [{ url: "/p11-a-" + tag + ".png" }, { url: "/p11-b-" + tag + ".png" }],
      variants: combos.map(([m, c]) => ({ sku: `V11-${tag}-${m}-${c}`, phoneModelId: M[m], colorId: C[c], isActive: false, stock: 0, pricingMode: "MANUAL" })),
    })); made.products.push(p.id); pid = p.id;
    assert.equal(p.productType, "VARIABLE");
    for (const x of p.variants as any[]) v[`${Object.keys(M).find((k) => M[k] === x.phoneModelId)}|${Object.keys(C).find((k) => C[k] === x.colorId)}`] = x.id;
    assert.equal(Object.keys(v).length, 4);
    // duplicates are refused
    const dup = await admin.patch(`/api/admin/products/${pid}`, { variants: [...(p.variants as any[]).map((x) => ({ id: x.id, sku: x.sku, phoneModelId: x.phoneModelId, colorId: x.colorId, isActive: false })), { sku: "DUP-" + tag, phoneModelId: M.a13, colorId: C.black }] });
    assert.equal(dup.status, 409, JSON.stringify(dup.json));
    const user = await registerAndLogin();
    const r = await user.c.post("/api/cart/items", { productSlug: pslug, variantId: v["a13|black"], quantity: 1 });
    assert.ok(r.status >= 400 && r.status < 500, "inactive variant cannot be added: " + r.status);
  });

  it("activating with stock makes a variant buyable at the inherited base price; the page lists only buyable combos", async () => {
    const patchV = (id: string, extra: Record<string, unknown>) => ({ id, ...extra });
    const cur = ok(await admin.get(`/api/admin/products/${pid}`)).variants as any[];
    const body = cur.map((x) => ({ id: x.id, sku: x.sku, phoneModelId: x.phoneModelId, colorId: x.colorId, isActive: x.id === v["a13|black"] || x.id === v["a13p|black"], stock: x.id === v["a13|black"] ? 5 : x.id === v["a13p|black"] ? 0 : 0, retailPrice: x.id === v["a13p|black"] ? 720_000 : null }));
    void patchV;
    ok(await admin.patch(`/api/admin/products/${pid}`, { variants: body }));
    assert.equal((await db.inventory.findFirstOrThrow({ where: { variantId: v["a13|black"] } })).quantity, 5);
    assert.ok(await db.inventoryMovement.findFirst({ where: { inventory: { variantId: v["a13|black"] }, reason: "correction" } }), "stock edit is recorded as a movement");
    const user = await registerAndLogin();
    const line = async (id: string) => { ok(await user.c.post("/api/cart/items", { productSlug: pslug, variantId: id, quantity: 1 })); return (ok(await user.c.get("/api/cart")).lines as any[]).find((l) => l.variantId === id); };
    assert.equal((await line(v["a13|black"])).unitPrice, 688_000, "inherits the product base price");
    const html = await page(`/product/${pslug}`);
    assert.ok(html.includes("iPhone 13 " + tag) && html.includes("iPhone 13 Pro " + tag), "active models listed");
    assert.ok(!html.includes("iPhone 14 " + tag), "inactive model is not offered");
    // out-of-stock variant (active, stock 0) cannot be bought
    const oos = await user.c.post("/api/cart/items", { productSlug: pslug, variantId: v["a13p|black"], quantity: 1 });
    assert.equal(oos.status, 409, JSON.stringify(oos.json));
  });

  it("custom price override and special sale price are applied server-side; bad sale prices are refused", async () => {
    const cur = ok(await admin.get(`/api/admin/products/${pid}`)).variants as any[];
    const mk = (over: Record<string, any>) => cur.map((x) => ({ id: x.id, sku: x.sku, phoneModelId: x.phoneModelId, colorId: x.colorId, isActive: x.isActive, ...(over[x.id] ?? {}) }));
    const bad = await admin.patch(`/api/admin/products/${pid}`, { variants: mk({ [v["a13|black"]]: { salePrice: 700_000 } }) });
    assert.equal(bad.status, 400, JSON.stringify(bad.json));
    ok(await admin.patch(`/api/admin/products/${pid}`, { variants: mk({ [v["a13p|black"]]: { stock: 4, retailPrice: 720_000 }, [v["a13|black"]]: { salePrice: 600_000 } }) }));
    const user = await registerAndLogin();
    const unit = async (id: string) => { ok(await user.c.post("/api/cart/items", { productSlug: pslug, variantId: id, quantity: 1 })); return (ok(await user.c.get("/api/cart")).lines as any[]).find((l) => l.variantId === id); };
    const a = await unit(v["a13|black"]); assert.equal(a.unitPrice, 600_000); assert.equal(a.originalPrice ?? a.listPrice, 688_000);
    assert.equal((await unit(v["a13p|black"])).unitPrice, 720_000, "custom price");
    // clearing the override returns to the base price; clearing the sale price too
    ok(await admin.patch(`/api/admin/products/${pid}`, { variants: mk({ [v["a13p|black"]]: { retailPrice: null }, [v["a13|black"]]: { salePrice: null } }) }));
    const u2 = await registerAndLogin();
    ok(await u2.c.post("/api/cart/items", { productSlug: pslug, variantId: v["a13p|black"], quantity: 1 }));
    assert.equal((ok(await u2.c.get("/api/cart")).lines as any[])[0].unitPrice, 688_000);
  });

  it("the shop's price sort (SQL) sees the variant sale price", async () => {
    const cur = ok(await admin.get(`/api/admin/products/${pid}`)).variants as any[];
    ok(await admin.patch(`/api/admin/products/${pid}`, { variants: cur.map((x) => ({ id: x.id, sku: x.sku, phoneModelId: x.phoneModelId, colorId: x.colorId, isActive: x.isActive, salePrice: x.id === v["a13|black"] ? 100_000 : null })) }));
    const cheap = ok(await admin.post("/api/admin/products", { name: "کالای ۳۰۰ " + tag, slug: "p300-" + tag, sku: "P300-" + tag, categoryId: catId, retailPrice: 300_000, variants: [{ sku: "P300V-" + tag, stock: 2 }] })); made.products.push(cheap.id);
    const html = await page(`/shop?cat=cat11-${tag}&sort=asc`);
    assert.ok(html.includes("قاب متغیر " + tag) && html.includes("کالای ۳۰۰ " + tag));
    assert.ok(html.indexOf("قاب متغیر " + tag) < html.indexOf("کالای ۳۰۰ " + tag), "variant sale price (100k) sorts before the 300k product");
    const desc = await page(`/shop?cat=cat11-${tag}&sort=desc`);
    assert.ok(desc.indexOf("قاب متغیر " + tag) > desc.indexOf("کالای ۳۰۰ " + tag), "and after it when sorting high → low");
    ok(await admin.patch(`/api/admin/products/${pid}`, { variants: cur.map((x) => ({ id: x.id, sku: x.sku, phoneModelId: x.phoneModelId, colorId: x.colorId, isActive: x.isActive, salePrice: null })) }));
  });

  it("variant image: chosen from the product's images, used in the cart; foreign images are refused; removing falls back to the product image", async () => {
    const cur = ok(await admin.get(`/api/admin/products/${pid}`)).variants as any[];
    const base = cur.map((x) => ({ id: x.id, sku: x.sku, phoneModelId: x.phoneModelId, colorId: x.colorId, isActive: x.isActive }));
    const bad = await admin.patch(`/api/admin/products/${pid}`, { variants: base.map((x) => ({ ...x, imageUrl: x.id === v["a13|black"] ? "/not-mine.png" : undefined })) });
    assert.equal(bad.status, 400, JSON.stringify(bad.json));
    const imgB = `/p11-b-${tag}.png`;
    const res = ok(await admin.patch(`/api/admin/products/${pid}`, { variants: base.map((x) => ({ ...x, imageUrl: x.id === v["a13|black"] ? imgB : undefined })) }));
    assert.equal((res.variants as any[]).find((x) => x.id === v["a13|black"]).image.url, imgB);
    const user = await registerAndLogin();
    ok(await user.c.post("/api/cart/items", { productSlug: pslug, variantId: v["a13|black"], quantity: 1 }));
    ok(await user.c.post("/api/cart/items", { productSlug: pslug, variantId: v["a13p|black"], quantity: 1 }));
    const lines = ok(await user.c.get("/api/cart")).lines as any[];
    assert.equal(lines.find((l) => l.variantId === v["a13|black"]).image, imgB);
    assert.equal(lines.find((l) => l.variantId === v["a13p|black"]).image, `/p11-a-${tag}.png`, "no own image → product image");
    const html = await page(`/product/${pslug}`);
    assert.ok(html.includes("variant-picker"));
  });

  it("order snapshot keeps the price and image at purchase time; later variant price changes do not touch it", async () => {
    const cu = await registerAndLogin();
    const addr = ok(await cu.c.post("/api/addresses", { receiver: "تست", phone: "09121234567", province: "تهران", city: "تهران", postalCode: "1234567890", address: "خیابان ولیعصر، پلاک ۱۰" }));
    ok(await cu.c.post("/api/cart/items", { productSlug: pslug, variantId: v["a13|black"], quantity: 1 }));
    const o = ok(await cu.c.post("/api/checkout/orders", { addressId: addr.id, shippingMethodId: shipId, paymentMethod: "card_to_card", useWallet: false, redeemPoints: 0 }));
    const cur = ok(await admin.get(`/api/admin/products/${pid}`)).variants as any[];
    ok(await admin.patch(`/api/admin/products/${pid}`, { variants: cur.map((x) => ({ id: x.id, sku: x.sku, phoneModelId: x.phoneModelId, colorId: x.colorId, isActive: x.isActive, retailPrice: x.id === v["a13|black"] ? 999_000 : undefined })) }));
    const view = ok(await cu.c.get(`/api/orders/${o.number}`));
    const item = (view.items as any[])[0];
    assert.equal(item.unitPrice, 688_000); assert.equal(item.image, `/p11-b-${tag}.png`);
    // and the cart of someone else now sees the new price (computed on the server)
    const u2 = await registerAndLogin();
    ok(await u2.c.post("/api/cart/items", { productSlug: pslug, variantId: v["a13|black"], quantity: 1 }));
    assert.equal((ok(await u2.c.get("/api/cart")).lines as any[])[0].unitPrice, 999_000);
  });

  it("a client cannot choose the price: extra price fields in the cart request are ignored", async () => {
    const u = await registerAndLogin();
    const r = await u.c.post("/api/cart/items", { productSlug: pslug, variantId: v["a13|black"], quantity: 1, unitPrice: 1, price: 1 });
    assert.ok(r.status === 200 || r.status === 400);
    if (r.status === 200) assert.notEqual((ok(await u.c.get("/api/cart")).lines as any[])[0].unitPrice, 1);
  });

  it("deactivating a variant that is already in a cart makes checkout refuse it", async () => {
    const cu = await registerAndLogin();
    const addr = ok(await cu.c.post("/api/addresses", { receiver: "تست", phone: "09121234567", province: "تهران", city: "تهران", postalCode: "1234567890", address: "خیابان ولیعصر، پلاک ۱۰" }));
    ok(await cu.c.post("/api/cart/items", { productSlug: pslug, variantId: v["a13|black"], quantity: 1 }));
    const cur = ok(await admin.get(`/api/admin/products/${pid}`)).variants as any[];
    ok(await admin.patch(`/api/admin/products/${pid}`, { variants: cur.map((x) => ({ id: x.id, sku: x.sku, phoneModelId: x.phoneModelId, colorId: x.colorId, isActive: x.id === v["a13|black"] ? false : x.isActive })) }));
    const o = await cu.c.post("/api/checkout/orders", { addressId: addr.id, shippingMethodId: shipId, paymentMethod: "card_to_card", useWallet: false, redeemPoints: 0 });
    assert.equal(o.status, 409, JSON.stringify(o.json));
  });

  it("existing variants are not touched by unrelated edits (same ids, same stock)", async () => {
    const before = await db.productVariant.findMany({ where: { productId: pid }, include: { inventory: true }, orderBy: { sku: "asc" } });
    ok(await admin.patch(`/api/admin/products/${pid}`, { shortDescription: "x" + tag }));
    const after = await db.productVariant.findMany({ where: { productId: pid }, include: { inventory: true }, orderBy: { sku: "asc" } });
    assert.deepEqual(after.map((x) => [x.id, x.inventory?.quantity, x.isActive]), before.map((x) => [x.id, x.inventory?.quantity, x.isActive]));
  });
});
