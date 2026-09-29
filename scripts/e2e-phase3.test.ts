/**
 * Phase 3 (admin panel) integration tests. Run against a running server:
 *   TRUST_PROXY=1 npm run start -- -p 3300      then      BASE_URL=http://localhost:3300 npm run test:e2e
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Client, PNG, db, fileForm, loginWithPassword, newPhone, placeOrder, registerAndLogin, uid, BASE } from "./test-utils";

let admin: Client, manager: Client, customer: Client;
const ok = (r: { status: number; json: any }, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.json)); return r.json?.data; };
const logCount = (action: string, entityId?: string) => db.adminLog.count({ where: { action, ...(entityId ? { entityId } : {}) } });

describe("Phase 3 — admin panel", () => {
  before(async () => {
    await db.rateLimit.deleteMany({});
    admin = await loginWithPassword("09120000001", "Admin@12345");
    manager = await loginWithPassword("09120000006", "Manager@12345");
    customer = await loginWithPassword("09120000002", "Customer@12345");
  });
  after(async () => { await db.$disconnect(); });

  describe("Authorization", () => {
    it("anonymous users cannot call any admin API (401)", async () => {
      const anon = new Client();
      for (const p of ["/api/admin/products", "/api/admin/orders", "/api/admin/payments", "/api/admin/customers", "/api/admin/settings", "/api/admin/audit", "/api/admin/dashboard", "/api/admin/r/categories"])
        assert.equal((await anon.get(p)).status, 401, p);
      assert.equal((await anon.post("/api/admin/upload", {})).status, 401);
      assert.equal((await anon.post("/api/admin/payments/x/approve")).status, 401);
    });
    it("a customer (no staff role) gets 403 everywhere, even with a valid session", async () => {
      for (const p of ["/api/admin/products", "/api/admin/orders", "/api/admin/dashboard", "/api/admin/r/coupons", "/api/admin/audit"]) assert.equal((await customer.get(p)).status, 403, p);
      assert.equal((await customer.post("/api/admin/r/coupons", { code: "HACK", type: "percent", value: 90 })).status, 403);
    });
    it("a limited staff role only reaches what its permissions allow", async () => {
      assert.equal((await manager.get("/api/admin/products")).status, 200);
      assert.equal((await manager.get("/api/admin/dashboard")).status, 200);
      for (const p of ["/api/admin/orders", "/api/admin/payments", "/api/admin/settings", "/api/admin/audit", "/api/admin/customers", "/api/admin/wholesale", "/api/admin/r/coupons", "/api/admin/r/banners"])
        assert.equal((await manager.get(p)).status, 403, p);
      assert.equal((await manager.post("/api/admin/payments/x/approve")).status, 403);
      assert.equal((await manager.put("/api/admin/settings/payment", { cardNumber: "1111111111111111" })).status, 403);
      assert.equal((await manager.post(`/api/admin/customers/${(await db.user.findFirstOrThrow({ where: { phone: "09120000002" } })).id}/roles`, { roleKeys: ["super_admin"] })).status, 403);
    });
    it("admin pages redirect anonymous users to login and refuse non-staff", async () => {
      const anon = await new Client().get("/admin");
      assert.ok([302, 303, 307, 308].includes(anon.status));
      assert.match(anon.headers.get("location") ?? "", /\/account\?next=\/admin/);
      const cust = await customer.get("/admin/products");
      assert.match(cust.text, /دسترسی ندارید/);
      const noPerm = await manager.get("/admin/settings");
      assert.ok([302, 303, 307, 308].includes(noPerm.status));
      assert.equal((await admin.get("/admin")).status, 200);
      assert.equal((await admin.get("/admin/products")).status, 200);
    });
    it("admin CSRF: cross-origin writes are refused", async () => {
      assert.equal((await admin.req("POST", "/api/admin/r/brands", { name: "x", slug: "x" }, { origin: "https://evil.example" })).status, 403);
    });
    it("deactivating a user revokes their sessions immediately", async () => {
      const { c, userId } = await registerAndLogin();
      assert.equal((await c.get("/api/me")).status, 200);
      ok(await admin.patch(`/api/admin/customers/${userId}`, { isActive: false }));
      assert.equal((await c.get("/api/me")).status, 401);
      ok(await admin.patch(`/api/admin/customers/${userId}`, { isActive: true }));
    });
  });

  describe("Dashboard", () => {
    it("returns real aggregates", async () => {
      const d = ok(await admin.get("/api/admin/dashboard"));
      for (const k of ["totalOrders", "pendingOrders", "reviewOrders", "paidOrders", "revenue", "revenueToday", "revenueMonth", "lowStock", "pendingWholesale", "pendingReviews", "newCustomers"]) assert.equal(typeof d[k], "number", k);
      assert.equal(d.totalOrders, await db.order.count());
      assert.equal(d.chart.length, 14);
      assert.equal(d.pendingWholesale, await db.wholesaleApplication.count({ where: { status: "PENDING" } }));
    });
  });

  describe("Categories, brands, phone models", () => {
    it("category CRUD is validated, audited and visible on the storefront", async () => {
      const slug = "cat-" + uid();
      const bad = await admin.post("/api/admin/r/categories", { name: "x", slug: "Bad Slug!" });
      assert.equal(bad.status, 422);
      const c = ok(await admin.post("/api/admin/r/categories", { name: "دسته آزمایشی " + slug, slug, seoTitle: "عنوان سئو" }));
      assert.equal(await logCount("category.create", c.id), 1);
      assert.match((await new Client().get("/shop")).text, new RegExp("دسته آزمایشی " + slug));
      assert.equal((await admin.post("/api/admin/r/categories", { name: "dup", slug })).status, 409);
      ok(await admin.patch(`/api/admin/r/categories/${c.id}`, { name: "نام جدید " + slug, isActive: false }));
      const html = (await new Client().get("/shop")).text;
      assert.ok(!html.includes("نام جدید " + slug), "disabled category must disappear from the storefront");
      const log = await db.adminLog.findFirstOrThrow({ where: { action: "category.update", entityId: c.id } });
      assert.equal((log.newValue as any).isActive, false); assert.equal((log.oldValue as any).isActive, true);
      // parent/child + cycle guard
      const child = ok(await admin.post("/api/admin/r/categories", { name: "زیر " + slug, slug: "sub-" + slug, parentId: c.id }));
      assert.equal((await admin.patch(`/api/admin/r/categories/${c.id}`, { parentId: child.id })).status, 409);
      assert.equal((await admin.del(`/api/admin/r/categories/${c.id}`)).status, 409); // has a child
      ok(await admin.del(`/api/admin/r/categories/${child.id}`)); ok(await admin.del(`/api/admin/r/categories/${c.id}`));
    });
    it("refuses to delete a category that still has products", async () => {
      const p = await db.product.findFirstOrThrow();
      assert.equal((await admin.del(`/api/admin/r/categories/${p.categoryId}`)).status, 409);
    });
    it("brand CRUD drives the public brand page", async () => {
      const slug = "brand-" + uid();
      const b = ok(await admin.post("/api/admin/r/brands", { name: "برند " + slug, slug, description: "توضیح برند" }));
      const page = await new Client().get(`/brand/${slug}`);
      assert.equal(page.status, 200); assert.match(page.text, /توضیح برند/);
      ok(await admin.patch(`/api/admin/r/brands/${b.id}`, { isActive: false }));
      assert.equal((await new Client().get(`/brand/${slug}`)).status, 404);
      ok(await admin.del(`/api/admin/r/brands/${b.id}`));
    });
    it("phone model CRUD drives the model page; brand with models cannot be deleted", async () => {
      const brand = ok(await admin.post("/api/admin/r/brands", { name: "B" + uid(), slug: "b-" + uid() }));
      const slug = "model-" + uid();
      const m = ok(await admin.post("/api/admin/r/phone-models", { name: "مدل " + slug, slug, brandId: brand.id, description: "توضیح مدل " + slug, image: "/media/images/x.png", seoTitle: "سئو مدل" }));
      const mp = await new Client().get(`/model/${slug}`);
      assert.equal(mp.status, 200); assert.match(mp.text, new RegExp("توضیح مدل " + slug));
      assert.equal((await admin.del(`/api/admin/r/brands/${brand.id}`)).status, 409);
      assert.equal((await admin.post("/api/admin/r/phone-models", { name: "x", slug: "y-" + uid(), brandId: "nope" })).status, 409);
      ok(await admin.patch(`/api/admin/r/phone-models/${m.id}`, { isActive: false }));
      assert.equal((await new Client().get(`/model/${slug}`)).status, 404);
      ok(await admin.del(`/api/admin/r/phone-models/${m.id}`)); ok(await admin.del(`/api/admin/r/brands/${brand.id}`));
    });
  });

  describe("Products, prices, images", () => {
    let pid = "";
    const cat = () => db.category.findFirstOrThrow({ where: { parentId: { not: null } } });
    it("creates a product with separate retail/wholesale prices, variants, stock and price history", async () => {
      const c = await cat(); const s = "prod-" + uid();
      const bad = await admin.post("/api/admin/products", { name: "محصول", slug: s, sku: "SKU-" + s, categoryId: c.id, retailPrice: 100000, wholesalePrice: 150000, variants: [{ sku: "V-" + s, name: "پیش‌فرض", stock: 5 }] });
      assert.equal(bad.status, 400); // wholesale above retail
      assert.equal((await admin.post("/api/admin/products", { name: "محصول", slug: s, sku: "SKU-" + s, categoryId: c.id, retailPrice: 100000, variants: [] })).status, 422);
      const p = ok(await admin.post("/api/admin/products", { name: "محصول آزمایشی " + s, slug: s, sku: "SKU-" + s, categoryId: c.id, retailPrice: 200000, wholesalePrice: 150000, minWholesaleQty: 4, variants: [{ sku: "V-" + s, name: "مشکی", color: "مشکی", colorHex: "#000000", stock: 12 }, { sku: "W-" + s, name: "سفید", stock: 3 }] }));
      pid = p.id;
      assert.equal(p.retailPrice, 200000); assert.equal(p.wholesalePrice, 150000); assert.equal(p.minWholesaleQty, 4);
      assert.equal(p.variants.length, 2);
      assert.equal(p.variants[0].inventory.quantity, 12);
      const hist = await db.priceHistory.findMany({ where: { productId: pid } });
      assert.deepEqual(hist.map((h) => h.type).sort(), ["retail", "wholesale"]);
      assert.equal(await db.inventoryMovement.count({ where: { inventory: { variant: { productId: pid } }, reason: "restock" } }), 2);
      assert.equal(await logCount("product.create", pid), 1);
      assert.equal((await new Client().get(`/product/${s}`)).status, 200);
    });
    it("changing prices writes PriceHistory (admin, type, old/new) and takes effect on the storefront", async () => {
      const before = await db.product.findUniqueOrThrow({ where: { id: pid } });
      ok(await admin.patch(`/api/admin/products/${pid}`, { retailPrice: 250000, wholesalePrice: 180000 }));
      const rows = await db.priceHistory.findMany({ where: { productId: pid }, orderBy: { createdAt: "desc" }, take: 2 });
      const retail = rows.find((r) => r.type === "retail")!, wholesale = rows.find((r) => r.type === "wholesale")!;
      assert.equal(retail.oldPrice, before.retailPrice); assert.equal(retail.newPrice, 250000);
      assert.equal(wholesale.oldPrice, 150000); assert.equal(wholesale.newPrice, 180000);
      const admId = (await db.user.findUniqueOrThrow({ where: { phone: "09120000001" } })).id;
      assert.equal(retail.adminId, admId);
      const html = (await new Client().get(`/product/${before.slug}`)).text;
      assert.match(html, /۲۵۰٬۰۰۰/);
      // unchanged price → no new history
      const n = await db.priceHistory.count({ where: { productId: pid } });
      ok(await admin.patch(`/api/admin/products/${pid}`, { retailPrice: 250000, name: "محصول آزمایشی (ویرایش‌شده)" }));
      assert.equal(await db.priceHistory.count({ where: { productId: pid } }), n);
    });
    it("validates price relationships and duplicate slugs/SKUs", async () => {
      assert.equal((await admin.patch(`/api/admin/products/${pid}`, { wholesalePrice: 999999 })).status, 400);
      assert.equal((await admin.patch(`/api/admin/products/${pid}`, { retailDiscount: 9999999 })).status, 400);
      assert.equal((await admin.patch(`/api/admin/products/${pid}`, { retailPrice: -5 })).status, 422);
      const other = await db.product.findFirstOrThrow({ where: { id: { not: pid } } });
      assert.equal((await admin.patch(`/api/admin/products/${pid}`, { slug: other.slug })).status, 409);
    });
    it("uploads validate real image content; images can be attached, reordered and removed", async () => {
      const svg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>");
      assert.equal((await admin.post("/api/admin/upload", fileForm(svg, "x.svg", "image/svg+xml"))).status, 400);
      assert.equal((await admin.post("/api/admin/upload", fileForm(Buffer.from("%PDF-1.4 hello world"), "x.pdf", "application/pdf"))).status, 400);
      assert.equal((await admin.post("/api/admin/upload", fileForm(Buffer.from("GIF89a-fake-content!!"), "x.png", "image/png"))).status, 400);
      assert.equal((await admin.post("/api/admin/upload", fileForm(Buffer.alloc(5 * 1024 * 1024, 1), "big.png", "image/png"))).status, 400);
      assert.equal((await manager.post("/api/admin/upload", fileForm(PNG, "a.png", "image/png"))).status, 200); // product manager may upload
      assert.equal((await customer.post("/api/admin/upload", fileForm(PNG, "a.png", "image/png"))).status, 403);
      const a = ok(await admin.post("/api/admin/upload", fileForm(PNG, "a.png", "image/png"))), b = ok(await admin.post("/api/admin/upload", fileForm(PNG, "b.png", "image/png")));
      assert.match(a.url, /^\/media\/images\/[0-9a-f-]+\.png$/);
      const served = await new Client().get(a.url);
      assert.equal(served.status, 200); assert.equal(served.headers.get("content-type"), "image/png"); assert.equal(served.headers.get("x-content-type-options"), "nosniff");
      assert.equal((await new Client().get("/media/images/../../.env")).status, 404);
      assert.equal((await new Client().get("/media/receipts/x.png")).status, 404);
      ok(await admin.patch(`/api/admin/products/${pid}`, { images: [{ url: a.url }, { url: b.url }] }));
      let imgs = await db.productImage.findMany({ where: { productId: pid }, orderBy: { sortOrder: "asc" } });
      assert.deepEqual(imgs.map((i) => i.url), [a.url, b.url]); assert.equal(imgs[0].isPrimary, true);
      ok(await admin.patch(`/api/admin/products/${pid}`, { images: [{ url: b.url }, { url: a.url }] }));
      imgs = await db.productImage.findMany({ where: { productId: pid }, orderBy: { sortOrder: "asc" } });
      assert.equal(imgs[0].url, b.url); assert.equal(imgs[0].isPrimary, true);
      assert.equal((await admin.patch(`/api/admin/products/${pid}`, { images: [{ url: "javascript:alert(1)" }] })).status, 422);
      ok(await admin.patch(`/api/admin/products/${pid}`, { images: [] }));
      assert.equal(await db.productImage.count({ where: { productId: pid } }), 0);
    });
    it("assigns phone models, edits variants, and disables the product", async () => {
      const models = await db.phoneModel.findMany({ take: 2 });
      const p = ok(await admin.patch(`/api/admin/products/${pid}`, { phoneModelIds: models.map((m) => m.id) }));
      assert.equal(p.phoneModelIds.length, 2);
      const cur = ok(await admin.get(`/api/admin/products/${pid}`));
      const variants = [{ id: cur.variants[0].id, sku: cur.variants[0].sku, name: "مشکی مات", isActive: true }, { sku: "N-" + uid(), name: "آبی", stock: 7 }];
      const upd = ok(await admin.patch(`/api/admin/products/${pid}`, { variants }));
      assert.equal(upd.variants.length, 2); assert.equal(upd.variants[0].name, "مشکی مات"); assert.equal(upd.variants[1].inventory.quantity, 7);
      const s = cur.slug;
      ok(await admin.patch(`/api/admin/products/${pid}`, { isActive: false }));
      assert.equal((await new Client().get(`/product/${s}`)).status, 404);
      ok(await admin.patch(`/api/admin/products/${pid}`, { isActive: true }));
    });
    it("cannot delete a product that appears in orders; can delete an unused one", async () => {
      const used = await db.orderItem.findFirst({ where: { productId: { not: null } } });
      if (used) assert.equal((await admin.del(`/api/admin/products/${used.productId}`)).status, 409);
      assert.equal((await manager.del(`/api/admin/products/${pid}`)).status, 200); // product manager holds product.delete
      assert.equal((await admin.get(`/api/admin/products/${pid}`)).status, 404);
      assert.equal(await logCount("product.delete", pid), 1);
    });
    it("product list supports search and filters", async () => {
      const r = ok(await admin.get("/api/admin/products?q=" + encodeURIComponent((await db.product.findFirstOrThrow()).sku) + "&isActive=true"));
      assert.ok(r.items.length >= 1); assert.equal(typeof r.items[0].stock, "number");
    });
  });

  describe("Inventory", () => {
    let variantId = "";
    before(async () => {
      const v = await db.productVariant.findFirstOrThrow({ where: { inventory: { is: { quantity: { gte: 0 } } } }, include: { inventory: true } });
      variantId = v.id; await db.inventory.update({ where: { variantId }, data: { quantity: 20 } });
    });
    it("add / remove / set produce movements with balanceAfter and audit rows", async () => {
      const a = ok(await admin.post(`/api/admin/inventory/${variantId}/adjust`, { mode: "add", quantity: 5, reason: "restock" }));
      assert.equal(a.quantity, 25);
      const r = ok(await admin.post(`/api/admin/inventory/${variantId}/adjust`, { mode: "remove", quantity: 3, reason: "manual", note: "شمارش" }));
      assert.equal(r.quantity, 22);
      const s = ok(await admin.post(`/api/admin/inventory/${variantId}/adjust`, { mode: "set", quantity: 40, reason: "correction", note: "انبارگردانی" }));
      assert.equal(s.quantity, 40); assert.equal(s.delta, 18);
      const inv = await db.inventory.findUniqueOrThrow({ where: { variantId }, include: { movements: { orderBy: { createdAt: "desc" }, take: 3 } } });
      assert.deepEqual(inv.movements.map((m) => [m.delta, m.balanceAfter]), [[18, 40], [-3, 22], [5, 25]]);
      assert.ok(inv.movements.every((m) => m.createdById));
      assert.ok((await logCount("inventory.adjust", variantId)) >= 3);
      const hist = ok(await admin.get(`/api/admin/inventory/${variantId}`));
      assert.equal(hist[0].balanceAfter, 40);
    });
    it("cannot go negative, requires a note for removal, validates input", async () => {
      assert.equal((await admin.post(`/api/admin/inventory/${variantId}/adjust`, { mode: "remove", quantity: 9999, reason: "damage" })).status, 409);
      assert.equal((await admin.post(`/api/admin/inventory/${variantId}/adjust`, { mode: "remove", quantity: 1, reason: "manual" })).status, 409);
      assert.equal((await admin.post(`/api/admin/inventory/${variantId}/adjust`, { mode: "add", quantity: -4 })).status, 422);
      assert.equal((await admin.post(`/api/admin/inventory/${variantId}/adjust`, { mode: "add", quantity: 1.5 })).status, 422);
      assert.equal((await admin.post(`/api/admin/inventory/nope/adjust`, { mode: "add", quantity: 1 })).status, 404);
      assert.equal((await new Client().post(`/api/admin/inventory/${variantId}/adjust`, { mode: "add", quantity: 1 })).status, 401);
    });
    it("concurrent removals never oversell (atomic conditional update)", async () => {
      await db.inventory.update({ where: { variantId }, data: { quantity: 10 } });
      const rs = await Promise.all(Array.from({ length: 4 }, () => admin.post(`/api/admin/inventory/${variantId}/adjust`, { mode: "remove", quantity: 6, reason: "damage" })));
      assert.equal(rs.filter((r) => r.status === 200).length, 1);
      assert.equal((await db.inventory.findUniqueOrThrow({ where: { variantId } })).quantity, 4);
    });
    it("low-stock threshold is editable and drives the low filter", async () => {
      ok(await admin.post(`/api/admin/inventory/${variantId}/threshold`, { lowStockThreshold: 50 }));
      const low = ok(await admin.get("/api/admin/inventory?low=1&per=200"));
      assert.ok(low.items.some((i: any) => i.variantId === variantId && i.low));
      ok(await admin.post(`/api/admin/inventory/${variantId}/threshold`, { lowStockThreshold: 5 }));
    });
  });

  describe("Orders and payment review", () => {
    it("lists and filters orders and shows full detail", async () => {
      const { number } = await placeOrder(true);
      const list = ok(await admin.get(`/api/admin/orders?q=${number}`));
      assert.equal(list.items.length, 1); assert.equal(list.items[0].number, number);
      assert.ok(ok(await admin.get("/api/admin/orders?status=PAYMENT_REVIEW")).items.every((o: any) => o.status === "PAYMENT_REVIEW"));
      assert.ok(ok(await admin.get("/api/admin/orders?type=WHOLESALE")).items.every((o: any) => o.type === "WHOLESALE"));
      const d = ok(await admin.get(`/api/admin/orders/${number}`));
      assert.ok(d.items.length && d.history.length && d.payments[0].proofs.length === 1 && d.shippingAddress.receiver);
      assert.equal((await admin.get("/api/admin/orders/abc")).status, 400);
      assert.equal((await admin.get("/api/admin/orders/99999999")).status, 404);
    });
    it("payment review queue shows REVIEW payments with reference and receipt; only payment.review can open the receipt", async () => {
      const { number } = await placeOrder(true);
      const q = ok(await admin.get(`/api/admin/payments?status=REVIEW&q=${number}`));
      assert.equal(q.items.length, 1);
      const p = q.items[0];
      assert.match(p.referenceNumber, /^REF-/); assert.equal(p.proofs.length, 1); assert.ok(p.order.customerPhone);
      const file = await admin.get(`/api/orders/${number}/payment/proof/${p.proofs[0].id}`);
      assert.equal(file.status, 200);
      const other = await registerAndLogin();
      assert.equal((await other.c.get(`/api/orders/${number}/payment/proof/${p.proofs[0].id}`)).status, 403); // another customer
      assert.equal((await manager.get(`/api/orders/${number}/payment/proof/${p.proofs[0].id}`)).status, 403);
    });
    it("APPROVE → payment PAID, order PROCESSING, timeline + audit + customer notification", async () => {
      const { number, userId } = await placeOrder(true);
      const pay = await db.payment.findFirstOrThrow({ where: { order: { number } } });
      ok(await admin.post(`/api/admin/payments/${pay.id}/approve`));
      const o = await db.order.findUniqueOrThrow({ where: { number }, include: { payments: true, history: true } });
      assert.equal(o.status, "PROCESSING"); assert.equal(o.paymentStatus, "PAID"); assert.equal(o.payments[0].status, "PAID"); assert.ok(o.payments[0].paidAt);
      assert.ok(o.history.some((h) => h.status === "PROCESSING"));
      assert.equal(await logCount("payment.approve", pay.id), 1);
      assert.equal(await db.notification.count({ where: { userId, type: "payment_approved" } }), 1);
      assert.equal((await admin.post(`/api/admin/payments/${pay.id}/approve`)).status, 409); // not approvable twice
    });
    it("REJECT requires a reason, stores it, reopens the order for a new receipt", async () => {
      const { c, number } = await placeOrder(true);
      const pay = await db.payment.findFirstOrThrow({ where: { order: { number } } });
      assert.equal((await admin.post(`/api/admin/payments/${pay.id}/reject`, {})).status, 422);
      assert.equal((await admin.post(`/api/admin/payments/${pay.id}/reject`, { reason: " " })).status, 422);
      ok(await admin.post(`/api/admin/payments/${pay.id}/reject`, { reason: "مبلغ رسید مطابقت ندارد" }));
      const o = await db.order.findUniqueOrThrow({ where: { number }, include: { payments: true } });
      assert.equal(o.payments[0].status, "REJECTED"); assert.equal(o.payments[0].rejectReason, "مبلغ رسید مطابقت ندارد"); assert.equal(o.status, "PENDING_PAYMENT");
      assert.equal(await logCount("payment.reject", pay.id), 1);
      const again = await c.post(`/api/orders/${number}/payment/proof`, fileForm(PNG, "r2.png", "image/png", "receipt", { referenceNumber: "REF-NEW-1" }));
      assert.equal(again.status, 200);
      assert.equal((await db.payment.findUniqueOrThrow({ where: { id: pay.id } })).status, "REVIEW");
    });
    it("status changes follow the transition map, are recorded in OrderStatusHistory, and notify the customer", async () => {
      const { number, userId } = await placeOrder(true);
      const pay = await db.payment.findFirstOrThrow({ where: { order: { number } } });
      assert.equal((await admin.post(`/api/admin/orders/${number}/status`, { status: "PROCESSING" })).status, 409); // unpaid
      ok(await admin.post(`/api/admin/payments/${pay.id}/approve`));
      assert.equal((await admin.post(`/api/admin/orders/${number}/status`, { status: "DELIVERED" })).status, 409); // skips steps
      assert.equal((await admin.post(`/api/admin/orders/${number}/status`, { status: "CANCELLED" })).status, 409); // must use cancel
      assert.equal((await admin.post(`/api/admin/orders/${number}/status`, { status: "BOGUS" })).status, 422);
      ok(await admin.post(`/api/admin/orders/${number}/status`, { status: "PREPARING", note: "در حال بسته‌بندی" }));
      ok(await admin.post(`/api/admin/orders/${number}/status`, { status: "READY_TO_SHIP" }));
      ok(await admin.post(`/api/admin/orders/${number}/shipping`, { shippingCompany: "پست پیشتاز", trackingNumber: "TRK123456" }));
      ok(await admin.post(`/api/admin/orders/${number}/status`, { status: "SHIPPED" }));
      const o = await db.order.findUniqueOrThrow({ where: { number }, include: { history: { orderBy: { createdAt: "asc" } } } });
      assert.equal(o.status, "SHIPPED"); assert.equal(o.trackingNumber, "TRK123456"); assert.equal(o.shippingCompany, "پست پیشتاز");
      assert.deepEqual(o.history.map((h) => h.status).slice(-3), ["PREPARING", "READY_TO_SHIP", "SHIPPED"]);
      assert.equal(o.history.at(-3)!.description, "در حال بسته‌بندی");
      assert.ok(await db.notification.findFirst({ where: { userId, type: "order_status" } }));
      assert.ok((await logCount("order.status")) >= 3);
      assert.equal((await manager.post(`/api/admin/orders/${number}/status`, { status: "DELIVERED" })).status, 403);
    });
    it("cancel requires a reason, restocks, and is blocked for paid orders (refund path instead)", async () => {
      const { number, variantId } = await placeOrder();
      const before = (await db.inventory.findUniqueOrThrow({ where: { variantId } })).quantity;
      assert.equal((await admin.post(`/api/admin/orders/${number}/cancel`, {})).status, 422);
      ok(await admin.post(`/api/admin/orders/${number}/cancel`, { reason: "درخواست مشتری" }));
      assert.equal((await db.order.findUniqueOrThrow({ where: { number } })).status, "CANCELLED");
      assert.equal((await db.inventory.findUniqueOrThrow({ where: { variantId } })).quantity, before + 1);
      assert.equal((await admin.post(`/api/admin/orders/${number}/cancel`, { reason: "دوباره" })).status, 409);
      const paid = await placeOrder(true);
      ok(await admin.post(`/api/admin/payments/${(await db.payment.findFirstOrThrow({ where: { order: { number: paid.number } } })).id}/approve`));
      assert.equal((await admin.post(`/api/admin/orders/${paid.number}/cancel`, { reason: "x y z" })).status, 409);
    });
    it("cancelled orders leave the payment review queue", async () => {
      const { number } = await placeOrder(true);
      ok(await admin.post(`/api/admin/orders/${number}/cancel`, { reason: "لغو توسط مدیر" }));
      assert.equal(ok(await admin.get(`/api/admin/payments?status=REVIEW&q=${number}`)).items.length, 0);
    });
    it("refund (Phase 4 flow): REFUNDED only after the money really moved; wallet refund needs the customer's confirmation", async () => {
      const { c, number, variantId } = await placeOrder(true);
      const pay = await db.payment.findFirstOrThrow({ where: { order: { number } } });
      ok(await admin.post(`/api/admin/payments/${pay.id}/approve`));
      const stock = (await db.inventory.findUniqueOrThrow({ where: { variantId } })).quantity;
      assert.equal((await admin.post(`/api/admin/orders/${number}/refunds`, { method: "wallet", amount: pay.amount, reason: "" })).status, 422);
      const r = ok(await admin.post(`/api/admin/orders/${number}/refunds`, { method: "wallet", amount: pay.amount, reason: "کالا معیوب بود", restock: true }));
      const mid = await db.order.findUniqueOrThrow({ where: { number } });
      assert.equal(mid.status, "PROCESSING"); assert.equal(mid.paymentStatus, "PAID"); // requesting a refund alone changes nothing
      ok(await c.post(`/api/refunds/${r.id}/accept`));
      const o = await db.order.findUniqueOrThrow({ where: { number }, include: { payments: true } });
      assert.equal(o.status, "REFUNDED"); assert.equal(o.paymentStatus, "REFUNDED"); assert.equal(o.payments[0].status, "REFUNDED");
      assert.equal((await db.inventory.findUniqueOrThrow({ where: { variantId } })).quantity, stock + 1);
      assert.equal((await admin.post(`/api/admin/orders/${number}/refunds`, { method: "wallet", amount: 1000, reason: "دوباره" })).status, 409);
    });
  });

  describe("Customers and wholesale", () => {
    it("search, detail, profile edit; password hash is never exposed", async () => {
      const { phone, userId } = await registerAndLogin();
      const list = ok(await admin.get(`/api/admin/customers?q=${phone}`));
      assert.equal(list.items.length, 1);
      const d = ok(await admin.get(`/api/admin/customers/${userId}`));
      assert.ok(!("passwordHash" in d)); assert.ok(!JSON.stringify(d).includes("passwordHash"));
      assert.deepEqual(d.roles.map((r: any) => r.key), ["customer"]);
      ok(await admin.patch(`/api/admin/customers/${userId}`, { firstName: "علی", lastName: "احمدی" }));
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: userId } })).lastName, "احمدی");
      assert.equal((await admin.patch(`/api/admin/customers/${userId}`, { phone: "09990000000", passwordHash: "x" })).status, 200); // unknown fields are stripped, nothing changes
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: userId } })).phone, phone);
      assert.equal((await admin.patch(`/api/admin/customers/${(await db.user.findUniqueOrThrow({ where: { phone: "09120000001" } })).id}`, { isActive: false })).status, 409); // not yourself
    });
    it("role management: needs role.manage, no privilege escalation, no self-demotion", async () => {
      const { userId } = await registerAndLogin();
      ok(await admin.post(`/api/admin/customers/${userId}/roles`, { roleKeys: ["customer", "support"] }));
      assert.equal((await db.userRole.count({ where: { userId } })), 2);
      // an "admin" (all but role.manage) cannot manage roles at all
      const lowAdmin = await registerAndLogin();
      await db.userRole.create({ data: { userId: lowAdmin.userId, roleId: (await db.role.findUniqueOrThrow({ where: { key: "order_manager" } })).id } });
      assert.equal((await lowAdmin.c.post(`/api/admin/customers/${userId}/roles`, { roleKeys: ["customer"] })).status, 403);
      const self = (await db.user.findUniqueOrThrow({ where: { phone: "09120000001" } })).id;
      assert.equal((await admin.post(`/api/admin/customers/${self}/roles`, { roleKeys: ["customer"] })).status, 409);
      assert.equal((await admin.post(`/api/admin/customers/${userId}/roles`, { roleKeys: ["nope"] })).status, 409);
      assert.ok((await logCount("customer.roles", userId)) >= 1);
    });
    it("a staff member holding role.manage still cannot grant a role with permissions they lack", async () => {
      const mgr = await registerAndLogin();
      const rm = await db.role.upsert({ where: { key: "test_role_manager" }, update: {}, create: { key: "test_role_manager", name: "تست", isStaff: true } });
      const perm = await db.permission.findUniqueOrThrow({ where: { key: "role.manage" } }), cr = await db.permission.findUniqueOrThrow({ where: { key: "customer.read" } });
      for (const p of [perm, cr]) await db.rolePermission.upsert({ where: { roleId_permissionId: { roleId: rm.id, permissionId: p.id } }, update: {}, create: { roleId: rm.id, permissionId: p.id } });
      await db.userRole.create({ data: { userId: mgr.userId, roleId: rm.id } });
      const target = await registerAndLogin();
      assert.equal((await mgr.c.post(`/api/admin/customers/${target.userId}/roles`, { roleKeys: ["customer", "super_admin"] })).status, 403);
      assert.equal((await mgr.c.post(`/api/admin/customers/${target.userId}/roles`, { roleKeys: ["customer", "wholesale_partner"] })).status, 200);
    });
    it("wholesale: approve (tier + role + profile), reject/request-changes need a note, states are audited", async () => {
      const a = await registerAndLogin(), b = await registerAndLogin(), c = await registerAndLogin();
      const mk = (u: { phone: string; userId: string }, name: string) => db.wholesaleApplication.create({ data: { userId: u.userId, name, phone: u.phone, storeName: "فروشگاه " + name, businessType: "online_shop", city: "تهران", address: "تهران خیابان آزادی پلاک ۱" } });
      const [appA, appB, appC] = [await mk(a, "الف"), await mk(b, "ب"), await mk(c, "ج")];
      assert.ok(ok(await admin.get("/api/admin/wholesale?status=PENDING")).items.some((x: any) => x.id === appA.id));
      const tier = await db.wholesaleTier.findUniqueOrThrow({ where: { key: "bronze" } });
      assert.equal((await admin.post(`/api/admin/wholesale/${appB.id}/reject`, {})).status, 422);
      ok(await admin.post(`/api/admin/wholesale/${appB.id}/reject`, { note: "مدارک ناقص" }));
      ok(await admin.post(`/api/admin/wholesale/${appC.id}/request-changes`, { note: "لینک اینستاگرام را کامل کنید" }));
      assert.equal((await db.wholesaleApplication.findUniqueOrThrow({ where: { id: appC.id } })).status, "CHANGES_REQUESTED");
      const inactive = await db.wholesaleTier.findUniqueOrThrow({ where: { key: "gold" } });
      assert.equal((await admin.post(`/api/admin/wholesale/${appA.id}/approve`, { tierId: inactive.id })).status, 400);
      ok(await admin.post(`/api/admin/wholesale/${appA.id}/approve`, { tierId: tier.id, note: "خوش آمدید" }));
      const ur = await db.user.findUniqueOrThrow({ where: { id: a.userId }, include: { roles: { include: { role: true } }, wholesaleProfile: true } });
      assert.ok(ur.roles.some((r) => r.role.key === "wholesale_partner")); assert.equal(ur.wholesaleProfile?.tierId, tier.id);
      assert.equal((await a.c.get("/api/me")).json.data.wholesale.tierKey, "bronze");
      assert.equal((await admin.post(`/api/admin/wholesale/${appA.id}/approve`, { tierId: tier.id })).status, 409);
      assert.equal(await logCount("wholesale.approved", appA.id), 1);
      // tier change + revoke
      ok(await admin.patch(`/api/admin/wholesale/partners/${a.userId}`, { tierId: tier.id }));
      ok(await admin.del(`/api/admin/wholesale/partners/${a.userId}`));
      assert.equal((await a.c.get("/api/me")).json.data.wholesale, null);
    });
    it("approval without a registered user fails cleanly", async () => {
      const app = await db.wholesaleApplication.create({ data: { name: "ناشناس", phone: newPhone(), storeName: "x", businessType: "other", city: "شهر", address: "آدرس کامل نمونه" } });
      const tier = await db.wholesaleTier.findUniqueOrThrow({ where: { key: "bronze" } });
      assert.equal((await admin.post(`/api/admin/wholesale/${app.id}/approve`, { tierId: tier.id })).status, 409);
    });
    it("customers can apply for wholesale (one open application at a time)", async () => {
      const { c } = await registerAndLogin();
      const body = { name: "متقاضی", storeName: "فروشگاه", businessType: "instagram_shop", city: "شیراز", address: "شیراز، خیابان زند، پلاک ۵" };
      ok(await c.post("/api/wholesale/apply", body));
      assert.equal((await c.post("/api/wholesale/apply", body)).status, 409);
      assert.equal((await new Client().post("/api/wholesale/apply", body)).status, 401);
    });
    it("tier CRUD", async () => {
      const t = ok(await admin.post("/api/admin/r/tiers", { key: "t" + uid(), name: "تست", minOrder: 5_000_000, discountPercent: 2 }));
      ok(await admin.patch(`/api/admin/r/tiers/${t.id}`, { isActive: false, key: "changed" }));
      const row = await db.wholesaleTier.findUniqueOrThrow({ where: { id: t.id } });
      assert.equal(row.isActive, false); assert.notEqual(row.key, "changed"); // key is immutable
      ok(await admin.del(`/api/admin/r/tiers/${t.id}`));
    });
  });

  describe("Coupons, shipping, settings, banners, homepage, menus", () => {
    it("coupon CRUD with validation, usage visibility and effect on checkout", async () => {
      const code = "T" + uid().toUpperCase();
      assert.equal((await admin.post("/api/admin/r/coupons", { code, type: "percent", value: 150 })).status, 409);
      assert.equal((await admin.post("/api/admin/r/coupons", { code: "x", type: "percent", value: 10 })).status, 422);
      assert.equal((await admin.post("/api/admin/r/coupons", { code, type: "fixed", value: 1000, startsAt: "2030-01-02T00:00:00Z", endsAt: "2030-01-01T00:00:00Z" })).status, 409);
      const c = ok(await admin.post("/api/admin/r/coupons", { code: code.toLowerCase(), type: "percent", value: 20, minOrder: 0, maxDiscount: 50000, usageLimit: 5, perUserLimit: 1 }));
      assert.equal(c.code, code); assert.equal(c.usedCount, 0);
      ok(await admin.patch(`/api/admin/r/coupons/${c.id}`, { value: 25, code: "IGNORED" }));
      const row = await db.coupon.findUniqueOrThrow({ where: { id: c.id } });
      assert.equal(row.value, 25);
      const { c: shopper } = await registerAndLogin();
      const inv = await db.inventory.findFirstOrThrow({ where: { quantity: { gte: 5 }, variant: { product: { isActive: true, phoneModels: { none: {} } } } }, include: { variant: { include: { product: true } } } });
      ok(await shopper.post("/api/cart/items", { productSlug: inv.variant.product.slug, variantId: inv.variantId, quantity: 1 }));
      const applied = await shopper.post("/api/cart/coupon", { code });
      assert.equal(applied.status, 200, JSON.stringify(applied.json));
      ok(await admin.patch(`/api/admin/r/coupons/${c.id}`, { isActive: false }));
      assert.notEqual((await shopper.post("/api/cart/coupon", { code })).status, 200); // disabled coupon no longer applies
      await db.couponUsage.create({ data: { couponId: c.id } });
      assert.equal((await admin.del(`/api/admin/r/coupons/${c.id}`)).status, 409); // used coupons are kept
      await db.couponUsage.deleteMany({ where: { couponId: c.id } });
      ok(await admin.del(`/api/admin/r/coupons/${c.id}`));
    });
    it("shipping CRUD is reflected in the real checkout quote", async () => {
      const key = "s" + uid();
      const m = ok(await admin.post("/api/admin/r/shipping", { key, name: "پیک ویژه " + key, cost: 12345, freeThreshold: null }));
      const { c } = await registerAndLogin();
      const inv = await db.inventory.findFirstOrThrow({ where: { quantity: { gte: 5 }, variant: { product: { isActive: true, phoneModels: { none: {} } } } }, include: { variant: { include: { product: true } } } });
      ok(await c.post("/api/cart/items", { productSlug: inv.variant.product.slug, variantId: inv.variantId, quantity: 1 }));
      const q = ok(await c.get(`/api/checkout/quote?shippingMethodId=${m.id}`));
      assert.ok(q.shippingMethods.some((x: any) => x.id === m.id && x.cost === 12345));
      assert.equal(q.shipping, 12345);
      ok(await admin.patch(`/api/admin/r/shipping/${m.id}`, { cost: 20000, isActive: false }));
      const q2 = ok(await c.get(`/api/checkout/quote`));
      assert.ok(!q2.shippingMethods.some((x: any) => x.id === m.id));
      ok(await admin.del(`/api/admin/r/shipping/${m.id}`));
    });
    it("payment settings edited in the panel appear on the customer's order page; validation applies; audit stores old/new", async () => {
      const cur = ok(await admin.get("/api/admin/settings"));
      assert.equal((await admin.put("/api/admin/settings/payment", { ...cur.payment, cardNumber: "12" })).status, 422);
      assert.equal((await admin.put("/api/admin/settings/payment", { ...cur.payment, iban: "GB123" })).status, 422);
      assert.equal((await admin.put("/api/admin/settings/nope", {})).status, 404);
      const newCard = "6037-9911-2233-4455";
      ok(await admin.put("/api/admin/settings/payment", { ...cur.payment, cardNumber: newCard, bankName: "بانک تست‌شده" }));
      const { c, number } = await placeOrder();
      void c;
      const page = await (await loginForOrder(number)).get(`/account/orders/${number}`);
      assert.match(page.text, /6037-9911-2233-4455/); assert.match(page.text, /بانک تست‌شده/);
      const log = await db.adminLog.findFirstOrThrow({ where: { action: "settings.update", entityId: "payment" }, orderBy: { createdAt: "desc" } });
      assert.equal((log.newValue as any).cardNumber, newCard); assert.equal((log.oldValue as any).cardNumber, cur.payment.cardNumber);
      ok(await admin.put("/api/admin/settings/payment", cur.payment)); // restore
    });
    it("site settings (name/phone/topBar) change the storefront without code changes", async () => {
      const cur = ok(await admin.get("/api/admin/settings")).site;
      const tag = "تست" + uid();
      ok(await admin.put("/api/admin/settings/site", { ...cur, topBar: "نوار " + tag, phone: "021-99887766" }));
      const html = (await new Client().get("/")).text;
      assert.ok(html.includes("نوار " + tag)); assert.ok(html.includes("021-99887766"));
      ok(await admin.put("/api/admin/settings/site", cur));
      assert.ok(!(await new Client().get("/")).text.includes("نوار " + tag));
    });
    it("banner CRUD, scheduling and reorder", async () => {
      const t = "بنر " + uid();
      const b = ok(await admin.post("/api/admin/r/banners", { title: t, subtitle: "زیر", buttonText: "برو", buttonLink: "/shop", placement: "shop_top", desktopImage: "/media/images/x.png" }));
      assert.match((await new Client().get("/shop")).text, new RegExp(t));
      ok(await admin.patch(`/api/admin/r/banners/${b.id}`, { startsAt: new Date(Date.now() + 86400_000).toISOString() }));
      assert.ok(!(await new Client().get("/shop")).text.includes(t), "future banner must not show");
      ok(await admin.patch(`/api/admin/r/banners/${b.id}`, { startsAt: null, isActive: false }));
      assert.ok(!(await new Client().get("/shop")).text.includes(t));
      assert.equal((await admin.post("/api/admin/r/banners", { title: "x", buttonLink: "javascript:alert(1)" })).status, 422);
      const b2 = ok(await admin.post("/api/admin/r/banners", { title: t + "2", placement: "shop_top" }));
      ok(await admin.post("/api/admin/r/banners/reorder", { ids: [b2.id, b.id] }));
      assert.equal((await db.banner.findUniqueOrThrow({ where: { id: b2.id } })).sortOrder, 1);
      assert.equal((await admin.post("/api/admin/r/banners/reorder", { ids: ["nope"] })).status, 404);
      ok(await admin.del(`/api/admin/r/banners/${b.id}`)); ok(await admin.del(`/api/admin/r/banners/${b2.id}`));
    });
    it("homepage sections: retitle, disable, reorder and hand-pick products show up on the home page", async () => {
      const sec = await db.homepageSection.findFirstOrThrow({ where: { type: "product_rail", isActive: true } });
      const orig = { title: sec.title, sortOrder: sec.sortOrder, config: sec.config };
      const tag = "عنوان " + uid();
      const prod = await db.product.findFirstOrThrow({ where: { isActive: true }, orderBy: { name: "desc" } });
      ok(await admin.patch(`/api/admin/r/homepage/${sec.id}`, { title: tag, config: { productIds: [prod.id] } }));
      const html = (await new Client().get("/")).text;
      assert.ok(html.includes(tag)); assert.ok(html.includes(prod.name));
      ok(await admin.patch(`/api/admin/r/homepage/${sec.id}`, { isActive: false }));
      assert.ok(!(await new Client().get("/")).text.includes(tag));
      ok(await admin.patch(`/api/admin/r/homepage/${sec.id}`, { isActive: true, title: orig.title, config: (orig.config as object) ?? {} }));
      assert.equal((await admin.patch(`/api/admin/r/homepage/${sec.id}`, { type: "hero", key: "hacked" })).status, 400); // immutable → nothing to update
    });
    it("menu CRUD changes the real header and footer", async () => {
      const label = "منو" + uid(), flabel = "پایین" + uid();
      const m = ok(await admin.post("/api/admin/r/menus", { menu: "main", label, link: "/shop" }));
      assert.match((await new Client().get("/")).text, new RegExp(label));
      const f = ok(await admin.post("/api/admin/r/menus", { menu: "footer", label: flabel, link: "/support" }));
      assert.match((await new Client().get("/")).text, new RegExp(flabel));
      assert.equal((await admin.patch(`/api/admin/r/menus/${m.id}`, { parentId: m.id })).status, 409);
      ok(await admin.patch(`/api/admin/r/menus/${m.id}`, { isActive: false }));
      assert.ok(!(await new Client().get("/")).text.includes(label));
      ok(await admin.del(`/api/admin/r/menus/${m.id}`)); ok(await admin.del(`/api/admin/r/menus/${f.id}`));
    });
  });

  describe("Reviews and audit log", () => {
    it("review moderation updates the product rating", async () => {
      const r = await db.review.findFirstOrThrow({ where: { status: "pending" } });
      assert.equal((await manager.patch(`/api/admin/reviews/${r.id}`, { status: "approved" })).status, 403);
      ok(await admin.patch(`/api/admin/reviews/${r.id}`, { status: "approved" }));
      const p = await db.product.findUniqueOrThrow({ where: { id: r.productId } });
      assert.ok(p.ratingCount >= 1 && p.ratingAvg > 0);
      ok(await admin.patch(`/api/admin/reviews/${r.id}`, { status: "pending" }));
    });
    it("audit records carry admin, action, entity, old/new value, ip and time; the API is read-only", async () => {
      const t = ok(await admin.post("/api/admin/r/brands", { name: "لاگ " + uid(), slug: "log-" + uid() }));
      const log = await db.adminLog.findFirstOrThrow({ where: { entityId: t.id, action: "brand.create" } });
      assert.ok(log.adminId && log.entity === "brand" && log.newValue && log.createdAt); assert.ok(log.ip);
      const api = ok(await admin.get("/api/admin/audit?entity=brand"));
      assert.ok(api.items.some((i: any) => i.id === log.id && i.admin.phone === "09120000001"));
      assert.equal((await manager.get("/api/admin/audit")).status, 403);
      for (const m of ["POST", "PUT", "PATCH", "DELETE"]) assert.ok([404, 405].includes((await admin.req(m, "/api/admin/audit", {})).status), m);
      ok(await admin.del(`/api/admin/r/brands/${t.id}`));
    });
    it("audit rows are immutable at the database level (no update / delete)", async () => {
      const row = await db.adminLog.findFirstOrThrow();
      await assert.rejects(() => db.adminLog.update({ where: { id: row.id }, data: { action: "tampered" } }), /append-only/);
      await assert.rejects(() => db.adminLog.delete({ where: { id: row.id } }), /append-only/);
      await assert.rejects(() => db.adminLog.deleteMany({ where: { id: row.id } }), /append-only/);
      assert.equal((await db.adminLog.findUniqueOrThrow({ where: { id: row.id } })).action, row.action);
    });
    it("rate limiting protects admin writes", async () => {
      const c = await loginWithPassword("09120000001", "Admin@12345");
      const uidRow = await db.user.findUniqueOrThrow({ where: { phone: "09120000001" } });
      await db.rateLimit.upsert({ where: { key: `admin:w:${uidRow.id}` }, update: { count: 239, resetAt: new Date(Date.now() + 60_000) }, create: { key: `admin:w:${uidRow.id}`, count: 239, resetAt: new Date(Date.now() + 60_000) } });
      const first = await c.post("/api/admin/r/brands/reorder", { ids: ["x"] });
      assert.notEqual(first.status, 429);
      assert.equal((await c.post("/api/admin/r/brands/reorder", { ids: ["x"] })).status, 429);
      await db.rateLimit.delete({ where: { key: `admin:w:${uidRow.id}` } });
    });
  });
});

async function loginForOrder(number: number) {
  // the order belongs to a throw-away customer; log in as them through a planted OTP
  const o = await db.order.findUniqueOrThrow({ where: { number }, include: { user: true } });
  const { plantOtp } = await import("./test-utils");
  const c = new Client();
  const code = await plantOtp(o.user!.phone, "login");
  const r = await c.post("/api/auth/otp/verify", { phone: o.user!.phone, code });
  assert.equal(r.status, 200);
  return c;
}
void BASE;
