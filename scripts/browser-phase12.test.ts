/** Playwright: two-way model ↔ colour selection on the product page (incl. brand/series filters, disabled combos) and wholesale column / bulk in the variant matrix. SHOTS=/dir writes screenshots. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { BASE, Client, db, loginWithPassword, uid } from "./test-utils";

const PW = process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs";
const SHOTS = process.env.SHOTS;
const tag = uid();
const ok = (r: { status: number; json: any }) => { assert.equal(r.status, 200, JSON.stringify(r.json)); return r.json?.data; };
let browser: any, admin: Client, catId = "", pslug = "", pid = "";
const made = { models: [] as string[], colors: [] as string[], brands: [] as string[], cats: [] as string[], products: [] as string[], series: [] as string[] };
const M: Record<string, string> = {}, C: Record<string, string> = {};
const shot = async (pg: any, name: string) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage: false }); } };
const chip = (pg: any, testid: string, name: string) => pg.getByTestId(testid).filter({ hasText: name });
const on = async (el: any) => (await el.getAttribute("aria-pressed")) === "true";

describe("Phase 12 — two-way selection & wholesale matrix", () => {
  before(async () => {
    await db.rateLimit.deleteMany({});
    const { chromium } = await import(PW);
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
    admin = await loginWithPassword("09120000001", "Admin@12345");
    catId = ok(await admin.post("/api/admin/r/categories", { name: "دستهٔ ب۱۲ " + tag, slug: "cb12-" + tag })).id; made.cats.push(catId);
    const apple = ok(await admin.post("/api/admin/r/brands", { name: "Apple " + tag, slug: "ap12-" + tag })).id;
    const sams = ok(await admin.post("/api/admin/r/brands", { name: "Samsung " + tag, slug: "sm12-" + tag })).id; made.brands.push(apple, sams);
    const s13 = ok(await admin.post("/api/admin/r/phone-series", { name: "Ser13 " + tag, slug: "sr13-" + tag, brandId: apple })).id;
    const s14 = ok(await admin.post("/api/admin/r/phone-series", { name: "Ser14 " + tag, slug: "sr14-" + tag, brandId: apple })).id; made.series.push(s13, s14);
    for (const [k, b, s] of [["i13", apple, s13], ["i14", apple, s14], ["gx", sams, null]] as const) { M[k] = ok(await admin.post("/api/admin/r/phone-models", { name: `${k} ${tag}`, slug: `${k}-${tag}`, brandId: b, ...(s ? { seriesId: s } : {}) })).id; made.models.push(M[k]); }
    for (const k of ["black", "green", "white"]) { C[k] = ok(await admin.post("/api/admin/r/colors", { name: `${k} ${tag}` })).id; made.colors.push(C[k]); }
    pslug = "tw12-" + tag;
    const spec: [string, string, number, boolean][] = [["i13", "black", 5, true], ["i13", "green", 0, true], ["i14", "black", 3, true], ["i14", "white", 4, true], ["i13", "white", 9, false], ["gx", "black", 2, true]];
    const p = ok(await admin.post("/api/admin/products", { name: "قاب دوطرفه " + tag, slug: pslug, sku: "TW12-" + tag, categoryId: catId, retailPrice: 500_000, productType: "VARIABLE",
      variants: spec.map(([m, c, stock, active]) => ({ sku: `TW-${tag}-${m}-${c}`, phoneModelId: M[m], colorId: C[c], isActive: active, stock })) })); made.products.push(p.id); pid = p.id;
  });
  after(async () => {
    await db.product.updateMany({ where: { id: { in: made.products } }, data: { isActive: false } });
    await db.category.updateMany({ where: { id: { in: made.cats } }, data: { isActive: false } });
    await db.brand.updateMany({ where: { id: { in: made.brands } }, data: { isActive: false } });
    await db.phoneModel.updateMany({ where: { id: { in: made.models } }, data: { isActive: false } });
    await db.color.updateMany({ where: { id: { in: made.colors } }, data: { isActive: false } });
    await browser?.close(); await db.$disconnect();
  });
  const open = async () => { const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: "fa-IR" }); const pg = await ctx.newPage(); await pg.goto(`${BASE}/product/${pslug}`, { waitUntil: "networkidle" }); await pg.getByTestId("variant-picker").waitFor(); return { ctx, pg }; };

  it("nothing chosen: every model/colour with a buyable variant is selectable; zero-stock and inactive ones are not", async () => {
    const { ctx, pg } = await open();
    const m = (n: string) => chip(pg, "model-chip", `${n} ${tag}`), c = (n: string) => chip(pg, "color-chip", `${n} ${tag}`);
    for (const n of ["i13", "i14", "gx"]) assert.equal(await m(n).isDisabled(), false, n);
    assert.equal(await c("black").isDisabled(), false); assert.equal(await c("white").isDisabled(), false);
    assert.equal(await c("green").isDisabled(), true, "Green: only variant has stock 0");
    assert.equal(await pg.locator("[data-buy]").isDisabled(), true);
    await shot(pg, "p12-1-initial"); await ctx.close();
  });

  it("Color → Model, and Model → Color (the examples from the requirements)", async () => {
    const { ctx, pg } = await open();
    const m = (n: string) => chip(pg, "model-chip", `${n} ${tag}`), c = (n: string) => chip(pg, "color-chip", `${n} ${tag}`);
    await c("white").click();                                       // white exists (buyable) only on iPhone 14; the inactive i13+white is ignored
    assert.equal(await m("i14").isDisabled(), false); assert.equal(await m("i13").isDisabled(), true, "inactive variant is not selectable"); assert.equal(await m("gx").isDisabled(), true);
    await c("white").click();                                       // unselect
    await c("black").click();
    for (const n of ["i13", "i14", "gx"]) assert.equal(await m(n).isDisabled(), false, "black fits " + n);
    await m("i13").click();                                         // Model after Color → exact variant
    assert.equal(await on(m("i13")), true); assert.equal(await on(c("black")), true);
    assert.equal(await pg.locator("[data-buy]").isDisabled(), false);
    assert.ok((await pg.locator("[data-price]").innerText()).includes("۵۰۰"), "price comes from the found variant");
    // Model → Color on a fresh page
    await pg.reload({ waitUntil: "networkidle" });
    await m("i13").click();
    assert.equal(await c("black").isDisabled(), false); assert.equal(await c("green").isDisabled(), true, "Green unavailable for i13 (stock 0)"); assert.equal(await c("white").isDisabled(), true, "i13+white is inactive");
    await m("i13").click(); await m("i14").click();
    assert.equal(await c("black").isDisabled(), false); assert.equal(await c("white").isDisabled(), false); assert.equal(await c("green").isDisabled(), true);
    await shot(pg, "p12-2-model-first"); await ctx.close();
  });

  it("changing one side after the other: compatible choices are kept, incompatible ones are cleared (no broken state)", async () => {
    const { ctx, pg } = await open();
    const m = (n: string) => chip(pg, "model-chip", `${n} ${tag}`), c = (n: string) => chip(pg, "color-chip", `${n} ${tag}`);
    await m("i14").click(); await c("white").click();               // i14 + white ✓
    assert.equal(await pg.locator("[data-buy]").isDisabled(), false);
    assert.equal(await m("i13").isDisabled(), true, "with White chosen only models that really have a buyable White stay selectable");
    await c("black").click();                                       // change colour: white → black keeps i14 (i14+black exists)
    assert.equal(await on(m("i14")), true); assert.equal(await on(c("black")), true); assert.equal(await on(c("white")), false);
    await m("i13").click();                                         // change model: i13+black exists → both kept
    assert.equal(await on(m("i13")), true); assert.equal(await on(c("black")), true);
    assert.equal(await pg.locator("[data-buy]").isDisabled(), false);
    assert.equal(await c("white").isDisabled(), true, "after choosing i13, White is not offered");
    await c("black").click();                                       // unselect colour → model remains, options recomputed
    assert.equal(await on(m("i13")), true); assert.equal(await on(c("black")), false);
    assert.equal(await pg.locator("[data-buy]").isDisabled(), true, "incomplete selection cannot be bought");
    await m("i13").click();                                         // unselect model too → back to the initial state
    assert.equal(await c("white").isDisabled(), false);
    await ctx.close();
  });

  it("brand / series filters narrow the models, availability still comes from the real variants", async () => {
    const { ctx, pg } = await open();
    const m = (n: string) => chip(pg, "model-chip", `${n} ${tag}`), c = (n: string) => chip(pg, "color-chip", `${n} ${tag}`);
    await pg.getByRole("group", { name: "برند گوشی" }).getByRole("button", { name: `Samsung ${tag}` }).click();
    assert.equal(await m("gx").count(), 1); assert.equal(await m("i13").count(), 0);
    assert.equal(await c("white").isDisabled(), true, "white exists only on Apple → not selectable inside the Samsung filter");
    assert.equal(await c("black").isDisabled(), false);
    await pg.getByRole("group", { name: "برند گوشی" }).getByRole("button", { name: `Apple ${tag}` }).click();
    await pg.getByRole("group", { name: "سری گوشی" }).getByRole("button", { name: `Ser14 ${tag}` }).click();
    assert.equal(await m("i14").count(), 1); assert.equal(await m("i13").count(), 0);
    await m("i14").click(); assert.equal(await c("white").isDisabled(), false);
    await pg.getByRole("group", { name: "سری گوشی" }).getByRole("button", { name: `Ser13 ${tag}` }).click(); // selected model leaves the filter → cleared
    assert.equal(await on(m("i13")), false); assert.equal(await pg.locator("[data-buy]").isDisabled(), true);
    await ctx.close();
  });

  it("all variants out of stock: nothing is selectable and the product cannot be bought", async () => {
    const p = await db.product.findFirstOrThrow({ where: { slug: pslug }, include: { variants: true } });
    const before = await db.inventory.findMany({ where: { variantId: { in: p.variants.map((v) => v.id) } } });
    await db.inventory.updateMany({ where: { variantId: { in: p.variants.map((v) => v.id) } }, data: { quantity: 0 } });
    try {
      const { ctx, pg } = await open();
      assert.equal(await pg.getByTestId("model-chip").evaluateAll((els: HTMLButtonElement[]) => els.every((e) => e.disabled)), true);
      assert.equal(await pg.getByTestId("color-chip").evaluateAll((els: HTMLButtonElement[]) => els.every((e) => e.disabled)), true);
      assert.equal(await pg.locator("[data-buy]").isDisabled(), true); await ctx.close();
    } finally { for (const i of before) await db.inventory.update({ where: { id: i.id }, data: { quantity: i.quantity } }); }
  });

  it("admin matrix: wholesale shows Inherit(base)/Override, bulk set by price and percent, reset to inherit; saved values reach the database", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, locale: "fa-IR" });
    await ctx.addCookies([...admin.jar].map(([name, value]) => ({ name, value, url: BASE })));
    const pg = await ctx.newPage();
    await pg.goto(`${BASE}/admin/products/${pid}`, { waitUntil: "networkidle" });
    await pg.locator("label", { hasText: "قیمت عمده" }).first().locator("input").fill("250000");
    await pg.getByTestId("matrix").waitFor();
    const modes = pg.getByTestId("ws-mode");
    assert.ok((await modes.first().innerText()).includes("ارث‌بری") && (await modes.first().innerText()).includes("۲۵۰٬۰۰۰"), await modes.first().innerText());
    // filter to iPhone 14 rows and set 270000 on them
    await pg.getByLabel("فیلتر جدول").fill(`i14 ${tag}`);
    assert.equal(await pg.getByTestId("vrow").count(), 2);
    await pg.getByLabel("عملیات قیمت همکاری").selectOption("set"); await pg.getByLabel("مقدار قیمت همکاری گروهی").fill("270000"); await pg.getByTestId("bulk-ws").click();
    for (const t of await pg.getByTestId("ws-mode").allInnerTexts()) assert.ok(t.includes("اختصاصی") && t.includes("۲۷۰٬۰۰۰"), t);
    // percentage of the normal price: 500k − 15% = 425k on the gx row
    await pg.getByLabel("فیلتر جدول").fill(`gx ${tag}`);
    await pg.getByLabel("عملیات قیمت همکاری").selectOption("pctBelow"); await pg.getByLabel("مقدار قیمت همکاری گروهی").fill("15"); await pg.getByTestId("bulk-ws").click();
    assert.ok((await pg.getByTestId("ws-mode").first().innerText()).includes("۴۲۵٬۰۰۰"));
    // reset the gx row to inherit
    await pg.getByLabel("عملیات قیمت همکاری").selectOption("inherit"); await pg.getByTestId("bulk-ws").click();
    assert.ok((await pg.getByTestId("ws-mode").first().innerText()).includes("ارث‌بری"));
    await pg.getByLabel("فیلتر جدول").fill("");
    await shot(pg, "p12-3-matrix-wholesale");
    await pg.getByRole("button", { name: "ذخیره تغییرات" }).click();
    await pg.getByText("محصول ذخیره شد.").waitFor();
    const rows = await db.productVariant.findMany({ where: { productId: pid }, include: { phoneModel: true } });
    assert.ok(rows.filter((v) => v.phoneModel?.name.startsWith("i14")).every((v) => v.wholesalePrice === 270_000), "override saved on i14");
    assert.ok(rows.filter((v) => !v.phoneModel?.name.startsWith("i14")).every((v) => v.wholesalePrice === null), "others inherit (null)");
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: pid } })).wholesalePrice, 250_000);
    await ctx.close();
  });
});
