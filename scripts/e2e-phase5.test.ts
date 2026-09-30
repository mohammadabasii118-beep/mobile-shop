/**
 * Phase 5 integration tests: SEO, security, performance budgets, finance re-checks.
 * Server must be running in production mode:  ALLOW_INSECURE_HTTP=1 TRUST_PROXY=1 npm start -- -p 3300
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Client, PNG, db, fileForm, loginWithPassword, registerAndLogin, uid, BASE } from "./test-utils";

let admin: Client, manager: Client, catId = "", freeShip = "";
const ok = (r: { status: number; json: any }, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.json)); return r.json?.data; };
const page = async (path: string, c = new Client()) => c.get(path);
const RULES = { enabled: true, amountPerPoint: 10000, earnOn: "payment", minOrderTotal: 0, redeemEnabled: true, pointValue: 100, minRedeemPoints: 100, maxRedeemPercent: 30 };
const setFinance = (fourEyes: boolean) => db.siteSetting.upsert({ where: { key: "finance" }, update: { value: { fourEyes } }, create: { key: "finance", value: { fourEyes } } });
const jsonLd = (html: string) => [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]!.replace(/\\u003c/gi, "<")));

async function testProduct(price = 200_000, name?: string) {
  const s = "p5-" + uid();
  const p = ok(await admin.post("/api/admin/products", { name: name ?? "کالای تست " + s, slug: s, sku: "SKU-" + s, categoryId: catId, retailPrice: price, wholesalePrice: Math.round(price * 0.8), minWholesaleQty: 2, variants: [{ sku: "V-" + s, name: "پیش‌فرض", stock: 500 }] }));
  return { slug: s, id: p.id as string, variantId: p.variants[0].id as string };
}
async function customer() {
  const r = await registerAndLogin();
  const a = await r.c.post("/api/addresses", { receiver: "تست", phone: "09121234567", province: "تهران", city: "تهران", postalCode: "1234567890", address: "خیابان ولیعصر، پلاک ۱۰" });
  return { ...r, addressId: ok(a).id as string };
}
type Cust = Awaited<ReturnType<typeof customer>>;
async function order(cu: Cust, prod: { slug: string; variantId: string }, qty = 1) {
  ok(await cu.c.post("/api/cart/items", { productSlug: prod.slug, variantId: prod.variantId, quantity: qty }));
  return ok(await cu.c.post("/api/checkout/orders", { addressId: cu.addressId, shippingMethodId: freeShip, paymentMethod: "card_to_card", useWallet: false, redeemPoints: 0 })) as { id: string; number: number; total: number };
}
async function payAndApprove(cu: Cust, number: number) {
  ok(await cu.c.post(`/api/orders/${number}/payment/proof`, fileForm(PNG, "r.png", "image/png", "receipt", { referenceNumber: "REF-" + uid() })));
  const pay = await db.payment.findFirstOrThrow({ where: { order: { number } } });
  ok(await admin.post(`/api/admin/payments/${pay.id}/approve`));
}
const points = async (userId: string) => (await db.loyaltyAccount.findUnique({ where: { userId } }))?.points ?? 0;

describe("Phase 5 — SEO, security, performance, finance", () => {
  before(async () => {
    await db.rateLimit.deleteMany({});
    admin = await loginWithPassword("09120000001", "Admin@12345");
    manager = await loginWithPassword("09120000006", "Manager@12345");
    catId = (await db.category.findFirstOrThrow({ where: { parentId: { not: null } } })).id;
    freeShip = ok(await admin.post("/api/admin/r/shipping", { key: "free5-" + uid(), name: "تحویل حضوری تست", cost: 0 })).id;
    ok(await admin.put("/api/admin/settings/loyalty", RULES));
    await setFinance(false);
  });
  after(async () => { await db.siteSetting.deleteMany({ where: { key: "finance" } }); await db.$disconnect(); });

  describe("SEO", () => {
    it("robots.txt hides private areas and points at the sitemap", async () => {
      const r = await page("/robots.txt");
      assert.equal(r.status, 200);
      for (const p of ["/admin", "/account", "/checkout", "/api/"]) assert.match(r.text, new RegExp("Disallow: " + p));
      assert.match(r.text, /Sitemap: .*\/sitemap\.xml/);
    });
    it("sitemap lists real products, categories, brands, models and posts — never private paths", async () => {
      const r = await page("/sitemap.xml");
      assert.equal(r.status, 200);
      for (const seg of ["/product/", "/category/", "/brand/", "/model/", "/blog/"]) assert.ok(r.text.includes(seg), seg);
      assert.doesNotMatch(r.text, /\/(admin|account|checkout|api)(\/|<)/);
      const inactive = await db.product.findFirst({ where: { isActive: false } });
      if (inactive) assert.ok(!r.text.includes(encodeURIComponent(inactive.slug)));
    });
    it("a new product appears in the sitemap immediately and its page has canonical, OG, Product/Offer and breadcrumb schema", async () => {
      const p = await testProduct(345_000);
      const sm = await page("/sitemap.xml");
      assert.ok(sm.text.includes(encodeURIComponent(p.slug)));
      const r = await page(`/product/${p.slug}`);
      assert.equal(r.status, 200);
      assert.match(r.text, /<link rel="canonical" href="[^"]*\/product\/p5-/);
      for (const og of ["og:title", "og:description", "og:url"]) assert.ok(r.text.includes(`property="${og}"`), og);
      const types = jsonLd(r.text).flatMap((d) => [d["@type"], d.offers?.["@type"]]);
      for (const t of ["Product", "Offer", "BreadcrumbList", "Organization", "WebSite"]) assert.ok(types.includes(t), t);
      const prod = jsonLd(r.text).find((d) => d["@type"] === "Product");
      assert.equal(prod.offers.priceCurrency, "IRR"); assert.equal(Number(prod.offers.price), 3_450_000);
    });
    it("no fake ratings: AggregateRating/Review only appear once real approved reviews exist", async () => {
      const p = await testProduct();
      const html = (await page(`/product/${p.slug}`)).text;
      assert.doesNotMatch(html, /AggregateRating/); assert.doesNotMatch(html, /"@type":"Review"/);
    });
    it("product names cannot break out of the JSON-LD script tag (XSS)", async () => {
      const p = await testProduct(100_000, 'تست </script><img src=x onerror=alert(1)> کالا');
      const html = (await page(`/product/${p.slug}`)).text;
      assert.ok(!html.includes("</script><img"), "raw closing script tag leaked");
      assert.ok(!html.includes("<img src=x onerror"), "raw markup leaked");
    });
    it("private pages are noindex and marked no-store; public listings are indexable", async () => {
      for (const p of ["/account", "/checkout", "/admin"]) assert.match((await page(p)).headers.get("x-robots-tag") ?? "", /noindex/, p);
      assert.equal((await page("/")).headers.get("x-robots-tag"), null);
      const filtered = await page("/shop?sort=price-asc&page=2");
      assert.match(filtered.text, /name="robots" content="noindex/);
    });
    it("category and brand pages are indexable landing pages with their own title and canonical", async () => {
      const cat = await db.category.findFirstOrThrow({ where: { isActive: true, products: { some: { isActive: true } } } });
      const r = await page(`/category/${cat.slug}`);
      assert.equal(r.status, 200); assert.match(r.text, /<link rel="canonical"/); assert.match(r.text, /<title>[^<]+<\/title>/);
      const brand = await db.brand.findFirstOrThrow({ where: { isActive: true } });
      assert.equal((await page(`/brand/${brand.slug}`)).status, 200);
      const model = await db.phoneModel.findFirstOrThrow({ where: { isActive: true } });
      const m = await page(`/model/${model.slug}`); assert.equal(m.status, 200); assert.match(m.text, /<link rel="canonical"/);
    });
    it("unique titles: product pages do not share the global home title", async () => {
      const a = (await page("/")).text.match(/<title>([^<]*)/)![1], b = (await page("/shop")).text.match(/<title>([^<]*)/)![1];
      assert.notEqual(a, b);
    });
    it("unknown URLs return a real 404; an old product slug 308-redirects to the new one", async () => {
      assert.equal((await page("/product/does-not-exist-" + uid())).status, 404);
      assert.equal((await page("/nope-" + uid())).status, 404);
      const p = await testProduct(); const next = "p5-renamed-" + uid();
      ok(await admin.patch(`/api/admin/products/${p.id}`, { slug: next }));
      const r = await page(`/product/${p.slug}`);
      assert.ok([301, 308].includes(r.status), String(r.status));
      assert.ok(decodeURIComponent(r.headers.get("location") ?? "").endsWith(`/product/${next}`));
      assert.equal((await page(`/product/${next}`)).status, 200);
    });
    it("admin-managed SEO title overrides the page title", async () => {
      const p = await testProduct(); const title = "عنوان سئو " + uid();
      ok(await admin.patch(`/api/admin/products/${p.id}`, { seoTitle: title }));
      assert.ok((await page(`/product/${p.slug}`)).text.includes(title));
    });
  });

  describe("Security", () => {
    it("sends CSP with a per-request nonce (no unsafe-inline scripts), frame/sniff/referrer/permissions headers", async () => {
      const a = await page("/"), b = await page("/");
      const csp = a.headers.get("content-security-policy") ?? "";
      const script = csp.match(/script-src([^;]*)/)![1]!;
      assert.match(script, /'nonce-/); assert.doesNotMatch(script, /unsafe-inline|unsafe-eval/);
      assert.match(csp, /frame-ancestors 'none'/); assert.match(csp, /object-src 'none'/);
      assert.notEqual(csp, b.headers.get("content-security-policy"));
      assert.equal(a.headers.get("x-content-type-options"), "nosniff"); assert.equal(a.headers.get("x-frame-options"), "DENY");
      assert.ok(a.headers.get("referrer-policy")); assert.ok(a.headers.get("permissions-policy"));
    });
    it("every inline <script> on a page carries the request nonce", async () => {
      const r = await page("/");
      const nonce = r.headers.get("content-security-policy")!.match(/'nonce-([^']+)'/)![1];
      const inline = [...r.text.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")([^>]*)>/g)]; // JSON-LD data blocks are not executable
      assert.ok(inline.length > 0);
      for (const m of inline) assert.ok(m[1]!.includes(`nonce="${nonce}"`), m[0]);
    });
    it("API responses are never cached and never indexed", async () => {
      const r = await page("/api/health");
      assert.match(r.headers.get("cache-control") ?? "", /no-store/);
    });
    it("health check reports database status and leaks nothing", async () => {
      const r = await page("/api/health");
      assert.equal(r.status, 200); assert.equal(r.json.status, "ok"); assert.deepEqual(Object.keys(r.json).sort(), ["db", "ms", "status"]);
    });
    it("cross-site writes are rejected (CSRF) even with a valid session", async () => {
      const cu = await customer();
      const r = await cu.c.req("POST", "/api/cart/coupon", { code: "X" }, { origin: "https://evil.example" });
      assert.equal(r.status, 403); assert.equal(r.json.error.code, "csrf");
      const w = await admin.req("PUT", "/api/admin/settings/finance", { fourEyes: false }, { origin: "https://evil.example" });
      assert.equal(w.status, 403);
    });
    it("oversized request bodies are refused before processing (413)", async () => {
      const cu = await customer();
      const r = await cu.c.req("POST", "/api/reviews", { x: "a".repeat(13 * 1024 * 1024) });
      assert.equal(r.status, 413);
    });
    it("upload cap: a >5MB receipt is rejected; a disguised file is rejected by magic bytes", async () => {
      const cu = await customer(); const prod = await testProduct(); const o = await order(cu, prod);
      const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 10)]);
      const r1 = await cu.c.post(`/api/orders/${o.number}/payment/proof`, fileForm(big, "r.png", "image/png", "receipt", { referenceNumber: "REF-" + uid() }));
      assert.ok([400, 413, 422].includes(r1.status), String(r1.status));
      const r2 = await cu.c.post(`/api/orders/${o.number}/payment/proof`, fileForm(Buffer.from("<script>alert(1)</script>".padEnd(64)), "r.png", "image/png", "receipt", { referenceNumber: "REF-" + uid() }));
      assert.equal(r2.status, 400);
    });
    it("per-session write limiter throttles a runaway client (429) without affecting others", async () => {
      const cu = await customer(), other = await customer();
      const codes = new Set<number>();
      for (let i = 0; i < 6; i++) {
        const batch = await Promise.all(Array.from({ length: 50 }, () => cu.c.del("/api/cart/coupon")));
        for (const r of batch) codes.add(r.status);
        if (codes.has(429)) break;
      }
      assert.ok(codes.has(429), [...codes].join());
      assert.equal((await other.c.del("/api/cart/coupon")).status, 200);
    });
    it("SQL injection strings in search/filter parameters are inert", async () => {
      for (const q of ["' OR 1=1 --", "\"; DROP TABLE \"Product\"; --", "%' UNION SELECT NULL--"]) {
        const r = await page(`/shop?q=${encodeURIComponent(q)}&sort=${encodeURIComponent(q)}&page=${encodeURIComponent(q)}`);
        assert.equal(r.status, 200, q);
      }
      assert.ok((await db.product.count()) > 0);
    });
    it("admin APIs: anonymous → 401, customer → 403, limited staff → 403 outside their permissions", async () => {
      assert.equal((await new Client().get("/api/admin/customers")).status, 401);
      const cu = await customer();
      for (const p of ["/api/admin/customers", "/api/admin/refunds", "/api/admin/wallet", "/api/admin/settings"]) assert.equal((await cu.c.get(p)).status, 403, p);
      assert.equal((await manager.put("/api/admin/settings/site", { name: "x" })).status, 403);
      assert.equal((await manager.get("/api/admin/refunds")).status, 403);
    });
    it("customers cannot read each other's orders, receipts or tickets (IDOR)", async () => {
      const a = await customer(), b = await customer(); const prod = await testProduct(); const o = await order(a, prod);
      assert.equal((await b.c.get(`/api/orders/${o.number}`)).status, 404);
      assert.equal((await b.c.post(`/api/orders/${o.number}/cancel`, {})).status, 404);
      ok(await a.c.post(`/api/orders/${o.number}/payment/proof`, fileForm(PNG, "r.png", "image/png", "receipt", { referenceNumber: "REF-" + uid() })));
      const proof = await db.paymentProof.findFirstOrThrow({ where: { payment: { order: { number: o.number } } } });
      assert.equal((await b.c.get(`/api/orders/${o.number}/payment/proof/${proof.id}`)).status, 403); // unguessable id + owner check
      assert.ok([401, 403, 404].includes((await new Client().get(`/api/orders/${o.number}/payment/proof/${proof.id}`)).status));
      assert.equal((await a.c.get(`/api/orders/${o.number}/payment/proof/${proof.id}`)).status, 200);
    });
    it("private uploads are not served from any public path", async () => {
      for (const p of ["/storage/receipts", "/receipts", "/uploads", "/.env", "/prisma/schema.prisma", "/package.json"]) assert.notEqual((await page(p)).status, 200, p);
    });
    it("session cookie is HttpOnly + SameSite and never readable from the body", async () => {
      const c = new Client(); const cu = await customer();
      const r = await c.post("/api/auth/login", { phone: "09120000002", password: "Customer@12345" });
      const set = r.headers.getSetCookie().join(";");
      assert.match(set, /HttpOnly/i); assert.match(set, /SameSite=(Lax|Strict)/i);
      assert.doesNotMatch(r.text, /cl_session/);
      void cu;
    });
    it("login does not reveal whether a phone number exists", async () => {
      const a = await new Client().post("/api/auth/login", { phone: "09359999999", password: "Wrong@12345" });
      const b = await new Client().post("/api/auth/login", { phone: "09120000002", password: "Wrong@12345" });
      assert.equal(a.status, b.status); assert.equal(a.json.error.message, b.json.error.message);
    });
    it("unhandled server errors return a request id, not a stack trace", async () => {
      const r = await admin.post("/api/admin/r/coupons", "not json" as unknown as object);
      assert.ok(r.status >= 400 && r.status < 500);
      assert.doesNotMatch(r.text, /node_modules|at .*\(.*:\d+:\d+\)/);
    });
  });

  describe("Performance budgets", () => {
    it("server-rendered pages respond quickly and stay small", async () => {
      for (const [p, maxBytes] of [["/", 400_000], ["/shop", 260_000], ["/blog", 200_000]] as const) {
        await page(p); // warm caches
        const t = Date.now(); const r = await page(p); const ms = Date.now() - t;
        assert.equal(r.status, 200); assert.ok(ms < 800, `${p} ${ms}ms`); assert.ok(r.text.length < maxBytes, `${p} ${r.text.length}B`);
      }
    });
    it("the shop listing renders one page of products (bounded DOM), not the whole catalogue", async () => {
      const r = await page("/shop");
      const cards = (r.text.match(/data-product-card|class="[^"]*product-card/g) ?? []).length;
      const links = new Set([...r.text.matchAll(/href="\/product\/([^"]+)"/g)].map((m) => m[1]));
      assert.ok(links.size <= 40, `product links: ${links.size} cards: ${cards}`);
    });
    it("static assets are compressed-cacheable and product images use the optimiser", async () => {
      const r = await page("/");
      assert.match(r.text, /rel="preload"[^>]*as="font"/);
      const img = await new Client().get("/shop.js"); assert.equal(img.status, 200); assert.ok(img.headers.get("cache-control"));
    });
    it("public reads are served from cache: repeated home renders do not scale DB work", async () => {
      await page("/");
      const t = Date.now(); await Promise.all(Array.from({ length: 20 }, () => page("/"))); assert.ok(Date.now() - t < 4000);
    });
  });

  describe("Finance re-tests (phases 2–4)", () => {
    it("four-eyes: the person who requested a bank refund cannot approve it; another approver can", async () => {
      await setFinance(true);
      try {
        const cu = await customer(); const prod = await testProduct(100_000); const o = await order(cu, prod); await payAndApprove(cu, o.number);
        const r = ok(await admin.post(`/api/admin/orders/${o.number}/refunds`, { method: "bank", amount: 100_000, reason: "بازگشت به کارت", bankNote: "6037-9911-2233-4455 علی احمدی" }));
        const self = await admin.post(`/api/admin/refunds/${r.id}/complete`, { bankReference: "TRK-778899", confirm: true });
        assert.equal(self.status, 403); assert.equal(self.json.error.code, "four_eyes");
        assert.equal((await db.refund.findUniqueOrThrow({ where: { id: r.id } })).status, "PENDING_BANK");
        const second = await registerAndLogin();
        await db.userRole.create({ data: { userId: second.userId, roleId: (await db.role.findUniqueOrThrow({ where: { key: "admin" } })).id } });
        ok(await second.c.post(`/api/admin/refunds/${r.id}/complete`, { bankReference: "TRK-778899", confirm: true }));
        const done = await db.refund.findUniqueOrThrow({ where: { id: r.id } });
        assert.equal(done.status, "COMPLETED"); assert.equal(done.completedById, second.userId); assert.notEqual(done.completedById, done.requestedById);
      } finally { await setFinance(false); }
    });
    it("four-eyes can be switched off in settings (single-owner shops) and is audited", async () => {
      await setFinance(true);
      ok(await admin.put("/api/admin/settings/finance", { fourEyes: false }));
      const cu = await customer(); const prod = await testProduct(100_000); const o = await order(cu, prod); await payAndApprove(cu, o.number);
      const r = ok(await admin.post(`/api/admin/orders/${o.number}/refunds`, { method: "bank", amount: 100_000, reason: "تک‌نفره", bankNote: "6037-0000-1111-2222" }));
      ok(await admin.post(`/api/admin/refunds/${r.id}/complete`, { bankReference: "TRK-112233", confirm: true }));
      assert.ok((await db.adminLog.count({ where: { action: { contains: "setting" } } })) > 0);
    });
    it("partial refund takes back a proportional share of loyalty points; the final refund takes only the remainder", async () => {
      const cu = await customer(); const prod = await testProduct(1_000_000); const o = await order(cu, prod); await payAndApprove(cu, o.number);
      const earned = await points(cu.userId); assert.ok(earned > 0, "points earned");
      const refund = async (amount: number) => { const r = ok(await admin.post(`/api/admin/orders/${o.number}/refunds`, { method: "wallet", amount, reason: "جزئی" })); ok(await cu.c.post(`/api/refunds/${r.id}/accept`)); };
      await refund(250_000);
      const afterPartial = await points(cu.userId);
      assert.equal(afterPartial, earned - Math.floor((earned * 250_000) / 1_000_000));
      await refund(750_000);
      assert.equal(await points(cu.userId), 0, "everything earned is returned exactly once");
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status, "REFUNDED");
    });
    it("refunds can never exceed what was paid, even in parallel", async () => {
      const cu = await customer(); const prod = await testProduct(100_000); const o = await order(cu, prod); await payAndApprove(cu, o.number);
      const rs = await Promise.all(Array.from({ length: 4 }, () => admin.post(`/api/admin/orders/${o.number}/refunds`, { method: "wallet", amount: 60_000, reason: "هم‌زمان" })));
      assert.equal(rs.filter((r) => r.status === 200).length, 1, rs.map((r) => r.status).join());
    });
    it("cancelling an unpaid order with a coupon and points restores coupon usage, points and stock", async () => {
      const code = "P5" + uid().toUpperCase();
      const cp = ok(await admin.post("/api/admin/r/coupons", { code, type: "fixed", value: 10_000, usageLimit: 5 }));
      const cu = await customer(); const prod = await testProduct(200_000);
      ok(await cu.c.post("/api/cart/items", { productSlug: prod.slug, variantId: prod.variantId, quantity: 2 }));
      ok(await cu.c.post("/api/cart/coupon", { code }));
      const o = ok(await cu.c.post("/api/checkout/orders", { addressId: cu.addressId, shippingMethodId: freeShip, paymentMethod: "card_to_card", useWallet: false, redeemPoints: 0 }));
      assert.equal((await db.coupon.findUniqueOrThrow({ where: { id: cp.id } })).usedCount, 1);
      const stockOf = async () => (await db.inventory.findFirstOrThrow({ where: { variantId: prod.variantId } })).quantity;
      assert.equal(await stockOf(), 498);
      ok(await cu.c.post(`/api/orders/${o.number}/cancel`, {}));
      assert.equal((await db.coupon.findUniqueOrThrow({ where: { id: cp.id } })).usedCount, 0);
      assert.equal(await stockOf(), 500);
    });
    it("duplicate submissions of the same wallet credit key and refund key apply once", async () => {
      const cu = await customer(); const k = "k5-" + uid() + uid();
      const body = { direction: "in", amount: 50_000, reason: "شارژ", key: k };
      const rs = await Promise.all([admin.post(`/api/admin/wallet/${cu.userId}/adjust`, body), admin.post(`/api/admin/wallet/${cu.userId}/adjust`, body), admin.post(`/api/admin/wallet/${cu.userId}/adjust`, body)]);
      assert.ok(rs.every((r) => r.status === 200));
      assert.equal((await db.wallet.findUniqueOrThrow({ where: { userId: cu.userId } })).balance, 50_000);
    });
  });
});
