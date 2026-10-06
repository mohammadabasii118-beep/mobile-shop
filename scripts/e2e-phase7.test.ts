/**
 * Phase 7 integration tests: product media (images + video), reviews, verified purchase, account reviews, admin moderation,
 * homepage reviews, security and query counts. Server must be running (see e2e-phase4 header).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { BASE, Client, PNG, db, fileForm, loginWithPassword, registerAndLogin, uid } from "./test-utils";

let admin: Client;
let freeShip = "", catId = "";
const ok = (r: { status: number; json: any }, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.json)); return r.json?.data; };
const code = (r: { json: any }) => r.json?.error?.code;

async function testProduct(variants = 1) {
  const s = "p7-" + uid();
  const p = ok(await admin.post("/api/admin/products", { name: "کالای فاز۷ " + s, slug: s, sku: "SKU-" + s, categoryId: catId, retailPrice: 100_000, variants: Array.from({ length: variants }, (_, i) => ({ sku: `V${i}-${s}`, name: `تنوع ${i + 1}`, stock: 100 })) }));
  return { slug: s, id: p.id as string, variantIds: (p.variants as { id: string }[]).map((v) => v.id) };
}
async function customer() {
  const r = await registerAndLogin();
  const a = await r.c.post("/api/addresses", { receiver: "تست", phone: "09121234567", province: "تهران", city: "تهران", postalCode: "1234567890", address: "خیابان ولیعصر، پلاک ۱۰" });
  return { ...r, addressId: ok(a).id as string };
}
type Cust = Awaited<ReturnType<typeof customer>>;
async function order(cu: Cust, prod: { slug: string }, variantId: string) {
  ok(await cu.c.post("/api/cart/items", { productSlug: prod.slug, variantId, quantity: 1 }));
  return ok(await cu.c.post("/api/checkout/orders", { addressId: cu.addressId, shippingMethodId: freeShip, paymentMethod: "card_to_card" })) as { number: number };
}
async function deliver(cu: Cust, number: number) {
  ok(await cu.c.post(`/api/orders/${number}/payment/proof`, fileForm(PNG, "r.png", "image/png", "receipt", { referenceNumber: "REF-" + uid() })));
  const pay = await db.payment.findFirstOrThrow({ where: { order: { number } } });
  ok(await admin.post(`/api/admin/payments/${pay.id}/approve`));
  for (const status of ["PREPARING", "READY_TO_SHIP", "SHIPPED", "DELIVERED"]) ok(await admin.post(`/api/admin/orders/${number}/status`, { status }));
}
/** A buyer with a DELIVERED order for `prod` (variant index `vi`). */
async function buyer(prod: { slug: string; variantIds: string[] }, vi = 0) {
  const cu = await customer(); const o = await order(cu, prod, prod.variantIds[vi]!); await deliver(cu, o.number);
  return { ...cu, number: o.number };
}
const png = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 30, b: 60 } } }).png().toBuffer();
const upload = (prod: { id: string }, buf: Buffer, name: string, type: string, kind: "IMAGE" | "VIDEO" = "IMAGE", c = admin) => c.post(`/api/admin/products/${prod.id}/media`, fileForm(buf, name, type, "file", { type: kind }));
const list = async (prod: { id: string }) => ok(await admin.get(`/api/admin/products/${prod.id}/media`)) as { id: string; type: string; url: string; isPrimary: boolean; sortOrder: number; width: number | null }[];
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(4), Buffer.from("isomiso2"), Buffer.alloc(200, 7)]);
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x42, 0x82, 0x84]), Buffer.from("webm"), Buffer.alloc(200, 9)]);
const page = async (slug: string) => (await new Client().get(`/product/${slug}`)).text;

