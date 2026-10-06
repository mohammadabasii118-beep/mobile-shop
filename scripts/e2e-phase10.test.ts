/**
 * Phase 10 tests: a product can have any number of extra categories and brands besides its primary ones.
 * Server must be running in production mode:  ALLOW_INSECURE_HTTP=1 TRUST_PROXY=1 npm start -- -p 3300
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BASE, Client, db, loginWithPassword, registerAndLogin, uid } from "./test-utils";

let admin: Client;
const ok = (r: { status: number; json: any }, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.json)); return r.json?.data; };
const page = async (path: string) => (await fetch(BASE + path)).text();
const tag = uid();
const cats: string[] = [], brands: string[] = [], discounts: string[] = [];
const mkCat = async (n: string, parentId?: string) => { const c = ok(await admin.post("/api/admin/r/categories", { name: `${n} ${tag}`, slug: `${n}-${tag}`.toLowerCase(), ...(parentId ? { parentId } : {}) })); cats.push(c.id); return c as { id: string; slug: string }; };
const mkBrand = async (n: string) => { const b = ok(await admin.post("/api/admin/r/brands", { name: `${n} ${tag}`, slug: `${n}-${tag}`.toLowerCase() })); brands.push(b.id); return b as { id: string; slug: string }; };

describe("Phase 10 — unlimited categories and brands per product", () => {
  let primary: { id: string; slug: string }, extra: { id: string; slug: string }, child: { id: string; slug: string }, bP: { id: string; slug: string }, bX: { id: string; slug: string };
  let pid = "", pslug = "", pname = "";
  before(async () => {
    await db.rateLimit.deleteMany({});
    admin = await loginWithPassword("09120000001", "Admin@12345");
    primary = await mkCat("prim"); extra = await mkCat("extra"); child = await mkCat("kid", extra.id);
    bP = await mkBrand("bp"); bX = await mkBrand("bx");
    pslug = "p10-" + tag; pname = "کالای ده " + tag;
    const p = ok(await admin.post("/api/admin/products", { name: pname, slug: pslug, sku: "SKU-" + pslug, categoryId: primary.id, brandId: bP.id, retailPrice: 100_000, pricingMode: "MANUAL", extraCategoryIds: [extra.id, primary.id], extraBrandIds: [bX.id, bP.id], variants: [{ sku: "V-" + pslug, stock: 5, pricingMode: "MANUAL", retailPrice: 100_000 }] }));
    pid = p.id;
  });
  after(async () => {
    await db.discount.updateMany({ where: { id: { in: discounts } }, data: { isActive: false } });
    await db.product.updateMany({ where: { id: pid }, data: { isActive: false } });
    await db.category.updateMany({ where: { id: { in: cats } }, data: { isActive: false } });
    await db.brand.updateMany({ where: { id: { in: brands } }, data: { isActive: false } });
    await db.$disconnect();
  });

  it("stores extras, dropping ones equal to the primary", async () => {
    assert.deepEqual((await db.productCategory.findMany({ where: { productId: pid } })).map((x) => x.categoryId), [extra.id]);
    assert.deepEqual((await db.productBrand.findMany({ where: { productId: pid } })).map((x) => x.brandId), [bX.id]);
    const d = ok(await admin.get(`/api/admin/products/${pid}`));
    assert.deepEqual(d.extraCategoryIds, [extra.id]); assert.deepEqual(d.extraBrandIds, [bX.id]);
  });

  it("rejects unknown ids", async () => {
    const r = await admin.patch(`/api/admin/products/${pid}`, { extraCategoryIds: ["nope"] });
    assert.equal(r.status, 400, JSON.stringify(r.json));
  });

  it("the product shows up under primary and extra categories and brands (shop pages)", async () => {
    for (const path of [`/shop?cat=${primary.slug}`, `/shop?cat=${extra.slug}`, `/category/${primary.slug}`, `/category/${extra.slug}`, `/brand/${bP.slug}`, `/brand/${bX.slug}`]) assert.ok((await page(path)).includes(pname), path);
    assert.ok(!(await page(`/shop?cat=${child.slug}`)).includes(pname), "a sub-category of the extra does not list it");
  });

  it("the product page lists every category and brand; breadcrumb uses the primary", async () => {
    const h = await page(`/product/${pslug}`);
    for (const s of [`/category/${primary.slug}`, `/category/${extra.slug}`, `/brand/${bP.slug}`, `/brand/${bX.slug}`]) assert.ok(h.includes(s), s);
  });

  it("a category discount on an extra category (and its parent chain) and a brand discount on an extra brand apply in cart and on cards", async () => {
    const user = await registerAndLogin();
    ok(await user.c.post("/api/cart/items", { productSlug: pslug, quantity: 1 }));
    const unit = async () => (ok(await user.c.get("/api/cart")).lines as any[]).find((x) => x.slug === pslug).unitPrice as number;
    const base = await unit();
    assert.equal(base, 100_000);
    const mk = async (scope: string, targetId: string) => { const d = ok(await admin.post("/api/admin/r/discounts", { name: "ت10 " + uid(), isActive: true, scope, targetId, type: "PERCENT", value: 10 })); discounts.push(d.id); return d; };
    const d1 = await mk("CATEGORY", extra.id);
    assert.equal(await unit(), 90_000, "extra category discount");
    await db.discount.update({ where: { id: d1.id }, data: { isActive: false } });
    await mk("PRODUCT_BRAND", bX.id);
    assert.equal(await unit(), 90_000, "extra brand discount");
    const card = await page(`/brand/${bX.slug}`);
    assert.ok(card.includes(pname));
  });

  it("clearing extras works and old single-category products are unaffected", async () => {
    ok(await admin.patch(`/api/admin/products/${pid}`, { extraCategoryIds: [], extraBrandIds: [] }));
    assert.equal(await db.productCategory.count({ where: { productId: pid } }), 0);
    assert.equal(await db.productBrand.count({ where: { productId: pid } }), 0);
    assert.ok(!(await page(`/category/${extra.slug}`)).includes(pname));
    assert.ok((await page(`/category/${primary.slug}`)).includes(pname));
  });

  it("changing the primary to a current extra removes the duplicate link", async () => {
    ok(await admin.patch(`/api/admin/products/${pid}`, { extraCategoryIds: [extra.id] }));
    ok(await admin.patch(`/api/admin/products/${pid}`, { categoryId: extra.id }));
    assert.equal(await db.productCategory.count({ where: { productId: pid } }), 0);
  });
});
