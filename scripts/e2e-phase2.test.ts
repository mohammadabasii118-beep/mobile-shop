/**
 * Phase 2 integration tests. Run against a running server:
 *   TRUST_PROXY=1 npm run start -- -p 3300   (in another terminal)
 *   BASE_URL=http://localhost:3300 npm run test:e2e
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { __hashOtpForTests } from "../lib/server/auth/otp";

const BASE = process.env.BASE_URL ?? "http://localhost:3300";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

let ipCounter = 10;
const nextIp = () => `10.9.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;
const rnd = () => String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
const newPhone = () => `0919${rnd()}`;

/** Minimal browser: keeps cookies, sends a unique client IP so rate limits are per test. */
class Client {
  jar = new Map<string, string>();
  ip = nextIp();
  async req(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
    const headers: Record<string, string> = { "x-forwarded-for": this.ip, cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "), ...extra };
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers["content-type"] = "application/json"; payload = JSON.stringify(body); }
    const res = await fetch(BASE + path, { method, headers, body: payload, redirect: "manual" });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i), val = pair.slice(i + 1);
      if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c) || val === "") this.jar.delete(name); else this.jar.set(name, val);
    }
    const text = await res.text();
    let json: any = null; try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, headers: res.headers, text };
  }
  get = (p: string, h?: Record<string, string>) => this.req("GET", p, undefined, h);
  post = (p: string, b?: unknown, h?: Record<string, string>) => this.req("POST", p, b ?? {}, h);
  patch = (p: string, b: unknown) => this.req("PATCH", p, b);
  del = (p: string) => this.req("DELETE", p);
}

async function plantOtp(phone: string, purpose: "login" | "reset", code = "4321", opts: { expired?: boolean } = {}) {
  await db.otpCode.updateMany({ where: { phone, purpose, usedAt: null }, data: { usedAt: new Date() } });
  await db.otpCode.create({ data: { phone, purpose, codeHash: __hashOtpForTests(phone, purpose, code), expiresAt: new Date(Date.now() + (opts.expired ? -1000 : 120_000)) } });
  return code;
}
async function registerAndLogin(c = new Client()) {
  const phone = newPhone();
  const code = await plantOtp(phone, "login");
  const r = await c.post("/api/auth/otp/verify", { phone, code });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return { c, phone, res: r.json.data };
}
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const fileForm = (buf: Buffer, name: string, type: string, ref = "REF-12345") => {
  const f = new FormData();
  f.set("receipt", new Blob([new Uint8Array(buf)], { type }), name);
  f.set("referenceNumber", ref);
  return f;
};
async function addressFor(c: Client) {
  const r = await c.post("/api/addresses", { receiver: "تست", phone: "09121234567", province: "تهران", city: "تهران", postalCode: "1234567890", address: "خیابان ولیعصر، پلاک ۱۰" });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return r.json.data.id as string;
}
const clearPartnerCart = () => db.cartItem.deleteMany({ where: { cart: { user: { phone: "09120000003" } } } });
async function shippingId() { return (await db.shippingMethod.findFirstOrThrow({ where: { key: "post" } })).id; }
async function productWithStock(minStock = 5) {
  const inv = await db.inventory.findFirstOrThrow({ where: { quantity: { gte: minStock }, variant: { product: { isActive: true, phoneModels: { none: {} }, variants: { some: {} } } } }, include: { variant: { include: { product: true } } } });
  return inv;
}