describe("Phase 7 — media", () => {
  before(async () => {
    await db.rateLimit.deleteMany({});
    admin = await loginWithPassword("09120000001", "Admin@12345");
    catId = (await db.category.findFirstOrThrow({ where: { parentId: { not: null } } })).id;
    freeShip = ok(await admin.post("/api/admin/r/shipping", { key: "free-" + uid(), name: "تحویل حضوری تست", cost: 0 })).id;
    await db.siteSetting.upsert({ where: { key: "finance" }, update: { value: { fourEyes: false } }, create: { key: "finance", value: { fourEyes: false } } });
  });
  after(async () => { await db.siteSetting.deleteMany({ where: { key: "finance" } }); await db.$disconnect(); });

  it("1. multiple images: first upload is primary, sortOrder is 0..n-1, exactly one primary, files stored under generated names", async () => {
    const p = await testProduct();
    for (let i = 0; i < 3; i++) ok(await upload(p, await png(300 + i, 300), `photo-${i}.png`, "image/png"));
    const m = await list(p);
    assert.equal(m.length, 3); assert.deepEqual(m.map((x) => x.sortOrder), [0, 1, 2]);
    assert.equal(m.filter((x) => x.isPrimary).length, 1); assert.ok(m[0]!.isPrimary);
    assert.ok(m.every((x) => /^\/media\/images\/[0-9a-f-]{36}\.png$/.test(x.url)));
    const fetched = await fetch(BASE + m[0]!.url); assert.equal(fetched.status, 200); assert.equal(fetched.headers.get("content-type"), "image/png");
  });

  it("2. set primary moves the flag (still exactly one); reorder is deterministic; a mismatching list is refused", async () => {
    const p = await testProduct();
    for (let i = 0; i < 3; i++) ok(await upload(p, await png(200, 200 + i), `p${i}.png`, "image/png"));
    let m = await list(p);
    ok(await admin.patch(`/api/admin/products/${p.id}/media/${m[2]!.id}`, { isPrimary: true }));
    m = await list(p); assert.equal(m.filter((x) => x.isPrimary).length, 1); assert.ok(m.find((x) => x.id === m[2]!.id)!.isPrimary);
    const ids = m.map((x) => x.id).reverse();
    ok(await admin.post(`/api/admin/products/${p.id}/media/reorder`, { ids }));
    assert.deepEqual((await list(p)).map((x) => x.id), ids);
    assert.equal((await admin.post(`/api/admin/products/${p.id}/media/reorder`, { ids: ids.slice(1) })).status, 400);
    assert.equal((await admin.post(`/api/admin/products/${p.id}/media/reorder`, { ids: [ids[0], ids[0], ids[1]] })).status, 400);
    assert.equal((await admin.patch(`/api/admin/products/${p.id}/media/${m[0]!.id}`, { isPrimary: false })).status, 422);
  });

  it("3. deleting the primary promotes the next image; deleting the last leaves the product intact; file is removed", async () => {
    const p = await testProduct();
    ok(await upload(p, await png(200, 200), "a.png", "image/png")); ok(await upload(p, await png(210, 200), "b.png", "image/png"));
    const [a, b] = await list(p); assert.ok(a!.isPrimary);
    ok(await admin.del(`/api/admin/products/${p.id}/media/${a!.id}`));
    const rest = await list(p); assert.equal(rest.length, 1); assert.ok(rest[0]!.isPrimary); assert.equal(rest[0]!.id, b!.id); assert.equal(rest[0]!.sortOrder, 0);
    assert.equal((await fetch(BASE + a!.url)).status, 404);
    ok(await admin.del(`/api/admin/products/${p.id}/media/${b!.id}`));
    assert.equal((await list(p)).length, 0);
    assert.ok(await db.product.findUnique({ where: { id: p.id } }), "product survives media deletion");
    assert.equal((await new Client().get(`/product/${p.slug}`)).status, 200);
    assert.equal((await admin.del(`/api/admin/products/${p.id}/media/${b!.id}`)).status, 404);
  });

  it("4. media API is permission-gated and product-scoped", async () => {
    const p = await testProduct(), q = await testProduct();
    const cu = await registerAndLogin();
    assert.ok([401, 403].includes((await upload(p, PNG, "x.png", "image/png", "IMAGE", cu.c)).status));
    assert.equal((await new Client().get(`/api/admin/products/${p.id}/media`)).status, 401);
    ok(await upload(q, await png(100, 100), "q.png", "image/png"));
    const qm = (await list(q))[0]!;
    assert.equal((await admin.del(`/api/admin/products/${p.id}/media/${qm.id}`)).status, 404); // another product's media id
    assert.equal((await list(q)).length, 1);
  });

  it("5. upload security: disguised, spoofed, SVG, GIF, corrupt, oversized and empty files are all refused", async () => {
    const p = await testProduct();
    const bad: [string, Buffer, string, string][] = [
      ["script as png", Buffer.from("<?php system($_GET['c']); ?>".repeat(5)), "shell.png", "image/png"],
      ["exe as png", Buffer.concat([Buffer.from("MZ"), Buffer.alloc(300)]), "a.exe.png", "image/png"],
      ["svg", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "x.svg", "image/svg+xml"],
      ["svg as png", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "x.png", "image/png"],
      ["gif", Buffer.from("GIF89a" + "\0".repeat(50)), "x.gif", "image/gif"],
      ["ext mismatch", PNG, "x.jpg", "image/png"],
      ["mime mismatch", PNG, "x.png", "image/jpeg"],
      ["corrupt png (valid magic, garbage body)", Buffer.concat([PNG.subarray(0, 16), Buffer.alloc(200, 1)]), "x.png", "image/png"],
      ["empty", Buffer.alloc(0), "x.png", "image/png"],
    ];
    for (const [n, buf, name, type] of bad) { const r = await upload(p, buf, name, type); assert.ok(r.status >= 400 && r.status < 500, `${n}: ${r.status}`); }
    const big = Buffer.concat([PNG, Buffer.alloc(9 * 1024 * 1024)]);
    assert.equal((await upload(p, big, "big.png", "image/png")).status, 400);
    assert.equal((await list(p)).length, 0);
  });

  it("6. huge images are resized (≤2000 px) and EXIF/metadata are stripped", async () => {
    const p = await testProduct();
    const big = await sharp({ create: { width: 3600, height: 2400, channels: 3, background: "#123456" } }).withExif({ IFD0: { Copyright: "SECRET-CAM-OWNER" } }).jpeg().toBuffer();
    ok(await upload(p, big, "huge.jpg", "image/jpeg"));
    const m = (await list(p))[0]!; assert.equal(m.width, 2000);
    const stored = Buffer.from(await (await fetch(BASE + m.url)).arrayBuffer());
    const meta = await sharp(stored).metadata(); assert.equal(meta.width, 2000); assert.equal(meta.height, 1333);
    assert.equal(meta.exif, undefined); assert.ok(!stored.includes(Buffer.from("SECRET-CAM-OWNER")));
    const row = await db.productImage.findUniqueOrThrow({ where: { id: m.id } });
    assert.equal(row.mimeType, "image/jpeg"); assert.ok(row.fileSize && row.fileSize === stored.length); assert.equal(row.type, "IMAGE");
  });

  it("7. video: mp4/webm accepted (limit 3, not primary, no effect on images); fakes and oversize refused; Range works", async () => {
    const p = await testProduct();
    ok(await upload(p, await png(200, 200), "a.png", "image/png"));
    const v1 = ok(await upload(p, MP4, "clip.mp4", "video/mp4", "VIDEO")); ok(await upload(p, WEBM, "clip.webm", "video/webm", "VIDEO"));
    assert.equal(v1.type, "VIDEO"); assert.equal(v1.isPrimary, false); assert.match(v1.url, /^\/media\/videos\/[0-9a-f-]{36}\.mp4$/);
    assert.equal((await upload(p, Buffer.from("not a video ".repeat(20)), "f.mp4", "video/mp4", "VIDEO")).status, 400);
    assert.equal((await upload(p, PNG, "f.mp4", "video/mp4", "VIDEO")).status, 400);
    assert.equal((await upload(p, MP4, "f.webm", "video/webm", "VIDEO")).status, 400);
    assert.equal((await upload(p, MP4, "f.mp4", "video/quicktime", "VIDEO")).status, 400);
    assert.equal((await upload(p, Buffer.concat([MP4, Buffer.alloc(26 * 1024 * 1024)]), "big.mp4", "video/mp4", "VIDEO")).status, 400);
    assert.equal((await upload(p, Buffer.from("<script>alert(1)</script>"), "a.html", "text/html", "VIDEO")).status, 400);
    ok(await upload(p, MP4, "c.mp4", "video/mp4", "VIDEO"));
    assert.equal((await upload(p, MP4, "d.mp4", "video/mp4", "VIDEO")).status, 409);
    const m = await list(p); assert.equal(m.filter((x) => x.type === "VIDEO").length, 3); assert.equal(m.filter((x) => x.isPrimary).length, 1);
    assert.equal((await admin.patch(`/api/admin/products/${p.id}/media/${v1.id}`, { isPrimary: true })).status, 400);
    // Range → 206 with correct slice; open range; out-of-range 416; full → 200 accept-ranges
    const r = await fetch(BASE + v1.url, { headers: { range: "bytes=10-19" } });
    assert.equal(r.status, 206); assert.equal(r.headers.get("content-range"), `bytes 10-19/${MP4.length}`);
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), MP4.subarray(10, 20));
    assert.equal((await fetch(BASE + v1.url, { headers: { range: "bytes=100000-" } })).status, 416);
    const tail = await fetch(BASE + v1.url, { headers: { range: "bytes=-8" } }); assert.equal(tail.status, 206); assert.equal((await tail.arrayBuffer()).byteLength, 8);
    const full = await fetch(BASE + v1.url); assert.equal(full.status, 200); assert.equal(full.headers.get("accept-ranges"), "bytes"); assert.equal(full.headers.get("content-type"), "video/mp4");
    // storefront: gallery shows the primary image first + video thumbnail; nothing autoplays
    const html = await page(p.slug);
    assert.ok(html.includes('data-testid="gallery"')); assert.ok(!/autoplay/i.test(html));
    assert.equal((html.match(/data-testid="gallery-thumb"/g) ?? []).length, 4);
    ok(await admin.del(`/api/admin/products/${p.id}/media/${v1.id}`)); assert.equal((await fetch(BASE + v1.url)).status, 404);
  });

  it("7b. path traversal / non-media keys are not served", async () => {
    for (const k of ["images/../../.env", "videos/..%2f..%2fpackage.json", "receipts/x.png", "images/x.svg", "videos/x.mp3"]) assert.equal((await fetch(`${BASE}/media/${k}`)).status, 404, k);
  });
});

