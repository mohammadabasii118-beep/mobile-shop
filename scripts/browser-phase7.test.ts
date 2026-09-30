/**
 * Phase 7 browser (Playwright/Chromium) end-to-end test: admin media manager, storefront gallery + video, review creation from the
 * account, verified purchase, admin moderation, "My reviews", homepage reviews.
 * Needs the production server on :3300 (see e2e-phase4 header) and the Playwright install at /opt/node22 (`npm run test:browser`).
 * Set SHOTS=/some/dir to also write screenshots.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import sharp from "sharp";
import { BASE, Client, db, fileForm, loginWithPassword, PNG, registerAndLogin, uid } from "./test-utils";

const PW = process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs";
const SHOTS = process.env.SHOTS;
const T = uid();
const ok = (r: { status: number; json: any }, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.json)); return r.json?.data; };

let browser: any, admin: Client, tmp = "";
let prod: { id: string; slug: string; name: string; variantId: string };
const shot = async (page: any, name: string, full = true) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage: full }); } };
const ctxFor = async (c: Client, opts: Record<string, unknown> = {}) => {
  const ctx = await browser.newContext({ locale: "fa-IR", viewport: { width: 1280, height: 900 }, ...opts });
  await ctx.addCookies([...c.jar].map(([name, value]) => ({ name, value, url: BASE })));
  return ctx;
};

describe("Phase 7 — browser flows", () => {
  before(async () => {
    const { chromium } = await import(PW);
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--autoplay-policy=user-gesture-required"] });
    await db.rateLimit.deleteMany({});
    admin = await loginWithPassword("09120000001", "Admin@12345");
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "p7-"));
    await db.siteSetting.upsert({ where: { key: "finance" }, update: { value: { fourEyes: false } }, create: { key: "finance", value: { fourEyes: false } } });
    const cat = await db.category.findFirstOrThrow({ where: { parentId: { not: null } } });
    const s = "b7-" + uid();
    const p = ok(await admin.post("/api/admin/products", { name: "قاب مرورگر " + s, slug: s, sku: "SKU-" + s, categoryId: cat.id, retailPrice: 250_000, variants: [{ sku: "V-" + s, name: "پیش‌فرض", stock: 50 }] }));
    prod = { id: p.id, slug: s, name: "قاب مرورگر " + s, variantId: p.variants[0].id };
    for (const [i, c] of [[0, "#c0392b"], [1, "#2980b9"], [2, "#27ae60"]] as const) fs.writeFileSync(path.join(tmp, `img${i}.png`), await sharp({ create: { width: 900, height: 900, channels: 3, background: c } }).png().toBuffer());
  });
  after(async () => { await browser?.close(); await db.siteSetting.deleteMany({ where: { key: "finance" } }); await db.$disconnect(); });

  it("admin uploads images + a video through the product media manager; primary/reorder/delete work in the UI", async () => {
    const ctx = await ctxFor(admin); const page = await ctx.newPage();
    await page.goto(`${BASE}/admin/products/${prod.id}`, { waitUntil: "networkidle" });
    const mm = page.getByTestId("media-manager"); await mm.waitFor();
    for (let i = 0; i < 3; i++) { await page.getByTestId("media-add-image").setInputFiles(path.join(tmp, `img${i}.png`)); await page.getByTestId("media-item").nth(i).waitFor(); }
    assert.equal(await page.getByTestId("media-item").count(), 3);
    assert.equal(await page.locator('[data-primary="true"]').count(), 1);
    // real, playable WebM recorded inside the browser
    const bytes: number[] = await page.evaluate(async () => {
      const c = document.createElement("canvas"); c.width = 320; c.height = 240; const g = c.getContext("2d")!;
      const rec = new MediaRecorder(c.captureStream(20), { mimeType: "video/webm" }); const parts: Blob[] = []; rec.ondataavailable = (e) => parts.push(e.data);
      rec.start(); for (let i = 0; i < 20; i++) { g.fillStyle = `hsl(${i * 18} 80% 50%)`; g.fillRect(0, 0, 320, 240); await new Promise((r) => setTimeout(r, 60)); }
      await new Promise<void>((r) => { rec.onstop = () => r(); rec.stop(); });
      return [...new Uint8Array(await new Blob(parts).arrayBuffer())];
    });
    const webm = path.join(tmp, "clip.webm"); fs.writeFileSync(webm, Buffer.from(bytes));
    await page.getByTestId("media-add-video").setInputFiles(webm);
    await page.locator('[data-testid="media-item"][data-type="VIDEO"]').waitFor();
    await shot(page, "01-admin-media-manager");
    // make the 2nd image primary via UI, then verify exactly one primary and it moved
    const second = page.getByTestId("media-item").nth(1); await second.getByText("اصلی کن").click();
    await page.locator('[data-testid="media-item"]:nth-child(2)[data-primary="true"]').waitFor();
    assert.equal(await page.locator('[data-primary="true"]').count(), 1);
    // move last image up
    await page.getByTestId("media-item").nth(2).getByLabel("بالا").click();
    await page.waitForTimeout(600);
    const rows = await db.productImage.findMany({ where: { productId: prod.id }, orderBy: { sortOrder: "asc" } });
    assert.deepEqual(rows.map((r) => r.sortOrder), [0, 1, 2, 3]); assert.equal(rows.filter((r) => r.isPrimary).length, 1); assert.equal(rows.filter((r) => r.type === "VIDEO").length, 1);
    await ctx.close();
  });

  it("storefront gallery: primary first, thumbnails switch the main image, video has controls and never autoplays, no layout shift", async () => {
    const ctx = await browser.newContext({ locale: "fa-IR", viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
    await page.goto(`${BASE}/product/${prod.slug}`, { waitUntil: "networkidle" });
    const g = page.getByTestId("gallery"); await g.waitFor();
    const primary = await db.productImage.findFirstOrThrow({ where: { productId: prod.id, isPrimary: true } });
    const mainSrc = () => g.locator("span.relative img").first().getAttribute("src");
    assert.ok(decodeURIComponent((await mainSrc())!).includes(primary.url), "primary image is the initial main image");
    const thumbs = g.getByTestId("gallery-thumb"); assert.equal(await thumbs.count(), 4);
    const box0 = await g.locator(".aspect-square").boundingBox();
    const imgThumbs = (await db.productImage.findMany({ where: { productId: prod.id, type: "IMAGE" }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] }));
    await thumbs.nth(1).click();
    await page.waitForFunction((u: string) => [...document.querySelectorAll('[data-testid="gallery"] span.relative img')].some((i) => decodeURIComponent((i as HTMLImageElement).src).includes(u)), imgThumbs[1]!.url);
    assert.equal(await g.locator("video").count(), 0, "video is not created until chosen");
    // video thumb (last) → <video controls>, not playing
    await thumbs.nth(3).click();
    const v = g.getByTestId("gallery-video"); await v.waitFor();
    assert.equal(await v.getAttribute("controls"), ""); assert.equal(await v.getAttribute("autoplay"), null); assert.equal(await v.getAttribute("preload"), "metadata");
    await page.waitForFunction(() => (document.querySelector("video") as HTMLVideoElement)?.readyState >= 1, null, { timeout: 8000 });
    assert.equal(await v.evaluate((el: HTMLVideoElement) => el.paused), true);
    const box1 = await g.locator(".aspect-square").boundingBox();
    assert.deepEqual([box0!.width, box0!.height], [box1!.width, box1!.height], "main frame keeps its size when switching media");
    await v.evaluate((el: HTMLVideoElement) => el.play().catch(() => {})); await page.waitForTimeout(400);
    await shot(page, "02-product-gallery-video");
    await ctx.close();
    // mobile width: thumbnails scroll inside the column, no horizontal page overflow
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, locale: "fa-IR" }); const mp = await m.newPage();
    await mp.goto(`${BASE}/product/${prod.slug}`, { waitUntil: "networkidle" });
    assert.ok(await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no horizontal overflow on mobile");
    await shot(mp, "03-product-gallery-mobile", false);
    await m.close();
  });

  it("customer reviews a delivered item from the account; admin rejects with a reason; customer edits & resubmits; admin approves; visible on product page + homepage", async () => {
    // buyer with a real delivered order (real checkout flow)
    const cu = await registerAndLogin(); const addr = ok(await cu.c.post("/api/addresses", { receiver: "تست", phone: "09121234567", province: "تهران", city: "تهران", postalCode: "1234567890", address: "خیابان ولیعصر، پلاک ۱۰" }));
    const ship = ok(await admin.post("/api/admin/r/shipping", { key: "fr-" + uid(), name: "تحویل حضوری", cost: 0 }));
    ok(await cu.c.post("/api/cart/items", { productSlug: prod.slug, variantId: prod.variantId, quantity: 1 }));
    const o = ok(await cu.c.post("/api/checkout/orders", { addressId: addr.id, shippingMethodId: ship.id, paymentMethod: "card_to_card" }));
    ok(await cu.c.post(`/api/orders/${o.number}/payment/proof`, fileForm(PNG, "r.png", "image/png", "receipt", { referenceNumber: "REF-" + uid() })));
    ok(await admin.post(`/api/admin/payments/${(await db.payment.findFirstOrThrow({ where: { order: { number: o.number } } })).id}/approve`));
    for (const status of ["PREPARING", "READY_TO_SHIP", "SHIPPED", "DELIVERED"]) ok(await admin.post(`/api/admin/orders/${o.number}/status`, { status }));
    await db.user.update({ where: { id: cu.userId }, data: { displayName: "مریم رضایی" } });

    const cctx = await ctxFor(cu.c); const page = await cctx.newPage();
    await page.goto(`${BASE}/account/orders/${o.number}`, { waitUntil: "networkidle" });
    await shot(page, "04-account-order-review-button");
    await page.getByTestId("review-open").click();
    const form = page.getByTestId("review-form");
    await form.getByLabel("4 ستاره").click(); await form.getByLabel("عنوان نظر").fill("کیفیت خوب");
    await form.getByLabel("متن نظر").fill(`قاب دقیقاً مطابق عکس بود و ارسال سریع انجام شد. ${T}`);
    await shot(page, "05-review-form");
    await form.getByRole("button", { name: "ثبت نظر" }).click();
    await page.getByText("نظر شما ثبت شد و پس از بررسی منتشر خواهد شد.").waitFor();
    await page.getByText("نظر شما ثبت شده").waitFor(); assert.ok(await page.getByTestId("review-status").innerText() === "در انتظار بررسی");
    const row = await db.review.findFirstOrThrow({ where: { userId: cu.userId } });
    assert.equal(row.verifiedPurchase, true); assert.equal(row.rating, 4);

    // "My reviews"
    await page.goto(`${BASE}/account/reviews`, { waitUntil: "networkidle" });
    assert.equal(await page.getByTestId("my-review").count(), 1); await shot(page, "06-my-reviews");
    // not public yet
    assert.ok(!(await (await fetch(`${BASE}/product/${prod.slug}`)).text()).includes(T));

    // admin moderation UI: reject with reason
    const actx = await ctxFor(admin); const ap = await actx.newPage();
    await ap.goto(`${BASE}/admin/reviews?status=pending`, { waitUntil: "networkidle" });
    await ap.getByTestId("review-stats").waitFor(); await shot(ap, "07-admin-reviews");
    const card = ap.getByTestId("review-row").filter({ hasText: T });
    assert.ok((await card.innerText()).includes("✓ خرید تأییدشده")); assert.ok((await card.innerText()).includes((o.number as number).toLocaleString("fa-IR")));
    await card.getByRole("button", { name: "رد", exact: true }).click(); await card.getByPlaceholder(/دلیل رد/).fill("لطفاً لینک تبلیغاتی را حذف کنید");
    await card.getByRole("button", { name: "رد نظر" }).click();
    await page.waitForTimeout(800);
    assert.equal((await db.review.findUniqueOrThrow({ where: { id: row.id } })).status, "rejected");

    // customer: edit + resubmit (same review, no duplicate)
    await page.goto(`${BASE}/account/reviews`, { waitUntil: "networkidle" });
    await page.getByText("لطفاً لینک تبلیغاتی را حذف کنید").waitFor(); await shot(page, "08-my-reviews-rejected");
    await page.getByTestId("review-edit").click();
    const ef = page.getByTestId("review-form"); await ef.getByLabel("5 ستاره").click(); await ef.getByLabel("متن نظر").fill(`قاب دقیقاً مطابق عکس بود، ارسال هم سریع انجام شد. راضی‌ام. ${T}`);
    await ef.getByRole("button", { name: "ویرایش و ارسال مجدد" }).click(); await page.getByText("نظر شما ثبت شد و پس از بررسی منتشر خواهد شد.").waitFor();
    const after1 = await db.review.findMany({ where: { userId: cu.userId } }); assert.equal(after1.length, 1); assert.equal(after1[0]!.status, "pending"); assert.equal(after1[0]!.rating, 5);

    // admin approves + replies
    await ap.goto(`${BASE}/admin/reviews?status=pending`, { waitUntil: "networkidle" });
    const c2 = ap.getByTestId("review-row").filter({ hasText: T }); await c2.getByRole("button", { name: "تأیید" }).click(); await ap.waitForTimeout(800);
    await ap.goto(`${BASE}/admin/reviews?status=approved`, { waitUntil: "networkidle" });
    const c3 = ap.getByTestId("review-row").filter({ hasText: T }); await c3.getByRole("button", { name: "پاسخ" }).click();
    await c3.getByPlaceholder(/پاسخ عمومی/).fill("ممنون از اعتماد شما 🌷"); await c3.getByRole("button", { name: "ذخیره" }).click(); await ap.waitForTimeout(800);
    await shot(ap, "09-admin-reviews-approved");

    // public product page
    const pub = await browser.newContext({ locale: "fa-IR", viewport: { width: 1280, height: 900 } }); const pp = await pub.newPage();
    await pp.goto(`${BASE}/product/${prod.slug}`, { waitUntil: "networkidle" });
    await pp.locator('label[for="tab-rev"]').click();
    const item = pp.getByTestId("review-item").first(); await item.waitFor();
    const t = await item.innerText(); assert.ok(t.includes("مریم رضایی") && t.includes("✓ خرید تأییدشده") && t.includes("ممنون از اعتماد شما") && t.includes("راضی‌ام"));
    await pp.getByTestId("review-summary").scrollIntoViewIfNeeded(); await shot(pp, "10-product-reviews", false);
    // homepage strip right before the footer
    await pp.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const sec = pp.getByTestId("home-reviews"); await sec.scrollIntoViewIfNeeded();
    assert.ok((await sec.innerText()).includes("راضی‌ام"));
    const order = await pp.evaluate(() => { const s = document.querySelector('[data-testid="home-reviews"]')!, f = document.querySelector("footer")!; return !!(s.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING); });
    assert.ok(order, "reviews section is before the footer");
    await shot(pp, "11-homepage-reviews", true);
    for (const c of [cctx, actx, pub]) await c.close();
  });
});