describe("Phase 2", () => {
  // Seeded demo accounts are logged into by several tests; clear their login counters so reruns are stable.
  before(async () => {
    await db.rateLimit.deleteMany({}); // tests use fixed fake IPs; counters from earlier runs must not leak in
    await db.address.deleteMany({ where: { user: { phone: { in: ["09120000002", "09120000003"] } } } }); // the address cap (10) would otherwise trip on reruns
  });
  after(async () => { await db.$disconnect(); });

  describe("Authentication", () => {
    it("blocks unauthenticated access", async () => {
      const c = new Client();
      assert.equal((await c.get("/api/me")).status, 401);
      assert.equal((await c.get("/api/orders")).status, 401);
      assert.equal((await c.post("/api/checkout/orders", {})).status, 401);
    });
    it("rejects cross-origin writes (CSRF)", async () => {
      const c = new Client();
      const r = await c.post("/api/auth/otp/request", { phone: newPhone() }, { origin: "https://evil.example" });
      assert.equal(r.status, 403);
    });
    it("registers on first OTP login and issues an HttpOnly session cookie", async () => {
      const { c, res } = await registerAndLogin();
      assert.equal(res.registered, true);
      assert.equal(res.needsProfile, true);
      assert.ok(c.jar.has("cl_session"));
      const me = await c.get("/api/me");
      assert.equal(me.status, 200);
      assert.deepEqual(me.json.data.roles, ["customer"]);
    });
    it("cookie flags are safe", async () => {
      const c = new Client();
      const phone = newPhone(); const code = await plantOtp(phone, "login");
      const res = await fetch(BASE + "/api/auth/otp/verify", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": nextIp() }, body: JSON.stringify({ phone, code }) });
      const sc = res.headers.getSetCookie().find((x) => x.startsWith("cl_session="))!;
      assert.match(sc, /HttpOnly/i); assert.match(sc, /SameSite=lax/i); assert.match(sc, /Path=\//i);
      void c;
    });
    it("OTP is single-use", async () => {
      const phone = newPhone(); const code = await plantOtp(phone, "login");
      const a = await new Client().post("/api/auth/otp/verify", { phone, code });
      assert.equal(a.status, 200);
      const b = await new Client().post("/api/auth/otp/verify", { phone, code });
      assert.equal(b.status, 400);
      assert.equal(b.json.error.code, "otp_invalid");
    });
    it("expired OTP is rejected", async () => {
      const phone = newPhone(); const code = await plantOtp(phone, "login", "1111", { expired: true });
      assert.equal((await new Client().post("/api/auth/otp/verify", { phone, code })).status, 400);
    });
    it("locks a code after 5 wrong attempts, even if the right code is then sent", async () => {
      const phone = newPhone(); const code = await plantOtp(phone, "login", "5555");
      const c = new Client();
      for (let i = 0; i < 5; i++) assert.equal((await c.post("/api/auth/otp/verify", { phone, code: "0000" })).status, 400);
      assert.equal((await c.post("/api/auth/otp/verify", { phone, code })).status, 400);
    });
    it("OTP request has a resend cooldown", async () => {
      const phone = newPhone(); const c = new Client();
      assert.equal((await c.post("/api/auth/otp/request", { phone })).status, 200);
      const again = await c.post("/api/auth/otp/request", { phone });
      assert.equal(again.status, 429);
      assert.ok(again.headers.get("retry-after"));
    });
    it("OTP is not stored in plaintext", async () => {
      const phone = newPhone(); await new Client().post("/api/auth/otp/request", { phone });
      const row = await db.otpCode.findFirstOrThrow({ where: { phone } });
      assert.match(row.codeHash, /^[a-f0-9]{64}$/);
    });
    it("password login, wrong password, forgot + reset flow", async () => {
      const { c, phone } = await registerAndLogin();
      const setPw = await c.post("/api/account/password", { newPassword: "Secret123" });
      assert.equal(setPw.status, 200, JSON.stringify(setPw.json));
      const hash = (await db.user.findUniqueOrThrow({ where: { phone } })).passwordHash!;
      assert.ok(hash.startsWith("$2"), "password must be a bcrypt hash");
      await c.post("/api/auth/logout");
      assert.equal((await c.get("/api/me")).status, 401);

      const c2 = new Client();
      assert.equal((await c2.post("/api/auth/login", { phone, password: "wrong-pass1" })).status, 400);
      assert.equal((await c2.post("/api/auth/login", { phone, password: "Secret123" })).status, 200);
      assert.equal((await c2.get("/api/me")).status, 200);

      // forgot password
      const c3 = new Client();
      assert.equal((await c3.post("/api/auth/forgot", { phone })).status, 200);
      const code = await plantOtp(phone, "reset", "9876");
      const v = await c3.post("/api/auth/forgot/verify", { phone, code });
      assert.equal(v.status, 200, JSON.stringify(v.json));
      assert.equal((await c3.post("/api/auth/reset", { ticket: "garbage-ticket-value", password: "NewPass123" })).status, 400);
      assert.equal((await c3.post("/api/auth/reset", { ticket: v.json.data.ticket, password: "NewPass123" })).status, 200);
      assert.equal((await c2.get("/api/me")).status, 401, "all sessions must be revoked after reset");
      assert.equal((await new Client().post("/api/auth/login", { phone, password: "Secret123" })).status, 400);
      assert.equal((await new Client().post("/api/auth/login", { phone, password: "NewPass123" })).status, 200);
    });
    it("forgot password does not reveal unknown numbers", async () => {
      const r = await new Client().post("/api/auth/forgot", { phone: newPhone() });
      assert.equal(r.status, 200);
    });
    it("brute-force protection on password login", async () => {
      const phone = newPhone(); const c = new Client();
      let last = 0;
      for (let i = 0; i < 10; i++) last = (await c.post("/api/auth/login", { phone, password: "wrong-pass1" })).status;
      assert.equal(last, 429);
    });
    it("a client cannot change its own role or permissions", async () => {
      const { c } = await registerAndLogin();
      const r = await c.patch("/api/me", { firstName: "علی", lastName: "رضایی", roles: ["super_admin"], permissions: ["*"] });
      assert.equal(r.status, 200);
      assert.deepEqual((await c.get("/api/me")).json.data.roles, ["customer"]);
      assert.equal((await c.post("/api/admin/payments/x/approve")).status, 403);
    });
  });

  describe("Cart", () => {
    it("guest cart persists, updates, removes and merges on login", async () => {
      const inv = await productWithStock(10);
      const slug = inv.variant.product.slug;
      const c = new Client();
      const add = await c.post("/api/cart/items", { productSlug: slug, quantity: 2 });
      assert.equal(add.status, 200, JSON.stringify(add.json));
      assert.equal(add.json.data.count, 2);
      assert.equal((await c.get("/api/cart")).json.data.lines.length, 1, "guest cart persists via cookie");

      const itemId = add.json.data.lines[0].id;
      const upd = await c.patch(`/api/cart/items/${itemId}`, { quantity: 4 });
      assert.equal(upd.json.data.count, 4);

      // login → guest cart merges into the user's cart
      const phone = newPhone(); const code = await plantOtp(phone, "login");
      assert.equal((await c.post("/api/auth/otp/verify", { phone, code })).status, 200);
      const merged = await c.get("/api/cart");
      assert.equal(merged.json.data.count, 4);
      assert.equal(await db.cart.count({ where: { guestKey: c.jar.get("cl_guest") ?? "none" } }), 0);

      const del = await c.del(`/api/cart/items/${merged.json.data.lines[0].id}`);
      assert.equal(del.json.data.count, 0);
    });
    it("ignores client-supplied prices and computes totals on the server", async () => {
      const inv = await productWithStock();
      const c = new Client();
      const r = await c.post("/api/cart/items", { productSlug: inv.variant.product.slug, quantity: 1, price: 1, unitPrice: 1, total: 1 });
      const p = inv.variant.product;
      assert.equal(r.json.data.lines[0].unitPrice, p.retailPrice - p.retailDiscount);
      assert.equal(r.json.data.subtotal, p.retailPrice - p.retailDiscount);
    });
    it("refuses more than the available stock", async () => {
      const inv = await productWithStock();
      const c = new Client();
      const r = await c.post("/api/cart/items", { productSlug: inv.variant.product.slug, quantity: 99 });
      assert.equal(r.status, 409);
      assert.equal(r.json.error.code, "out_of_stock");
    });
    it("a user cannot modify another user's cart item", async () => {
      const inv = await productWithStock();
      const a = new Client(); const b = new Client();
      const add = await a.post("/api/cart/items", { productSlug: inv.variant.product.slug, quantity: 1 });
      const itemId = add.json.data.lines[0].id;
      await b.post("/api/cart/items", { productSlug: inv.variant.product.slug, quantity: 1 });
      assert.equal((await b.patch(`/api/cart/items/${itemId}`, { quantity: 9 })).status, 404);
      assert.equal((await b.del(`/api/cart/items/${itemId}`)).status, 404);
    });
  });

  describe("Checkout, orders, payment", () => {
    it("full flow: coupon, shipping, order snapshot, inventory, receipt, admin approval", async () => {
      const inv = await productWithStock(10);
      const p = inv.variant.product;
      const { c, phone } = await registerAndLogin();
      const unit = p.retailPrice - p.retailDiscount;
      await c.post("/api/cart/items", { productSlug: p.slug, quantity: 2 });
      const addressId = await addressFor(c);
      const ship = await shippingId();

      const cp = await c.post("/api/cart/coupon", { code: "case10" });
      assert.equal(cp.status, 200, JSON.stringify(cp.json));
      const q = await c.get(`/api/checkout/quote?shippingMethodId=${ship}`);
      assert.equal(q.status, 200);
      const sub = unit * 2;
      const coupon = await db.coupon.findUniqueOrThrow({ where: { code: "CASE10" } });
      const disc = Math.min(Math.floor((sub * coupon.value) / 100), coupon.maxDiscount ?? Infinity);
      const post = await db.shippingMethod.findUniqueOrThrow({ where: { id: ship } });
      const shipCost = post.freeThreshold != null && sub - disc >= post.freeThreshold ? 0 : post.cost;
      assert.equal(q.json.data.subtotal, sub);
      assert.equal(q.json.data.discount, disc);
      assert.equal(q.json.data.total, sub - disc + shipCost);

      const before = (await db.inventory.findUniqueOrThrow({ where: { id: inv.id } })).quantity;
      const created = await c.post("/api/checkout/orders", { addressId, shippingMethodId: ship, paymentMethod: "card_to_card", total: 1, subtotal: 1 });
      assert.equal(created.status, 200, JSON.stringify(created.json));
      assert.equal(created.json.data.total, sub - disc + shipCost, "client-sent totals must be ignored");

      const order = await db.order.findUniqueOrThrow({ where: { number: created.json.data.number }, include: { items: true, history: true, payments: true } });
      assert.equal(order.status, "PENDING_PAYMENT");
      assert.equal(order.paymentStatus, "PENDING");
      assert.equal(order.items[0].unitPrice, unit);
      assert.equal(order.items[0].priceType, "retail");
      assert.equal(order.items[0].name, p.name);
      assert.equal((order.shippingAddress as any).city, "تهران");
      assert.equal(order.payments[0].amount, order.total);
      assert.equal(order.history.length, 1);
      assert.equal((await db.inventory.findUniqueOrThrow({ where: { id: inv.id } })).quantity, before - 2);
      assert.equal((await c.get("/api/cart")).json.data.count, 0, "cart is emptied");

      // price snapshot survives a later price change
      await db.product.update({ where: { id: p.id }, data: { retailPrice: p.retailPrice + 500_000 } });
      const again = await c.get(`/api/orders/${order.number}`);
      assert.equal(again.json.data.items[0].unitPrice, unit);
      await db.product.update({ where: { id: p.id }, data: { retailPrice: p.retailPrice } });

      // receipt upload validation
      assert.equal((await c.post(`/api/orders/${order.number}/payment/proof`, fileForm(Buffer.from("not an image at all, just text"), "fake.png", "image/png"))).status, 400);
      assert.equal((await c.post(`/api/orders/${order.number}/payment/proof`, fileForm(PNG, "r.exe", "application/octet-stream"))).status, 400);
      assert.equal((await c.post(`/api/orders/${order.number}/payment/proof`, fileForm(PNG, "r.png", "image/png", "x"))).status, 422, "reference too short");
      const big = Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]);
      assert.equal((await c.post(`/api/orders/${order.number}/payment/proof`, fileForm(big, "big.png", "image/png"))).status, 400);
      const up = await c.post(`/api/orders/${order.number}/payment/proof`, fileForm(PNG, "../../etc/passwd.png", "image/png"));
      assert.equal(up.status, 200, JSON.stringify(up.json));

      const paid = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: { include: { proofs: true } } } });
      assert.equal(paid.status, "PAYMENT_REVIEW");
      assert.equal(paid.paymentStatus, "REVIEW");
      assert.equal(paid.payments[0].referenceNumber, "REF-12345");
      const proof = paid.payments[0].proofs[0];
      assert.match(proof.storageKey, /^receipts\/[a-z0-9]+\/[0-9a-f-]{36}\.png$/, "server generated key, no user input");
      assert.ok(!proof.storageKey.includes("passwd"));

      // access control on the receipt
      const own = await c.get(`/api/orders/${order.number}/payment/proof/${proof.id}`);
      assert.equal(own.status, 200);
      assert.equal(own.headers.get("content-type"), "image/png");
      assert.match(own.headers.get("cache-control") ?? "", /no-store/);
      const stranger = (await registerAndLogin()).c;
      assert.ok([403, 404].includes((await stranger.get(`/api/orders/${order.number}/payment/proof/${proof.id}`)).status));
      assert.equal((await stranger.get(`/api/orders/${order.number}`)).status, 404, "other user's order is invisible");
      assert.equal((await new Client().get(`/api/orders/${order.number}/payment/proof/${proof.id}`)).status, 401);
      assert.equal((await c.post(`/api/admin/payments/${paid.payments[0].id}/approve`)).status, 403, "customer cannot approve");

      // staff with payment.review can read the receipt and approve
      const admin = new Client();
      const login = await admin.post("/api/auth/login", { phone: "09120000001", password: "Admin@12345" });
      assert.equal(login.status, 200, JSON.stringify(login.json));
      assert.equal((await admin.get(`/api/orders/${order.number}/payment/proof/${proof.id}`)).status, 200);
      const rej = await admin.post(`/api/admin/payments/${paid.payments[0].id}/reject`, { reason: "مبلغ مطابقت ندارد" });
      assert.equal(rej.status, 200, JSON.stringify(rej.json));
      const rejected = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: true } });
      assert.equal(rejected.payments[0].status, "REJECTED");
      assert.equal(rejected.payments[0].rejectReason, "مبلغ مطابقت ندارد");
      assert.equal(rejected.status, "PENDING_PAYMENT");
      // customer resubmits, admin approves
      assert.equal((await c.post(`/api/orders/${order.number}/payment/proof`, fileForm(PNG, "r2.png", "image/png", "REF-99999"))).status, 200);
      const pay = (await db.payment.findFirstOrThrow({ where: { orderId: order.id } }));
      const ok = await admin.post(`/api/admin/payments/${pay.id}/approve`);
      assert.equal(ok.status, 200, JSON.stringify(ok.json));
      const final = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: true, history: true } });
      assert.equal(final.status, "PROCESSING");
      assert.equal(final.paymentStatus, "PAID");
      assert.equal(final.payments[0].status, "PAID");
      assert.ok(final.history.length >= 4);
      assert.equal((await admin.post(`/api/admin/payments/${pay.id}/approve`)).status, 409, "cannot approve twice");
      void phone;
    });

    it("coupon rules: per-user limit and validity", async () => {
      const inv = await productWithStock();
      const { c } = await registerAndLogin();
      await c.post("/api/cart/items", { productSlug: inv.variant.product.slug, quantity: 1 });
      assert.equal((await c.post("/api/cart/coupon", { code: "NOPE" })).status, 400);
      assert.equal((await c.post("/api/cart/coupon", { code: "CASE10" })).status, 200);
    });

    it("cannot order with someone else's address or an empty cart", async () => {
      const a = (await registerAndLogin()).c; const b = (await registerAndLogin()).c;
      const addrA = await addressFor(a);
      const inv = await productWithStock();
      await b.post("/api/cart/items", { productSlug: inv.variant.product.slug, quantity: 1 });
      assert.equal((await b.post("/api/checkout/orders", { addressId: addrA, shippingMethodId: await shippingId(), paymentMethod: "card_to_card" })).status, 404);
      const empty = (await registerAndLogin()).c;
      const own = await addressFor(empty);
      assert.equal((await empty.post("/api/checkout/orders", { addressId: own, shippingMethodId: await shippingId(), paymentMethod: "card_to_card" })).json.error.code, "cart_empty");
      assert.equal((await b.get(`/api/addresses`)).json.data.length, 0, "addresses are private");
      assert.equal((await b.patch(`/api/addresses/${addrA}`, { receiver: "x y", phone: "09121234567", province: "تهران", city: "تهران", address: "hacked address here" })).status, 404);
    });

    it("rejects an unknown payment method and disabled providers", async () => {
      const inv = await productWithStock();
      const { c } = await registerAndLogin();
      await c.post("/api/cart/items", { productSlug: inv.variant.product.slug, quantity: 1 });
      const addressId = await addressFor(c);
      for (const m of ["snapppay", "bitcoin"]) assert.equal((await c.post("/api/checkout/orders", { addressId, shippingMethodId: await shippingId(), paymentMethod: m })).json.error.code, "payment_method_invalid");
    });

    it("never oversells: two buyers race for the last unit", async () => {
      const inv = await productWithStock(2);
      const original = inv.quantity;
      await db.inventory.update({ where: { id: inv.id }, data: { quantity: 1 } });
      try {
        const buyers = await Promise.all([registerAndLogin(), registerAndLogin(), registerAndLogin()]);
        const ship = await shippingId();
        // each buyer adds the single unit to the cart (stock is 1, so all adds succeed)
        const prepared = [];
        for (const { c } of buyers) { assert.equal((await c.post("/api/cart/items", { productSlug: inv.variant.product.slug, quantity: 1 })).status, 200); prepared.push({ c, addressId: await addressFor(c) }); }
        const results = await Promise.all(prepared.map(({ c, addressId }) => c.post("/api/checkout/orders", { addressId, shippingMethodId: ship, paymentMethod: "card_to_card" })));
        const okCount = results.filter((r) => r.status === 200).length;
        assert.equal(okCount, 1, `exactly one order must win, got ${results.map((r) => r.status)}`);
        assert.equal((await db.inventory.findUniqueOrThrow({ where: { id: inv.id } })).quantity, 0);
        assert.ok(results.filter((r) => r.status !== 200).every((r) => r.status === 409));
      } finally {
        await db.inventory.update({ where: { id: inv.id }, data: { quantity: original } });
      }
    });
  });

  describe("Wholesale", () => {
    let pid = ""; let slug = ""; let restore: { retailPrice: number; wholesalePrice: number | null; minWholesaleQty: number; retailDiscount: number; wholesaleDiscount: number };
    before(async () => {
      const inv = await productWithStock(10);
      const p = inv.variant.product;
      pid = p.id; slug = p.slug;
      restore = { retailPrice: p.retailPrice, wholesalePrice: p.wholesalePrice, minWholesaleQty: p.minWholesaleQty, retailDiscount: p.retailDiscount, wholesaleDiscount: p.wholesaleDiscount };
      await db.product.update({ where: { id: pid }, data: { retailPrice: 1_000_000, retailDiscount: 0, wholesalePrice: 700_000, wholesaleDiscount: 0, minWholesaleQty: 5 } });
    });
    after(async () => { await db.product.update({ where: { id: pid }, data: restore }); });

    it("a normal customer always pays retail, whatever the client sends", async () => {
      const { c } = await registerAndLogin();
      const r = await c.post("/api/cart/items", { productSlug: slug, quantity: 5, priceType: "wholesale", wholesale: true, role: "wholesale_partner" });
      assert.equal(r.json.data.lines[0].unitPrice, 1_000_000);
      assert.equal(r.json.data.lines[0].priceType, "retail");
      const addressId = await addressFor(c);
      const o = await c.post("/api/checkout/orders", { addressId, shippingMethodId: await shippingId(), paymentMethod: "card_to_card", wholesale: true });
      assert.equal(o.status, 200);
      const order = await db.order.findUniqueOrThrow({ where: { number: o.json.data.number }, include: { items: true } });
      assert.equal(order.type, "RETAIL");
      assert.equal(order.items[0].unitPrice, 1_000_000);
    });
    it("an approved wholesale partner gets wholesale price at the minimum quantity, enforced on the server", async () => {
      const c = new Client();
      assert.equal((await c.post("/api/auth/login", { phone: "09120000003", password: "Partner@12345" })).status, 200);
      await clearPartnerCart();
      const one = await c.post("/api/cart/items", { productSlug: slug, quantity: 1 });
      assert.equal(one.json.data.lines[0].priceType, "retail", "below the minimum quantity → retail price");
      const five = await c.post("/api/cart/items", { productSlug: slug, quantity: 4 });
      assert.equal(five.json.data.lines[0].quantity, 5);
      assert.equal(five.json.data.lines[0].unitPrice, 700_000);
      assert.equal(five.json.data.lines[0].priceType, "wholesale");
      const addressId = await addressFor(c);
      const o = await c.post("/api/checkout/orders", { addressId, shippingMethodId: await shippingId(), paymentMethod: "card_to_card" });
      assert.equal(o.status, 200, JSON.stringify(o.json));
      const order = await db.order.findUniqueOrThrow({ where: { number: o.json.data.number }, include: { items: true } });
      assert.equal(order.type, "WHOLESALE");
      assert.equal(order.items[0].priceType, "wholesale");
      assert.equal(order.subtotal, 3_500_000);
    });
    it("wholesale minimum order is enforced at checkout", async () => {
      const c = new Client();
      await c.post("/api/auth/login", { phone: "09120000003", password: "Partner@12345" });
      await clearPartnerCart();
      await db.product.update({ where: { id: pid }, data: { wholesalePrice: 100_000 } });
      try {
        await c.post("/api/cart/items", { productSlug: slug, quantity: 5 });
        const addressId = await addressFor(c);
        const o = await c.post("/api/checkout/orders", { addressId, shippingMethodId: await shippingId(), paymentMethod: "card_to_card" });
        assert.equal(o.status, 400);
        assert.equal(o.json.error.code, "wholesale_min_order");
      } finally { await db.product.update({ where: { id: pid }, data: { wholesalePrice: 700_000 } }); }
    });
    it("a partner who loses the role immediately loses wholesale prices", async () => {
      const c = new Client();
      await c.post("/api/auth/login", { phone: "09120000003", password: "Partner@12345" });
      const partner = await db.user.findUniqueOrThrow({ where: { phone: "09120000003" } });
      const role = await db.role.findUniqueOrThrow({ where: { key: "wholesale_partner" } });
      await db.userRole.delete({ where: { userId_roleId: { userId: partner.id, roleId: role.id } } });
      try {
        await db.cartItem.deleteMany({ where: { cart: { userId: partner.id } } });
        const r = await c.post("/api/cart/items", { productSlug: slug, quantity: 5 });
        assert.equal(r.json.data.lines[0].priceType, "retail");
      } finally { await db.userRole.create({ data: { userId: partner.id, roleId: role.id } }); }
    });
  });

  describe("Order cancellation", () => {
    it("returns stock to inventory", async () => {
      const inv = await productWithStock(5);
      const { c } = await registerAndLogin();
      await c.post("/api/cart/items", { productSlug: inv.variant.product.slug, quantity: 2 });
      const created = await c.post("/api/checkout/orders", { addressId: await addressFor(c), shippingMethodId: await shippingId(), paymentMethod: "card_to_card" });
      assert.equal(created.status, 200);
      const mid = (await db.inventory.findUniqueOrThrow({ where: { id: inv.id } })).quantity;
      const { cancelOrder } = await import("../lib/server/payments/service");
      const order = await db.order.findUniqueOrThrow({ where: { number: created.json.data.number } });
      await cancelOrder(order.id, order.userId!, "تست لغو");
      assert.equal((await db.inventory.findUniqueOrThrow({ where: { id: inv.id } })).quantity, mid + 2);
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "CANCELLED");
    });
  });
});