describe("Phase 7 — reviews", () => {
  let prod: Awaited<ReturnType<typeof testProduct>>;
  before(async () => {
    await db.rateLimit.deleteMany({});
    admin = admin ?? (await loginWithPassword("09120000001", "Admin@12345"));
    catId = catId || (await db.category.findFirstOrThrow({ where: { parentId: { not: null } } })).id;
    freeShip = freeShip || ok(await admin.post("/api/admin/r/shipping", { key: "free-" + uid(), name: "تحویل حضوری تست", cost: 0 })).id;
    await db.siteSetting.upsert({ where: { key: "finance" }, update: { value: { fourEyes: false } }, create: { key: "finance", value: { fourEyes: false } } });
    prod = await testProduct(2);
  });
  after(async () => { await db.siteSetting.deleteMany({ where: { key: "finance" } }); });
  const post = (b: { c: Client; number: number }, extra: Record<string, unknown> = {}, productId = prod.id) => b.c.post("/api/reviews", { orderNumber: b.number, productId, rating: 5, body: "کیفیت عالی بود", ...extra });

  it("8. only DELIVERED-order owners can review: not delivered 404, someone else's order 404, no session 401", async () => {
    const cu = await customer(); const o = await order(cu, prod, prod.variantIds[0]!);
    assert.equal((await post({ c: cu.c, number: o.number })).status, 404);
    await deliver(cu, o.number);
    const other = await customer();
    assert.equal((await post({ c: other.c, number: o.number })).status, 404);
    assert.equal((await post({ c: new Client(), number: o.number })).status, 401);
    ok(await post({ c: cu.c, number: o.number }));
    // a product that is not in the (delivered) order
    const p2 = await testProduct(); assert.equal((await post({ c: cu.c, number: o.number }, {}, p2.id)).status, 404);
  });

  it("9. verified purchase is computed by the server; client cannot set status / verifiedPurchase / orderItemId / userId", async () => {
    const b = await buyer(prod);
    for (const evil of [{ status: "approved" }, { verifiedPurchase: false }, { orderItemId: "x" }, { userId: "someone" }]) assert.equal((await post(b, evil)).status, 422, JSON.stringify(evil));
    const r = ok(await post(b, { title: "عنوان" })); assert.equal(r.status, "pending");
    const row = await db.review.findUniqueOrThrow({ where: { id: r.id }, include: { order: { include: { items: true } } } });
    assert.equal(row.verifiedPurchase, true); assert.equal(row.status, "pending"); assert.equal(row.title, "عنوان");
    assert.ok(row.orderItemId && row.order!.items.some((i) => i.id === row.orderItemId && i.productId === prod.id));
    assert.equal(row.userId, b.userId);
  });

  it("10. variant-aware: buying variant 2 lets you review the product; one review per product/order (409, also under a double-submit)", async () => {
    const b = await buyer(prod, 1);
    const [x, y] = await Promise.all([post(b), post(b)]);
    assert.deepEqual([x.status, y.status].sort(), [200, 409]);
    assert.equal(await db.review.count({ where: { userId: b.userId, productId: prod.id } }), 1);
    const row = await db.review.findFirstOrThrow({ where: { userId: b.userId } });
    assert.equal((await db.orderItem.findUniqueOrThrow({ where: { id: row.orderItemId! } })).variantId, prod.variantIds[1]);
  });

  it("11. validation: rating 1–5, body length, title length; text is stored verbatim and rendered escaped (XSS)", async () => {
    const b = await buyer(prod);
    for (const bad of [{ rating: 0 }, { rating: 6 }, { rating: 2.5 }, { body: "ab" }, { body: "x".repeat(1501) }, { title: "t".repeat(81) }]) assert.equal((await post(b, bad)).status, 422, JSON.stringify(bad).slice(0, 40));
    const xss = `<script>window.__x=1</script><img src=x onerror=alert(1)>`;
    const r = ok(await post(b, { title: `<b>${uid()}</b>`, body: xss }));
    ok(await admin.patch(`/api/admin/reviews/${r.id}`, { status: "approved" }));
    const html = await page(prod.slug);
    assert.ok(!html.includes(xss)); assert.ok(html.includes("&lt;script&gt;window.__x=1&lt;/script&gt;"));
    const ld = html.split('application/ld+json">').slice(1).map((s) => s.split("</script>")[0]!).join("");
    assert.ok(!ld.includes("<script")); assert.ok(ld.includes("reviewRating"));
    assert.equal((await db.review.findUniqueOrThrow({ where: { id: r.id } })).body, xss);
  });

  it("12. pending/rejected reviews are invisible publicly; approved appear with verified badge and admin reply; JSON-LD only from approved", async () => {
    const p = await testProduct(); const b = await buyer(p); const text = "متن-یکتا-" + uid();
    const r = ok(await post(b, { body: text, rating: 4 }, p.id));
    let html = await page(p.slug); assert.ok(!html.includes(text)); assert.ok(!html.includes("aggregateRating"));
    ok(await admin.patch(`/api/admin/reviews/${r.id}`, { status: "rejected", reason: "نامناسب" }));
    assert.ok(!(await page(p.slug)).includes(text));
    ok(await admin.patch(`/api/admin/reviews/${r.id}`, { status: "approved" }));
    html = await page(p.slug);
    assert.ok(html.includes(text)); assert.ok(html.includes("✓ خرید تأییدشده")); assert.ok(html.includes('"aggregateRating"'));
    assert.match(html, /"ratingValue":4,"reviewCount":1/);
    ok(await admin.post(`/api/admin/reviews/${r.id}/reply`, { reply: "ممنون از شما" }));
    assert.ok((await page(p.slug)).includes("ممنون از شما"));
    ok(await admin.patch(`/api/admin/reviews/${r.id}`, { status: "pending" }));
    assert.ok(!(await page(p.slug)).includes('"aggregateRating"'));
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: p.id } })).ratingCount, 0);
  });

  it("13. reply is only allowed on approved reviews; moderation is admin-only (customers 403)", async () => {
    const p = await testProduct(); const b = await buyer(p); const r = ok(await post(b, {}, p.id));
    assert.equal((await admin.post(`/api/admin/reviews/${r.id}/reply`, { reply: "x" })).status, 409);
    assert.ok([401, 403].includes((await b.c.patch(`/api/admin/reviews/${r.id}`, { status: "approved" })).status));
    assert.ok([401, 403].includes((await b.c.post(`/api/admin/reviews/${r.id}/reply`, { reply: "x" })).status));
    assert.equal((await db.review.findUniqueOrThrow({ where: { id: r.id } })).status, "pending");
  });

  it("14. rejected review: owner edits and resubmits the SAME row (no duplicate → pending); approved is locked; others cannot touch it", async () => {
    const p = await testProduct(); const b = await buyer(p); const r = ok(await post(b, { body: "نسخه اول" }, p.id));
    const other = await customer();
    assert.equal((await other.c.patch(`/api/reviews/${r.id}`, { rating: 1, body: "هک شد" })).status, 404);
    ok(await admin.patch(`/api/admin/reviews/${r.id}`, { status: "rejected", reason: "لطفاً اصلاح کنید" }));
    assert.equal((await db.review.findUniqueOrThrow({ where: { id: r.id } })).rejectionReason, "لطفاً اصلاح کنید");
    assert.equal((await post(b, {}, p.id)).status, 409); // POST again is a duplicate, never a second row
    assert.equal((await b.c.patch(`/api/reviews/${r.id}`, { rating: 3, body: "نسخه دوم", status: "approved" })).status, 422);
    ok(await b.c.patch(`/api/reviews/${r.id}`, { rating: 3, body: "نسخه دوم", title: "" }));
    const row = await db.review.findUniqueOrThrow({ where: { id: r.id } });
    assert.equal(row.status, "pending"); assert.equal(row.body, "نسخه دوم"); assert.equal(row.rating, 3); assert.equal(row.rejectionReason, null); assert.equal(row.title, null);
    assert.equal(await db.review.count({ where: { userId: b.userId, productId: p.id } }), 1);
    ok(await admin.patch(`/api/admin/reviews/${r.id}`, { status: "approved" }));
    assert.equal((await b.c.patch(`/api/reviews/${r.id}`, { rating: 1, body: "تغییر بعد از انتشار" })).status, 409);
  });

  it("15. account: order page offers «ثبت نظر» per delivered item, then shows the status; «نظرات من» lists only my reviews", async () => {
    const p = await testProduct(); const b = await buyer(p); const stranger = await buyer(p);
    let html = (await b.c.get(`/account/orders/${b.number}`)).text;
    assert.ok(html.includes("ثبت نظر")); assert.ok(!html.includes("نظر شما ثبت شده"));
    const mine = "نظر-من-" + uid(), theirs = "نظر-غریبه-" + uid();
    ok(await post(b, { body: mine }, p.id)); ok(await post(stranger, { body: theirs }, p.id));
    html = (await b.c.get(`/account/orders/${b.number}`)).text; assert.ok(html.includes("نظر شما ثبت شده")); assert.ok(html.includes("در انتظار بررسی"));
    const rv = (await b.c.get("/account/reviews")).text;
    assert.ok(rv.includes(mine)); assert.ok(!rv.includes(theirs)); assert.ok(rv.includes("در انتظار بررسی")); assert.ok(rv.includes(p.slug));
    assert.ok(rv.includes("نظرات من"));
    const rejected = (await db.review.findFirstOrThrow({ where: { userId: b.userId } })).id;
    ok(await admin.patch(`/api/admin/reviews/${rejected}`, { status: "rejected" }));
    const rv2 = (await b.c.get("/account/reviews")).text; assert.ok(rv2.includes("ویرایش و ارسال مجدد")); assert.ok(rv2.includes("رد شده"));
    assert.ok((await b.c.get(`/account/orders/${b.number}`)).text.includes("ویرایش و ارسال مجدد"));
    assert.ok((await b.c.get("/account/reviews")).text.includes("رد شده"));
  });

  it("16. approval/rejection notify the customer", async () => {
    const p = await testProduct(); const b = await buyer(p); const r = ok(await post(b, {}, p.id));
    ok(await admin.patch(`/api/admin/reviews/${r.id}`, { status: "approved" }));
    assert.ok((await db.notification.findMany({ where: { userId: b.userId } })).some((n) => n.event === "review_moderated" && n.title.includes("منتشر")));
  });

  it("17. product page: average, count, 1–5 distribution and load-more pagination (approved only, newest first, no duplicates across pages)", async () => {
    const p = await testProduct(); const users = await db.user.findMany({ take: 1 });
    const ratings = [5, 5, 5, 4, 4, 3, 2, 1, 5, 4, 5, 3, 5, 5, 1, 4, 4, 2, 5, 5, 3, 4, 5, 5, 5];
    const base = Date.now() - 1000 * 60 * 60;
    await db.review.createMany({ data: ratings.map((rating, i) => ({ productId: p.id, userId: users[0]!.id, rating, body: `پیمایش-${i}`, status: "approved", createdAt: new Date(base + i * 1000) })) });
    await db.review.create({ data: { productId: p.id, userId: users[0]!.id, rating: 1, body: "در-انتظار-نباید-دیده-شود", status: "pending" } });
    const html = await page(p.slug);
    const avg = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
    assert.ok(html.includes(avg.toLocaleString("fa-IR"))); assert.ok(html.includes('data-testid="dist-5"')); assert.ok(html.includes('data-testid="reviews-more"'));
    assert.ok(!html.includes("در-انتظار-نباید-دیده-شود"));
    assert.equal((html.match(/data-testid="review-item"/g) ?? []).length, 10);
    assert.ok(html.indexOf("پیمایش-24") < html.indexOf("پیمایش-15")); // newest first
    const seen = new Set<string>();
    for (let pg = 1; pg <= 3; pg++) { const d = ok(await new Client().get(`/api/products/${p.slug}/reviews?page=${pg}`)); for (const i of d.items) { assert.ok(!seen.has(i.id)); seen.add(i.id); } assert.equal(d.hasMore, pg < 3); assert.ok(d.items.every((i: any) => i.body && !("status" in i) && !("userId" in i))); }
    assert.equal(seen.size, 25);
    assert.equal((await new Client().get(`/api/products/nope-${uid()}/reviews`)).status, 404);
    assert.match(html, /"reviewCount":25/);
  });

  it("18. admin list: filters (status / rating / product / search), stats, related order, and product-scoped view", async () => {
    const p = await testProduct(); const b1 = await buyer(p), b2 = await buyer(p);
    const t = "جستجو-" + uid();
    const r1 = ok(await post(b1, { rating: 5, body: t }, p.id)), r2 = ok(await post(b2, { rating: 2, body: "دیگر " + uid() }, p.id));
    ok(await admin.patch(`/api/admin/reviews/${r2.id}`, { status: "approved" }));
    const q = async (qs: string) => ok(await admin.get(`/api/admin/reviews?${qs}`)) as any;
    let d = await q(`status=pending&productId=${p.id}`); assert.deepEqual(d.items.map((i: any) => i.id), [r1.id]);
    assert.equal(d.items[0].order.number, b1.number); assert.equal(d.items[0].verifiedPurchase, true); assert.ok(d.items[0].user.phone);
    d = await q(`status=approved&productId=${p.id}`); assert.deepEqual(d.items.map((i: any) => i.id), [r2.id]);
    d = await q(`status=approved&rating=5&productId=${p.id}`); assert.equal(d.items.length, 0);
    d = await q(`status=pending&q=${encodeURIComponent(t)}`); assert.equal(d.items.length, 1);
    d = await q(`status=pending&q=${encodeURIComponent(b1.phone)}`); assert.ok(d.items.some((i: any) => i.id === r1.id));
    assert.ok(d.stats.pending >= 1 && d.stats.approved >= 1 && typeof d.stats.avgRating === "number");
    assert.ok((await admin.get("/admin/reviews?status=approved")).status === 200);
    assert.ok((await admin.get("/admin")).text.includes("نظرات تأییدشده"));
    ok(await admin.del(`/api/admin/reviews/${r1.id}`)); assert.equal(await db.review.count({ where: { id: r1.id } }), 0);
    assert.ok(await db.product.findUnique({ where: { id: p.id } }));
  });

  it("19. homepage: latest approved reviews (≤6) sit right before the footer; pending/rejected never appear; reviews of hidden products are excluded", async () => {
    const p = await testProduct(); const b = await buyer(p); const text = "صفحه-اصلی-" + uid();
    const r = ok(await post(b, { body: text, rating: 5 }, p.id));
    assert.ok(!(await new Client().get("/")).text.includes(text));
    ok(await admin.patch(`/api/admin/reviews/${r.id}`, { status: "approved" }));
    const html = (await new Client().get("/")).text;
    const i = html.indexOf(text), s = html.indexOf('data-testid="home-reviews"'), f = html.indexOf("<footer");
    assert.ok(i > s && s > 0 && f > i, "reviews section precedes <footer>");
    assert.ok(html.slice(s, f).includes("✓ خرید تأییدشده")); assert.ok(html.slice(s, f).includes(p.slug));
    assert.ok((html.match(/data-testid="home-review"/g) ?? []).length <= 6);
    assert.ok(!html.slice(f).includes('data-testid="home-review"'));
    ok(await admin.patch(`/api/admin/products/${p.id}`, { isActive: false }));
    assert.ok(!(await new Client().get("/")).text.includes(text));
    ok(await admin.patch(`/api/admin/products/${p.id}`, { isActive: true }));
    ok(await admin.patch(`/api/admin/reviews/${r.id}`, { status: "rejected" }));
    assert.ok(!(await new Client().get("/")).text.includes(text));
  });

  it("20. rate limit on review creation: the 11th attempt within an hour is 429", async () => {
    const cu = await customer(); let last = 0;
    for (let i = 0; i < 11; i++) last = (await cu.c.post("/api/reviews", { orderNumber: 999_999_00 + i, productId: prod.id, rating: 5, body: "تست نرخ" })).status;
    assert.equal(last, 429);
  });

  it("21. legacy media tab: product save from the form never wipes videos; create-with-images still sets exactly one primary", async () => {
    const s = "p7c-" + uid();
    const p = ok(await admin.post("/api/admin/products", { name: "ساخت با تصویر " + s, slug: s, sku: "SKU-" + s, categoryId: catId, retailPrice: 50_000, images: [{ url: "/media/images/a.png", alt: "الف" }, { url: "/media/images/b.png", alt: "ب" }], variants: [{ sku: "V-" + s, name: "پیش‌فرض", stock: 5 }] }));
    let m = await list(p); assert.equal(m.length, 2); assert.equal(m.filter((x) => x.isPrimary).length, 1);
    ok(await upload(p, MP4, "c.mp4", "video/mp4", "VIDEO"));
    ok(await admin.patch(`/api/admin/products/${p.id}`, { name: "ویرایش " + s, images: [{ url: "/media/images/c.png", alt: "ج" }] }));
    m = await list(p); assert.equal(m.filter((x) => x.type === "VIDEO").length, 1); assert.equal(m.filter((x) => x.type === "IMAGE").length, 1); assert.equal(m.filter((x) => x.isPrimary).length, 1);
    ok(await admin.patch(`/api/admin/products/${p.id}`, { name: "دوباره " + s }));
    assert.equal((await list(p)).length, 2);
  });

  it("22. DB constraints: one primary per product, ratings 1–5, valid statuses", async () => {
    const p = await testProduct(); ok(await upload(p, await png(100, 100), "a.png", "image/png")); ok(await upload(p, await png(100, 101), "b.png", "image/png"));
    const [, second] = await list(p);
    await assert.rejects(db.productImage.update({ where: { id: second!.id }, data: { isPrimary: true } }), /Unique|unique|constraint/i);
    const u = await db.user.findFirstOrThrow();
    await assert.rejects(db.review.create({ data: { productId: p.id, userId: u.id, rating: 9, body: "بد" } }), /check|constraint/i);
    await assert.rejects(db.review.create({ data: { productId: p.id, userId: u.id, rating: 3, body: "بد", status: "weird" } }), /check|constraint/i);
  });
});
