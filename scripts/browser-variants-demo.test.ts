/** Playwright check of the Variant-system PROTOTYPE (/admin/variants-demo): demo data only, nothing is saved. SHOTS=/dir writes screenshots. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { BASE, Client, db, loginWithPassword } from "./test-utils";

const PW = process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs";
const SHOTS = process.env.SHOTS;
let browser: any, page: any, ctx: any;
const num = (t: string) => Number(t.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[^\d]/g, "") || 0);
const shot = async (name: string, full = true) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage: full }); } };

describe("Variant system prototype", () => {
  before(async () => {
    const { chromium } = await import(PW);
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
    const admin: Client = await loginWithPassword("09120000001", "Admin@12345");
    ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, locale: "fa-IR" });
    await ctx.addCookies([...admin.jar].map(([name, value]) => ({ name, value, url: BASE })));
    page = await ctx.newPage(); await page.goto(`${BASE}/admin/variants-demo`, { waitUntil: "networkidle" });
  });
  after(async () => { await browser?.close(); await db.$disconnect(); });
  const tab = (n: number) => page.getByRole("tab").nth(n).click();

  it("product editor: attributes, model picker (search / brand / series), generate, bulk edit, matrix", async () => {
    await page.getByTestId("matrix").waitFor();
    assert.equal(await page.getByTestId("vrow").count() > 0, true);
    await shot("v1-product-editor");
    // pick all Samsung models (brand button), add 2 colours, generate
    await page.getByTestId("model-picker").getByRole("button", { name: /^Samsung/ }).click();
    await page.getByTestId("pick-all").click();
    const fresh = num(await page.getByTestId("gen-new").innerText());
    assert.ok(fresh > 0, "new combinations are detected");
    await shot("v2-model-picker");
    await page.getByTestId("gen-go").click();
    await page.waitForTimeout(200);
    const heading = await page.getByTestId("matrix").locator("h2").innerText(); assert.ok(heading.includes("Variant"));
    assert.equal(await page.getByTestId("gen-new").innerText(), "۰", "nothing left to generate (no duplicates)");
    // bulk: filter by brand Samsung, deactivate all, then activate again
    await page.getByLabel("برند").selectOption("Samsung");
    await page.getByTestId("bulk-off").click();
    await page.getByLabel("وضعیت").selectOption("inactive");
    assert.ok((await page.getByTestId("vrow").count()) >= 1);
    await page.getByTestId("bulk-on").click();
    await page.getByLabel("وضعیت").selectOption("all"); await page.getByLabel("برند").selectOption("");
    await shot("v3-matrix-list");
  });

  it("matrix view: model × colour grid toggles combinations", async () => {
    await page.getByTestId("view-pivot").click();
    const cell = page.getByTestId("cell-ip13p-c-white"); await cell.waitFor();
    assert.equal(await cell.getAttribute("data-state"), "off");
    await cell.click(); assert.equal(await cell.getAttribute("data-state"), "ok");
    await cell.click(); assert.equal(await cell.getAttribute("data-state"), "off");
    await shot("v4-matrix-pivot"); await page.getByTestId("view-list").click();
  });

  it("central attributes: a new phone model is immediately selectable on the product", async () => {
    await tab(0);
    await page.getByTestId("attr-add").getByRole("textbox").first().fill("Google Pixel 10");
    await page.getByTestId("attr-add").locator("select").selectOption("Google");
    await page.getByTestId("attr-add").getByRole("button", { name: "افزودن" }).click();
    await shot("v5-attributes");
    await tab(1);
    await page.getByLabel("جستجوی مدل").fill("Pixel 10");
    await page.getByTestId("model-picker").getByText("Google Pixel 10").first().waitFor();
    await page.getByLabel("جستجوی مدل").fill("");
  });

  it("storefront preview: impossible combinations are not selectable, price/stock follow the variant", async () => {
    await tab(2);
    const preview = page.getByTestId("store-preview");
    // iPhone 15 Pro has a 728,000 override; the base price is 688,000
    assert.ok((await page.getByTestId("store-price").innerText()).includes("۶۸۸"));
    await page.getByTestId("opt-model-ip15p").click();
    await page.getByTestId("opt-color-c-black").click();
    assert.ok((await page.getByTestId("store-price").innerText()).includes("۷۲۸"), "variant price override");
    // iPhone 13 Pro + white is switched off in the matrix → white is disabled once iPhone 13 Pro is chosen
    await page.getByTestId("opt-model-ip13p").click();
    assert.equal(await page.getByTestId("opt-color-c-white").getAttribute("data-state"), "none");
    assert.equal(await page.getByTestId("opt-color-c-white").isDisabled(), true);
    await shot("v6-storefront");
    // iPhone 14 + white has zero stock → shown as out of stock, not selectable
    await page.getByTestId("opt-model-ip13p").click(); await page.getByTestId("opt-color-c-black").click(); await page.getByTestId("opt-model-ip14").click();
    assert.equal(await page.getByTestId("opt-color-c-white").getAttribute("data-state"), "out");
    assert.equal(await preview.locator("button", { hasText: "ابتدا" }).isDisabled(), true, "add-to-cart is disabled until a valid combination is chosen");
  });
});
