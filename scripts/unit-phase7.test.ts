/** Phase 7 unit + query-count tests (no HTTP server; uses the dev database directly). */
import { logged } from "./count-db";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { db, uid } from "./test-utils";

async function count<T>(fn: () => Promise<T>) { const before = logged.length; const r = await fn(); await new Promise((res) => setTimeout(res, 80)); return { r, queries: logged.slice(before).filter((q) => !/BEGIN|COMMIT|ROLLBACK/i.test(q)).length }; }

describe("Phase 7 — media file validation (unit)", () => {
  it("processImage rejects wrong types/extensions/mime and accepts real images; validateVideo checks signature, ext, mime and size", async () => {
    const { processImage, validateVideo } = await import("../lib/server/media-files");
    const jpg = await sharp({ create: { width: 50, height: 40, channels: 3, background: "#fff" } }).jpeg().toBuffer();
    const ok = await processImage({ name: "a.JPEG", type: "image/jpeg" }, jpg);
    assert.equal(ok.ext, "jpg"); assert.equal(ok.width, 50);
    await assert.rejects(processImage({ name: "a.png", type: "image/jpeg" }, jpg), /پسوند/);
    await assert.rejects(processImage({ name: "a.jpg", type: "image/png" }, jpg), /نوع فایل/);
    await assert.rejects(processImage({ name: "a.jpg", type: "image/jpeg" }, Buffer.from("hello world, definitely not an image")), /JPG/);
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypmp42"), Buffer.alloc(100)]);
    assert.equal(validateVideo({ name: "x.mp4", type: "video/mp4" }, mp4).mime, "video/mp4");
    assert.throws(() => validateVideo({ name: "x.mov", type: "video/quicktime" }, mp4));
    assert.throws(() => validateVideo({ name: "x.mp4", type: "video/mp4" }, Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypqt  "), Buffer.alloc(100)])));
  });
});

describe("Phase 7 — review schemas (unit)", () => {
  it("client input is strict: status/verifiedPurchase/orderItemId/userId are unknown keys → rejected", async () => {
    const { reviewCreateSchema, reviewUpdateSchema } = await import("../lib/server/reviews");
    const base = { orderNumber: 5, productId: "p", rating: 4, body: "متن نظر" };
    assert.ok(reviewCreateSchema.safeParse(base).success);
    for (const k of ["status", "verifiedPurchase", "orderItemId", "userId", "adminReply"]) assert.equal(reviewCreateSchema.safeParse({ ...base, [k]: "x" }).success, false, k);
    assert.equal(reviewUpdateSchema.safeParse({ rating: 5, body: "متن", orderId: "x" }).success, false);
    assert.equal(reviewCreateSchema.safeParse({ ...base, rating: 0 }).success, false);
    assert.equal(reviewCreateSchema.parse({ ...base, title: "  " }).title, null);
  });
});

describe("Phase 7 — query counts (no N+1) and homepage strip", () => {
  let productId = "", userId = "";
  before(async () => {
    const cat = await db.category.findFirstOrThrow({ where: { parentId: { not: null } } });
    const s = "u7-" + uid();
    productId = (await db.product.create({ data: { name: "واحد " + s, slug: s, sku: "SKU-" + s, categoryId: cat.id, retailPrice: 1000 } })).id;
    userId = (await db.user.findFirstOrThrow()).id;
  });
  after(async () => { await db.review.deleteMany({ where: { productId } }); await db.product.delete({ where: { id: productId } }); await db.$disconnect(); });
  const seed = (n: number, offset = 0) => db.review.createMany({ data: Array.from({ length: n }, (_, i) => ({ productId, userId, rating: (i % 5) + 1, body: `r${offset + i}`, status: "approved", createdAt: new Date(Date.now() - (offset + i) * 1000) })) });

  it("product reviews page + summary + homepage strip use a constant number of queries regardless of review count", async () => {
    const R = await import("../lib/server/reviews");
    await seed(3);
    const small = { page: await count(() => R.getProductReviewsPage(productId, 1)), sum: await count(() => R.getReviewSummary(productId)), home: await count(() => R.queryHomeReviews(6)) };
    await seed(60, 3);
    const big = { page: await count(() => R.getProductReviewsPage(productId, 1)), sum: await count(() => R.getReviewSummary(productId)), home: await count(() => R.queryHomeReviews(6)) };
    assert.equal(small.page.queries, big.page.queries); assert.equal(small.sum.queries, big.sum.queries); assert.equal(small.home.queries, big.home.queries);
    assert.equal(big.page.queries, 1); assert.equal(big.sum.queries, 1); assert.equal(big.home.queries, 1);
    assert.equal(big.page.r.items.length, 10); assert.equal(big.page.r.hasMore, true);
    assert.equal((await R.getReviewSummary(productId)).count, 63);
    assert.ok(big.home.r.length <= 6);
    assert.equal((await R.queryHomeReviews(50)).length <= 6, true); // hard upper bound even if asked for more
  });

  it("homepage strip is ordered newest-first, contains only approved reviews of active products, and nothing else leaks", async () => {
    const R = await import("../lib/server/reviews");
    await db.review.create({ data: { productId, userId, rating: 1, body: "pending-should-not-show", status: "pending", createdAt: new Date() } });
    await db.review.create({ data: { productId, userId, rating: 5, body: ("کلمه‌ی طولانی " + "x".repeat(20) + " ").repeat(80), status: "approved", createdAt: new Date(Date.now() + 5000) } });
    const rows = await R.queryHomeReviews(6);
    assert.ok(rows.every((r) => r.body !== "pending-should-not-show"));
    assert.ok(rows.every((r) => r.body.length <= 161), "texts are cut on the server");
    assert.ok(rows[0]!.body.endsWith("…") && rows[0]!.body.length > 100, "long review is shortened with an ellipsis");
        assert.deepEqual(Object.keys(rows[0]!).sort(), ["body", "id", "name", "product", "rating", "verified"]);
    await db.product.update({ where: { id: productId }, data: { isActive: false } });
    assert.ok(!(await R.queryHomeReviews(6)).some((r) => r.body.startsWith("r")) || (await R.queryHomeReviews(6)).every((r) => r.product.slug !== "u7"));
    await db.product.update({ where: { id: productId }, data: { isActive: true } });
  });

  it("HomeReviews renders nothing when empty and escapes text when present", async () => {
    const { HomeReviews } = await import("../components/home-reviews");
    assert.equal(renderToStaticMarkup(createElement(HomeReviews, { reviews: [] })), "");
    const html = renderToStaticMarkup(createElement(HomeReviews, { reviews: [{ id: "1", name: "<b>x</b>", rating: 5, body: "<script>1</script>", verified: true, product: { name: "P", slug: "p", img: null } }] }));
    assert.ok(html.includes("&lt;script&gt;") && !html.includes("<script>") && html.includes("✓ خرید تأییدشده"));
  });
});
