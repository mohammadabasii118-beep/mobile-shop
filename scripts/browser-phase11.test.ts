/** Playwright: variants are managed INSIDE the product form (type switch → generate → matrix → save) and chosen with chips on the product page. SHOTS=/dir writes screenshots. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { BASE, Client, db, loginWithPassword, uid } from "./test-utils";

const PW = process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs";
const SHOTS = process.env.SHOTS;
const tag = uid();
const ok = (r: { status: number; json: any }) => { assert.equal(r.status, 200, JSON.stringify(r.json)); return r.json?.data; };
let browser: any, page: any, admin: Client, catId = "";
const made = { models: [] as string[], colors: [] as string[], brands: [] as string[], cats: [] as string[], products: [] as string[] };
const shot = async (name: string) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage: true }); } };

describe("Phase 11 — variants inside the product form", () => {
  before(async () => {
    await db.rateLimit.deleteMany({});
    const { chromium } = await import(PW);
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
    admin = await loginWithPassword("09120000001", "Admin@12345");
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 1000 }, locale: "fa-IR" });
    await ctx.addCookies([...admin.jar].map(([name, value]) => ({ name, value, url: BASE })));
    page = await ctx.newPage();
    catId = ok(await admin.post("/api/admin/r/categories", { name: "دستهٔ مرورگر " + tag, slug: "cb11-" + tag })).id; made.cats.push(catId);
    const brand = ok(await admin.post("/api/admin/r/brands", { name: "BrandX " + tag, slug: "bx11-" + tag })).id; made.brands.push(brand);
    const series = ok(await admin.post("/api/admin/r/phone-series", { name: "Series9 " + tag, slug: "s9-" + tag, brandId: brand })).id;
    for (const n of ["Alpha", "Beta", "Gamma"]) made.models.push(ok(await admin.post("/api/admin/r/phone-models", { name: `${n} ${tag}`, slug: `${n.toLowerCase()}-${tag}`, brandId: brand, seriesId: series })).id);
    for (const [n, hex] of [["سرخ", "#ff0000"], ["آبی", "#0000ff"]]) made.colors.push(ok(await admin.post("/api/admin/r/colors", { name: `${n} ${tag}`, hex })).id);
  });
  after(async () => {
    await db.product.updateMany({ where: { id: { in: made.products } }, data: { isActive: false } });
    await db.category.updateMany({ where: { id: { in: made.cats } }, data: { isActive: false } });
    await db.brand.updateMany({ where: { id: { in: made.brands } }, data: { isActive: false } });
    await db.phoneModel.updateMany({ where: { id: { in: made.models } }, data: { isActive: false } });
    await db.color.updateMany({ where: { id: { in: made.colors } }, data: { isActive: false } });
    await browser?.close(); await db.$disconnect();
  });

  it("there is no separate variant page in the sidebar; central Attribute and Series managers exist", async () => {
    await page.goto(`${BASE}/admin/products`, { waitUntil: "networkidle" });
    const nav = await page.locator("aside, nav").allInnerTexts();
    const text = nav.join(" ");
    assert.ok(!text.includes("دموی سیستم Variant"), "demo link removed from the sidebar");
    assert.ok(text.includes("Attributeها") && text.includes("سری‌های گوشی") && text.includes("مدل‌های گوشی"));
    assert.equal((await page.goto(`${BASE}/admin/attributes`)).status(), 200);
    assert.equal((await page.goto(`${BASE}/admin/phone-series`)).status(), 200);
  });

  it("new product → variable → generate → matrix → save", async () => {
    await page.goto(`${BASE}/admin/products/new`, { waitUntil: "networkidle" });
    await page.getByLabel("نام محصول *").fill("قاب مرورگر " + tag);
    await page.getByLabel("اسلاگ (آدرس) *").fill("bp11-" + tag);
    await page.getByLabel("SKU اصلی *").fill("BP11-" + tag);
    await page.getByLabel("دسته‌بندی *").selectOption(catId);
    await page.getByLabel("قیمت خرده *").fill("688000");
    await page.getByRole("radio", { name: /محصول متغیر/ }).check();
    await page.getByTestId("variant-generator").waitFor();
    // search + pick two models and both colours
    await page.getByLabel("جستجوی مدل").fill(tag);
    await page.getByTestId("model-chips").getByRole("button", { name: `Alpha ${tag}` }).click();
    await page.getByTestId("model-chips").getByRole("button", { name: `Beta ${tag}` }).click();
    for (const c of ["سرخ", "آبی"]) await page.getByTestId("color-chips").getByRole("button", { name: `${c} ${tag}` }).click();
    await shot("p11-1-generator");
    await page.getByTestId("generate").click();
    assert.equal(await page.getByTestId("vrow").count(), 4);
    assert.equal(await page.getByTestId("generate").isDisabled(), true, "no duplicates can be generated again");
    // all are inactive by default
    assert.equal(await page.getByTestId("vrow").getByLabel("فعال").evaluateAll((els: HTMLInputElement[]) => els.filter((e) => e.checked).length), 0);
    // bulk: stock 7 for all, price +10% , activate only the Alpha rows
    await page.getByLabel("موجودی گروهی").fill("7"); await page.getByRole("button", { name: "اعمال موجودی" }).click();
    await page.getByLabel("عملیات قیمت", { exact: true }).selectOption("incPct"); await page.getByLabel("مقدار قیمت گروهی", { exact: true }).fill("10"); await page.getByTestId("bulk-price").click();
    await page.getByLabel("فیلتر جدول").fill("Alpha");
    assert.equal(await page.getByTestId("vrow").count(), 2);
    await page.getByTestId("bulk-on").click();
    await page.getByLabel("عملیات قیمت ویژه").selectOption("pctBelow"); await page.getByLabel("مقدار قیمت ویژه گروهی").fill("20"); await page.getByTestId("bulk-sale").click();
    await shot("p11-2-matrix");
    await page.getByRole("button", { name: "ایجاد محصول" }).click();
    await page.waitForURL(/\/admin\/products\/(?!new)/);
    const p = await db.product.findFirstOrThrow({ where: { slug: "bp11-" + tag }, include: { variants: { include: { inventory: true, phoneModel: true } } } }); made.products.push(p.id);
    assert.equal(p.productType, "VARIABLE");
    assert.equal(p.variants.length, 4);
    const alpha = p.variants.filter((v) => v.phoneModel?.name.startsWith("Alpha"));
    assert.ok(alpha.every((v) => v.isActive && v.retailPrice === 756_800 && v.salePrice === 605_440 && v.inventory?.quantity === 7), JSON.stringify(alpha.map((v) => [v.isActive, v.retailPrice, v.salePrice])));
    assert.ok(p.variants.filter((v) => !v.phoneModel?.name.startsWith("Alpha")).every((v) => !v.isActive), "untouched combos stay inactive");
    // reopen: matrix shows all four, the type stays variable
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.getByTestId("vrow").count(), 4);
    assert.equal(await page.getByRole("radio", { name: /محصول متغیر/ }).isChecked(), true);
    await shot("p11-3-saved");
  });

  it("product page: model/colour chips, unavailable combos disabled, price follows the variant", async () => {
    const p = await db.product.findFirstOrThrow({ where: { slug: "bp11-" + tag }, include: { variants: { include: { phoneModel: true, colorRef: true } } } });
    // make one Alpha colour out of stock
    const blue = p.variants.find((v) => v.phoneModel?.name.startsWith("Alpha") && v.colorRef?.name.startsWith("آبی"))!;
    await db.inventory.update({ where: { variantId: blue.id }, data: { quantity: 0 } });
    const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: "fa-IR" });
    const u = await ctx.newPage();
    await u.goto(`${BASE}/product/bp11-${tag}`, { waitUntil: "networkidle" });
    await u.getByTestId("variant-picker").waitFor();
    assert.equal(await u.getByTestId("model-chip").count(), 1, "only Alpha has active variants");
    assert.equal(await u.getByTestId("color-chip").first().isDisabled(), true, "colours wait for a model");
    assert.equal(await u.locator("[data-buy]").isDisabled(), true);
    await u.getByTestId("model-chip").click();
    const chips = u.getByTestId("color-chip");
    assert.equal(await chips.filter({ hasText: "آبی" }).isDisabled(), true, "out-of-stock colour is disabled");
    await chips.filter({ hasText: "سرخ" }).click();
    assert.equal(await u.locator("[data-buy]").isDisabled(), false);
    assert.ok((await u.locator("[data-price]").innerText()).includes("۶۰۵٬۴۴۰") || (await u.locator("[data-price]").innerText()).includes("605"), await u.locator("[data-price]").innerText());
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await u.screenshot({ path: path.join(SHOTS, "p11-4-storefront.png"), fullPage: false }); }
    await ctx.close();
  });
});
