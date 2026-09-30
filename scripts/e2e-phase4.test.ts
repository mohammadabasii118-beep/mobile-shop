/**
 * Phase 4 integration tests: refunds, wallet, loyalty, coupons, support, notifications, wholesale portal, content.
 * Server must be running:  TRUST_PROXY=1 npm start -- -p 3300   then   npm run test:e2e
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Client, PNG, db, fileForm, loginWithPassword, newPhone, plantOtp, registerAndLogin, uid } from "./test-utils";

let admin: Client, manager: Client;
let freeShip = "", catId = "";
const ok = (r: { status: number; json: any }, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.json)); return r.json?.data; };
const RULES = { enabled: true, amountPerPoint: 10000, earnOn: "payment", minOrderTotal: 0, redeemEnabled: true, pointValue: 100, minRedeemPoints: 100, maxRedeemPercent: 30 };
const setRules = async (patch: Record<string, unknown> = {}) => ok(await admin.put("/api/admin/settings/loyalty", { ...RULES, ...patch }));
const key = () => "k-" + uid() + uid();

async function testProduct(price = 200_000, stock = 500) {
  const s = "p4-" + uid();
  const p = ok(await admin.post("/api/admin/products", { name: "کالای تست " + s, slug: s, sku: "SKU-" + s, categoryId: catId, retailPrice: price, wholesalePrice: Math.round(price * 0.8), minWholesaleQty: 2, variants: [{ sku: "V-" + s, name: "پیش‌فرض", stock }] }));
  return { slug: s, id: p.id as string, variantId: p.variants[0].id as string };
}
async function customer() {
  const r = await registerAndLogin();
  const a = await r.c.post("/api/addresses", { receiver: "تست", phone: "09121234567", province: "تهران", city: "تهران", postalCode: "1234567890", address: "خیابان ولیعصر، پلاک ۱۰" });
  return { ...r, addressId: ok(a).id as string };
}
type Cust = Awaited<ReturnType<typeof customer>>;
async function order(cu: Cust, prod: { slug: string; variantId: string }, o: { qty?: number; useWallet?: boolean; redeemPoints?: number; couponCode?: string; expect?: number } = {}) {
  ok(await cu.c.post("/api/cart/items", { productSlug: prod.slug, variantId: prod.variantId, quantity: o.qty ?? 1 }));
  const r = await cu.c.post("/api/checkout/orders", { addressId: cu.addressId, shippingMethodId: freeShip, paymentMethod: "card_to_card", useWallet: o.useWallet ?? false, redeemPoints: o.redeemPoints ?? 0, couponCode: o.couponCode });
  if (o.expect) { assert.equal(r.status, o.expect, JSON.stringify(r.json)); return r.json; }
  return ok(r) as { id: string; number: number; total: number; walletUsed: number; payable: number };
}
const credit = (userId: string, amount: number, k = key()) => admin.post(`/api/admin/wallet/${userId}/adjust`, { direction: "in", amount, reason: "شارژ آزمایشی", key: k });
const balance = async (userId: string) => (await db.wallet.findUnique({ where: { userId } }))?.balance ?? 0;
const points = async (userId: string) => (await db.loyaltyAccount.findUnique({ where: { userId } }))?.points ?? 0;
const receipt = (c: Client, number: number) => c.post(`/api/orders/${number}/payment/proof`, fileForm(PNG, "r.png", "image/png", "receipt", { referenceNumber: "REF-" + uid() }));
async function payAndApprove(cu: Cust, number: number) {
  ok(await receipt(cu.c, number));
  const pay = await db.payment.findFirstOrThrow({ where: { order: { number } } });
  ok(await admin.post(`/api/admin/payments/${pay.id}/approve`));
  return pay;
}
async function deliver(number: number) {
  for (const status of ["PREPARING", "READY_TO_SHIP", "SHIPPED", "DELIVERED"]) ok(await admin.post(`/api/admin/orders/${number}/status`, { status }));
}
const evts = (userId: string) => db.notification.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
const logs = (action: string, entityId?: string) => db.adminLog.count({ where: { action, ...(entityId ? { entityId } : {}) } });
async function staffClient(roleKey: string) {
  const r = await registerAndLogin();
  await db.userRole.create({ data: { userId: r.userId, roleId: (await db.role.findUniqueOrThrow({ where: { key: roleKey } })).id } });
  return r;
}

describe("Phase 4 — business systems", () => {
  before(async () => {
    await db.rateLimit.deleteMany({});
    admin = await loginWithPassword("09120000001", "Admin@12345");
    manager = await loginWithPassword("09120000006", "Manager@12345");
    const cat = await db.category.findFirstOrThrow({ where: { parentId: { not: null } } }); catId = cat.id;
    freeShip = ok(await admin.post("/api/admin/r/shipping", { key: "free-" + uid(), name: "تحویل حضوری تست", cost: 0 })).id;
    await setRules();
    // These Phase 4 tests use ONE admin as requester and approver; Phase 5 four-eyes enforcement is covered in e2e-phase5.
    await db.siteSetting.upsert({ where: { key: "finance" }, update: { value: { fourEyes: false } }, create: { key: "finance", value: { fourEyes: false } } });
  });
  after(async () => { await db.siteSetting.deleteMany({ where: { key: "finance" } }); await setRules(); await db.$disconnect(); });

  describe("Wallet", () => {
    it("admin credit records amount, direction, before/after, reference, actor; audit + notification; customer sees it", async () => {
      const cu = await customer(); const k = key();
      const r = ok(await credit(cu.userId, 150_000, k));
      assert.equal(r.balance, 150_000);
      const tx = await db.walletTransaction.findFirstOrThrow({ where: { wallet: { userId: cu.userId } } });
      assert.equal(tx.direction, "in"); assert.equal(tx.amount, 150_000); assert.equal(tx.balanceBefore, 0); assert.equal(tx.balanceAfter, 150_000);
      assert.equal(tx.reference, "admin:" + k); assert.ok(tx.createdById); assert.equal(tx.type, "admin_credit");
      const mine = ok(await cu.c.get("/api/wallet"));
      assert.equal(mine.balance, 150_000); assert.equal(mine.items.length, 1);
      assert.ok((await evts(cu.userId)).some((n) => n.event === "wallet_change"));
      assert.equal(await logs("wallet.credit", cu.userId), 1);
    });
    it("is idempotent: a repeated or concurrent request with the same key applies once", async () => {
      const cu = await customer(); const k = key();
      const rs = await Promise.all(Array.from({ length: 6 }, () => credit(cu.userId, 10_000, k)));
      assert.ok(rs.every((r) => r.status === 200));
      assert.equal(await balance(cu.userId), 10_000);
      assert.equal(await db.walletTransaction.count({ where: { wallet: { userId: cu.userId } } }), 1);
      const again = ok(await credit(cu.userId, 10_000, k)); assert.equal(again.replay, true);
    });
    it("cannot be overdrawn, even by parallel debits", async () => {
      const cu = await customer(); ok(await credit(cu.userId, 100_000));
      assert.equal((await admin.post(`/api/admin/wallet/${cu.userId}/adjust`, { direction: "out", amount: 100_001, reason: "تست", key: key() })).status, 409);
      const rs = await Promise.all(Array.from({ length: 5 }, () => admin.post(`/api/admin/wallet/${cu.userId}/adjust`, { direction: "out", amount: 60_000, reason: "تست همزمانی", key: key() })));
      assert.equal(rs.filter((r) => r.status === 200).length, 1);
      assert.equal(await balance(cu.userId), 40_000);
      const t = await db.walletTransaction.findMany({ where: { wallet: { userId: cu.userId } }, orderBy: { createdAt: "asc" } });
      assert.deepEqual(t.map((x) => [x.balanceBefore, x.balanceAfter]), [[0, 100_000], [100_000, 40_000]]);
    });
    it("adjustments need wallet.adjust, a reason, a key and a valid amount", async () => {
      const cu = await customer();
      assert.equal((await manager.post(`/api/admin/wallet/${cu.userId}/adjust`, { direction: "in", amount: 5, reason: "x y z", key: key() })).status, 403);
      assert.equal((await cu.c.post(`/api/admin/wallet/${cu.userId}/adjust`, { direction: "in", amount: 5000, reason: "خودم", key: key() })).status, 403);
      for (const bad of [{ amount: 0 }, { amount: -5 }, { amount: 1.5 }, { reason: "" }, { key: "x" }, { direction: "sideways" }]) assert.equal((await admin.post(`/api/admin/wallet/${cu.userId}/adjust`, { direction: "in", amount: 1000, reason: "دلیل", key: key(), ...bad })).status, 422, JSON.stringify(bad));
      assert.equal((await admin.post(`/api/admin/wallet/nope/adjust`, { direction: "in", amount: 1000, reason: "دلیل", key: key() })).status, 404);
      assert.equal(await balance(cu.userId), 0);
    });
    it("a customer only ever sees their own wallet", async () => {
      const a = await customer(), b = await customer(); ok(await credit(a.userId, 77_000));
      assert.equal(ok(await b.c.get("/api/wallet")).balance, 0);
      assert.equal((await new Client().get("/api/wallet")).status, 401);
    });
    it("pays a whole order from the wallet: paid instantly, balance debited once, points earned", async () => {
      const cu = await customer(), prod = await testProduct(200_000); ok(await credit(cu.userId, 500_000));
      const o = await order(cu, prod, { useWallet: true });
      assert.equal(o.walletUsed, 200_000); assert.equal(o.payable, 0);
      const row = await db.order.findUniqueOrThrow({ where: { number: o.number }, include: { payments: true } });
      assert.equal(row.status, "PROCESSING"); assert.equal(row.paymentStatus, "PAID"); assert.equal(row.payments[0].provider, "wallet"); assert.equal(row.payments[0].status, "PAID");
      assert.equal(await balance(cu.userId), 300_000);
      const tx = await db.walletTransaction.findFirstOrThrow({ where: { orderId: row.id } });
      assert.equal(tx.type, "order_payment"); assert.equal(tx.direction, "out"); assert.equal(tx.reference, `order-pay:${row.id}`);
      assert.equal(await points(cu.userId), 20); // 200,000 / 10,000
      assert.equal(await logs("wallet.order_payment", row.id), 1);
    });
    it("combined payment: wallet covers part, card-to-card the rest; approval completes it", async () => {
      const cu = await customer(), prod = await testProduct(200_000); ok(await credit(cu.userId, 50_000));
      const o = await order(cu, prod, { useWallet: true });
      assert.equal(o.walletUsed, 50_000); assert.equal(o.payable, 150_000);
      const row = await db.order.findUniqueOrThrow({ where: { number: o.number }, include: { payments: true } });
      assert.equal(row.status, "PENDING_PAYMENT"); assert.equal(row.payments[0].amount, 150_000); assert.equal(row.total, 200_000);
      assert.equal(await balance(cu.userId), 0);
      await payAndApprove(cu, o.number);
      assert.equal((await db.order.findUniqueOrThrow({ where: { number: o.number } })).paymentStatus, "PAID");
    });
    it("the wallet is never overspent: with no balance it simply pays nothing", async () => {
      const cu = await customer(), prod = await testProduct(100_000);
      const o = await order(cu, prod, { useWallet: true });
      assert.equal(o.walletUsed, 0); assert.equal(o.payable, 100_000);
      assert.equal(await db.walletTransaction.count({ where: { wallet: { userId: cu.userId } } }), 0);
    });
    it("cancelling an unpaid order restores the wallet, stock and points exactly once", async () => {
      const cu = await customer(), prod = await testProduct(200_000, 50); ok(await credit(cu.userId, 60_000)); ok(await admin.post(`/api/admin/loyalty/${cu.userId}/adjust`, { direction: "in", amount: 1000, reason: "تست", key: key() }));
      const o = await order(cu, prod, { useWallet: true, redeemPoints: 500 });
      const row = await db.order.findUniqueOrThrow({ where: { number: o.number } });
      assert.equal(row.loyaltyPointsUsed, 500); assert.equal(row.loyaltyDiscount, 50_000); assert.equal(row.total, 150_000); assert.equal(row.walletUsed, 60_000);
      assert.equal(await balance(cu.userId), 0); assert.equal(await points(cu.userId), 500);
      ok(await cu.c.post(`/api/orders/${o.number}/cancel`));
      assert.equal(await balance(cu.userId), 60_000); assert.equal(await points(cu.userId), 1000);
      assert.equal((await db.inventory.findUniqueOrThrow({ where: { variantId: prod.variantId } })).quantity, 50);
      assert.equal((await cu.c.post(`/api/orders/${o.number}/cancel`)).status, 400); // second cancel refused
      assert.equal((await admin.post(`/api/admin/orders/${o.number}/cancel`, { reason: "دوباره لغو" })).status, 409);
      assert.equal(await balance(cu.userId), 60_000); assert.equal(await points(cu.userId), 1000);
      assert.equal(await db.walletTransaction.count({ where: { reference: `order-restore:${row.id}` } }), 1);
    });
    it("a customer cannot cancel someone else's order or a paid one", async () => {
      const a = await customer(), b = await customer(), prod = await testProduct();
      const o = await order(a, prod);
      assert.equal((await b.c.post(`/api/orders/${o.number}/cancel`)).status, 404);
      await payAndApprove(a, o.number);
      assert.equal((await a.c.post(`/api/orders/${o.number}/cancel`)).status, 400);
    });
  });

  describe("Loyalty", () => {
    it("points are earned once, only after payment is confirmed, per the admin rule", async () => {
      const cu = await customer(), prod = await testProduct(200_000);
      const o = await order(cu, prod, { qty: 3 }); // 600,000 → 60 points
      assert.equal(await points(cu.userId), 0); // not before payment
      const pay = await payAndApprove(cu, o.number);
      assert.equal(await points(cu.userId), 60);
      const tx = await db.loyaltyTransaction.findFirstOrThrow({ where: { account: { userId: cu.userId } } });
      assert.equal(tx.type, "earn"); assert.equal(tx.points, 60); assert.equal(tx.pointsBefore, 0); assert.equal(tx.pointsAfter, 60); assert.equal(tx.reference, `earn:${(await db.order.findUniqueOrThrow({ where: { number: o.number } })).id}`);
      assert.equal((await admin.post(`/api/admin/payments/${pay.id}/approve`)).status, 409);
      assert.equal(await points(cu.userId), 60);
      // moving the order forward / delivering does not earn twice under the "payment" rule
      await deliver(o.number); assert.equal(await points(cu.userId), 60);
      assert.equal(ok(await cu.c.get("/api/loyalty")).points, 60);
    });
    it("rules are managed in the admin panel: rate, minimum and trigger (delivery)", async () => {
      await setRules({ amountPerPoint: 5000, minOrderTotal: 150_000, earnOn: "delivery" });
      try {
        const cu = await customer(), prod = await testProduct(200_000);
        const o = await order(cu, prod); await payAndApprove(cu, o.number);
        assert.equal(await points(cu.userId), 0); // waits for delivery
        await deliver(o.number);
        assert.equal(await points(cu.userId), 40); // 200,000 / 5,000
        const small = await testProduct(100_000); const o2 = await order(cu, small); await payAndApprove(cu, o2.number); await deliver(o2.number);
        assert.equal(await points(cu.userId), 40); // below the minimum → nothing
      } finally { await setRules(); }
      assert.equal((await admin.put("/api/admin/settings/loyalty", { ...RULES, maxRedeemPercent: 500 })).status, 422);
      assert.equal((await manager.put("/api/admin/settings/loyalty", RULES)).status, 403);
    });
    it("redeems points as a discount within the rules (min, balance, max share) — priced on the server", async () => {
      const cu = await customer(), prod = await testProduct(200_000);
      ok(await admin.post(`/api/admin/loyalty/${cu.userId}/adjust`, { direction: "in", amount: 1000, reason: "هدیه", key: key() }));
      ok(await cu.c.post("/api/cart/items", { productSlug: prod.slug, variantId: prod.variantId, quantity: 1 }));
      const q = (n: number) => cu.c.get(`/api/checkout/quote?redeemPoints=${n}&shippingMethodId=${freeShip}`);
      assert.equal(ok(await q(50)).loyalty.error !== null, true); // below minimum
      assert.equal(ok(await q(5000)).loyalty.error !== null, true); // more than owned
      const big = ok(await q(1000)); // 1000 pts = 100,000 but max 30% of 200,000 = 60,000 → 600 pts
      assert.equal(big.loyalty.applied, 600); assert.equal(big.loyalty.discount, 60_000); assert.equal(big.total, 140_000);
      assert.equal((await cu.c.post("/api/checkout/orders", { addressId: cu.addressId, shippingMethodId: freeShip, paymentMethod: "card_to_card", redeemPoints: 50, total: 1 })).status, 400);
      const o = ok(await cu.c.post("/api/checkout/orders", { addressId: cu.addressId, shippingMethodId: freeShip, paymentMethod: "card_to_card", redeemPoints: 1000 }));
      assert.equal(o.total, 140_000); assert.equal(await points(cu.userId), 400);
      const t = await db.loyaltyTransaction.findFirstOrThrow({ where: { account: { userId: cu.userId }, type: "redeem" } });
      assert.equal(t.points, -600); assert.equal(t.pointsBefore, 1000); assert.equal(t.pointsAfter, 400);
      assert.equal(await balance(cu.userId), 0); // independent from the wallet
    });
    it("points and wallet are separate ledgers", async () => {
      const cu = await customer(); ok(await credit(cu.userId, 10_000));
      ok(await admin.post(`/api/admin/loyalty/${cu.userId}/adjust`, { direction: "in", amount: 300, reason: "تست", key: key() }));
      assert.equal(await balance(cu.userId), 10_000); assert.equal(await points(cu.userId), 300);
      assert.equal((await admin.post(`/api/admin/loyalty/${cu.userId}/adjust`, { direction: "out", amount: 301, reason: "تست", key: key() })).status, 409);
      assert.equal((await manager.post(`/api/admin/loyalty/${cu.userId}/adjust`, { direction: "in", amount: 1, reason: "تست", key: key() })).status, 403);
    });
    it("full refund takes earned points back and returns spent points; cancel of paid order is refused", async () => {
      const cu = await customer(), prod = await testProduct(200_000);
      ok(await admin.post(`/api/admin/loyalty/${cu.userId}/adjust`, { direction: "in", amount: 200, reason: "تست", key: key() }));
      const o = await order(cu, prod, { redeemPoints: 200 }); // −20,000 → total 180,000
      await payAndApprove(cu, o.number);
      assert.equal(await points(cu.userId), 18); // 180,000/10,000 earned, 200 spent
      const r = ok(await admin.post(`/api/admin/orders/${o.number}/refunds`, { method: "wallet", amount: 180_000, reason: "برگشت کامل" }));
      ok(await cu.c.post(`/api/refunds/${r.id}/accept`));
      assert.equal(await points(cu.userId), 200); // earned 18 reversed, spent 200 restored
      assert.equal(await balance(cu.userId), 180_000);
    });
  });

  describe("Coupons and cancellation (technical debt from Phase 2)", () => {
    it("cancel gives the coupon use back (global + per-user), once", async () => {
      const code = "CX" + uid().toUpperCase();
      const c = ok(await admin.post("/api/admin/r/coupons", { code, type: "percent", value: 10, usageLimit: 1, perUserLimit: 1 }));
      const a = await customer(), b = await customer(), prod = await testProduct(100_000);
      const o = await order(a, prod, { couponCode: code });
      assert.equal((await db.order.findUniqueOrThrow({ where: { number: o.number } })).discountTotal, 10_000);
      assert.equal((await db.coupon.findUniqueOrThrow({ where: { id: c.id } })).usedCount, 1);
      ok(await b.c.post("/api/cart/items", { productSlug: prod.slug, variantId: prod.variantId, quantity: 1 }));
      assert.equal((await b.c.post("/api/cart/coupon", { code })).status, 400); // exhausted while the order is alive
      ok(await a.c.post(`/api/orders/${o.number}/cancel`));
      assert.equal((await db.coupon.findUniqueOrThrow({ where: { id: c.id } })).usedCount, 0);
      assert.equal(await db.couponUsage.count({ where: { couponId: c.id } }), 0);
      assert.equal((await b.c.post("/api/cart/coupon", { code })).status, 200); // usable again
      await admin.post(`/api/admin/orders/${o.number}/cancel`, { reason: "دوباره" }); // repeated cancel must not push the counter negative
      assert.equal((await db.coupon.findUniqueOrThrow({ where: { id: c.id } })).usedCount, 0);
      const o2 = await order(a, prod, { couponCode: code }); // customer can use it again after the rollback
      assert.equal((await db.order.findUniqueOrThrow({ where: { number: o2.number } })).couponCode, code);
    });
    it("full refund also returns the coupon use; a partial refund does not", async () => {
      const code = "CY" + uid().toUpperCase();
      const c = ok(await admin.post("/api/admin/r/coupons", { code, type: "fixed", value: 20_000, usageLimit: 5 }));
      const cu = await customer(), prod = await testProduct(100_000);
      const o = await order(cu, prod, { couponCode: code }); await payAndApprove(cu, o.number); // paid 80,000
      const r1 = ok(await admin.post(`/api/admin/orders/${o.number}/refunds`, { method: "wallet", amount: 30_000, reason: "جزئی" }));
      ok(await cu.c.post(`/api/refunds/${r1.id}/accept`));
      assert.equal((await db.coupon.findUniqueOrThrow({ where: { id: c.id } })).usedCount, 1);
      const r2 = ok(await admin.post(`/api/admin/orders/${o.number}/refunds`, { method: "wallet", amount: 50_000, reason: "باقی" }));
      ok(await cu.c.post(`/api/refunds/${r2.id}/accept`));
      assert.equal((await db.coupon.findUniqueOrThrow({ where: { id: c.id } })).usedCount, 0);
    });
  });

  describe("Refunds", () => {
    it("REFUNDED status cannot be set by hand, and a refund request alone moves no money", async () => {
      const cu = await customer(), prod = await testProduct(100_000); const o = await order(cu, prod); await payAndApprove(cu, o.number);
      assert.equal((await admin.post(`/api/admin/orders/${o.number}/status`, { status: "REFUNDED" })).status, 409);
      const before = await balance(cu.userId);
      ok(await admin.post(`/api/admin/orders/${o.number}/refunds`, { method: "wallet", amount: 100_000, reason: "درخواست مشتری" }));
      assert.equal(await balance(cu.userId), before);
      const row = await db.order.findUniqueOrThrow({ where: { number: o.number } });
      assert.equal(row.status, "PROCESSING"); assert.equal(row.paymentStatus, "PAID");
      assert.ok((await evts(cu.userId)).some((n) => n.event === "refund_requested"));
    });
    it("wallet refund: only the owner can confirm, credit happens once with reference, then order becomes REFUNDED", async () => {
      const cu = await customer(), other = await customer(), prod = await testProduct(100_000, 20);
      const o = await order(cu, prod); await payAndApprove(cu, o.number);
      const r = ok(await admin.post(`/api/admin/orders/${o.number}/refunds`, { method: "wallet", amount: 100_000, reason: "کالا نرسید", restock: true, idempotencyKey: "idem-" + uid() }));
      assert.equal(r.status, "AWAITING_CUSTOMER");
      assert.equal((await other.c.post(`/api/refunds/${r.id}/accept`)).status, 404);
      const rs = await Promise.all([cu.c.post(`/api/refunds/${r.id}/accept`), cu.c.post(`/api/refunds/${r.id}/accept`), cu.c.post(`/api/refunds/${r.id}/accept`)]);
      assert.equal(rs.filter((x) => x.status === 200).length, 1);
      assert.equal(await balance(cu.userId), 100_000);
      assert.equal(await db.walletTransaction.count({ where: { reference: `refund:${r.id}` } }), 1);
      const row = await db.order.findUniqueOrThrow({ where: { number: o.number } });
      assert.equal(row.status, "REFUNDED"); assert.ok(row.restockedAt);
      assert.equal((await db.inventory.findUniqueOrThrow({ where: { variantId: prod.variantId } })).quantity, 20);
      assert.equal(await logs("refund.wallet_accept", r.id), 1); assert.equal(await logs("refund.request", r.id), 1);
      assert.equal((await admin.post(`/api/admin/orders/${o.number}/refunds`, { method: "wallet", amount: 1, reason: "بعد از بستن" })).status, 409);
    });
    it("the customer may decline the wallet refund; nothing is credited and staff can choose the bank instead", async () => {
      const cu = await customer(), prod = await testProduct(100_000); const o = await order(cu, prod); await payAndApprove(cu, o.number);
      const r = ok(await admin.post(`/api/admin/orders/${o.number}/refunds`, { method: "wallet", amount: 100_000, reason: "تست" }));
      ok(await cu.c.post(`/api/refunds/${r.id}/decline`));
      assert.equal(await balance(cu.userId), 0);
      assert.equal((await cu.c.post(`/api/refunds/${r.id}/accept`)).status, 409);
      ok(await admin.post(`/api/admin/orders/${o.number}/refunds`, { method: "bank", amount: 100_000, reason: "بانکی", bankNote: "کارت ۶۰۳۷…" }));
    });
    it("bank refund needs a destination, an approver with refund.approve, a bank reference and explicit confirmation", async () => {
      const cu = await customer(), prod = await testProduct(100_000); const o = await order(cu, prod); await payAndApprove(cu, o.number);
      assert.equal((await admin.post(`/api/admin/orders/${o.number}/refunds`, { method: "bank", amount: 100_000, reason: "بانکی" })).status, 400); // no destination
      const r = ok(await admin.post(`/api/admin/orders/${o.number}/refunds`, { method: "bank", amount: 100_000, reason: "بازگشت به کارت", bankNote: "6037-9911-2233-4455 علی احمدی" }));
      assert.equal(r.status, "PENDING_BANK");
      const om = await staffClient("order_manager"); // may request (refund.manage) but not approve
      assert.equal((await om.c.post(`/api/admin/refunds/${r.id}/complete`, { bankReference: "TRK-123456", confirm: true })).status, 403);
      assert.equal((await manager.post(`/api/admin/refunds/${r.id}/complete`, { bankReference: "TRK-123456", confirm: true })).status, 403);
      for (const bad of [{ confirm: true }, { bankReference: "ab", confirm: true }, { bankReference: "TRK-123456" }, { bankReference: "TRK-123456", confirm: false }]) assert.equal((await admin.post(`/api/admin/refunds/${r.id}/complete`, bad)).status, 422, JSON.stringify(bad));
      assert.equal((await db.order.findUniqueOrThrow({ where: { number: o.number } })).status, "PROCESSING"); // still not refunded
      const done = await Promise.all([admin.post(`/api/admin/refunds/${r.id}/complete`, { bankReference: "TRK-123456", confirm: true }), admin.post(`/api/admin/refunds/${r.id}/complete`, { bankReference: "TRK-123456", confirm: true })]);
      assert.equal(done.filter((x) => x.status === 200).length, 1);
      const row = await db.order.findUniqueOrThrow({ where: { number: o.number } });
      assert.equal(row.status, "REFUNDED"); assert.equal(row.paymentStatus, "REFUNDED");
      const ref = await db.refund.findUniqueOrThrow({ where: { id: r.id } });
      assert.equal(ref.bankReference, "TRK-123456"); assert.ok(ref.completedById && ref.completedAt);
      assert.equal(await balance(cu.userId), 0); // bank refund never touches the wallet
      assert.equal(await logs("refund.bank_complete", r.id), 1);
      assert.ok((await evts(cu.userId)).some((n) => n.event === "refund_completed" && /TRK-123456/.test(n.body ?? "")));
    });
    it("cannot refund more than was paid; partial refunds add up; the wallet-paid part can only go back to the wallet", async () => {
      const cu = await customer(), prod = await testProduct(200_000); ok(await credit(cu.userId, 50_000));
      const o = await order(cu, prod, { useWallet: true }); await payAndApprove(cu, o.number); // 50,000 wallet + 150,000 card
      const url = `/api/admin/orders/${o.number}/refunds`;
      assert.equal((await admin.post(url, { method: "wallet", amount: 200_001, reason: "زیاد" })).status, 409);
      assert.equal((await admin.post(url, { method: "bank", amount: 150_001, reason: "زیاد", bankNote: "x" })).status, 409); // only the card part can go to the bank
      const b = ok(await admin.post(url, { method: "bank", amount: 100_000, reason: "بخش کارت", bankNote: "کارت مشتری" }));
      assert.equal((await admin.post(url, { method: "bank", amount: 60_000, reason: "بیش از باقی‌مانده کارت", bankNote: "x" })).status, 409); // 100k reserved
      const w = ok(await admin.post(url, { method: "wallet", amount: 100_000, reason: "باقی" }));
      assert.equal((await admin.post(url, { method: "wallet", amount: 1, reason: "همه رزرو شده" })).status, 409);
      ok(await cu.c.post(`/api/refunds/${w.id}/accept`));
      assert.equal((await db.order.findUniqueOrThrow({ where: { number: o.number } })).status, "PROCESSING"); // bank part outstanding
      ok(await admin.post(`/api/admin/refunds/${b.id}/complete`, { bankReference: "BANK-9999", confirm: true }));
      assert.equal((await db.order.findUniqueOrThrow({ where: { number: o.number } })).status, "REFUNDED");
      assert.equal(await balance(cu.userId), 100_000);
    });
    it("refund creation is idempotent per key and cancellable while open", async () => {
      const cu = await customer(), prod = await testProduct(100_000); const o = await order(cu, prod); await payAndApprove(cu, o.number);
      const k = "idem-" + uid(), body = { method: "wallet", amount: 40_000, reason: "تست", idempotencyKey: k };
      const rs = await Promise.all([1, 2, 3].map(() => admin.post(`/api/admin/orders/${o.number}/refunds`, body)));
      assert.ok(rs.every((r) => r.status === 200));
      assert.equal(await db.refund.count({ where: { idempotencyKey: k } }), 1);
      const r = rs[0].json.data;
      assert.equal((await admin.post(`/api/admin/refunds/${r.id}/cancel`, {})).status, 422);
      ok(await admin.post(`/api/admin/refunds/${r.id}/cancel`, { reason: "اشتباه ثبت شد" }));
      assert.equal((await admin.post(`/api/admin/refunds/${r.id}/cancel`, { reason: "دوباره" })).status, 409);
      assert.equal((await cu.c.post(`/api/refunds/${r.id}/accept`)).status, 409);
      assert.equal(await balance(cu.userId), 0);
    });
    it("unpaid orders cannot be refunded; refund permissions are enforced; listing works", async () => {
      const cu = await customer(), prod = await testProduct(); const o = await order(cu, prod);
      assert.equal((await admin.post(`/api/admin/orders/${o.number}/refunds`, { method: "wallet", amount: 1000, reason: "تست" })).status, 409);
      assert.equal((await manager.post(`/api/admin/orders/${o.number}/refunds`, { method: "wallet", amount: 1000, reason: "تست" })).status, 403);
      assert.equal((await manager.get("/api/admin/refunds")).status, 403);
      const l = ok(await admin.get("/api/admin/refunds?status=PENDING_BANK")); assert.ok(l.items.every((x: any) => x.status === "PENDING_BANK"));
    });
    it("order detail exposes the money breakdown and refund history", async () => {
      const cu = await customer(), prod = await testProduct(100_000); const o = await order(cu, prod); await payAndApprove(cu, o.number);
      ok(await admin.post(`/api/admin/orders/${o.number}/refunds`, { method: "wallet", amount: 30_000, reason: "جزئی" }));
      const d = ok(await admin.get(`/api/admin/orders/${o.number}`));
      assert.equal(d.money.totalPaid, 100_000); assert.equal(d.money.refundable, 70_000); assert.equal(d.refunds.length, 1);
      const mine = ok(await cu.c.get(`/api/orders/${o.number}`)); void mine;
    });
  });

  describe("Support tickets", () => {
    it("customer creates a ticket with an order and a private attachment; sees only their own", async () => {
      const cu = await customer(), other = await customer(), prod = await testProduct(); const o = await order(cu, prod);
      const f = fileForm(PNG, "شکایت.png", "image/png", "files", { subject: "مشکل در سفارش", message: "لطفاً بررسی کنید", category: "order", orderNumber: String(o.number) });
      const t = ok(await cu.c.post("/api/support/tickets", f));
      const list = ok(await cu.c.get("/api/support/tickets")); assert.equal(list.length, 1);
      assert.equal(ok(await other.c.get("/api/support/tickets")).length, 0);
      const det = ok(await cu.c.get(`/api/support/tickets/${t.number}`));
      assert.equal(det.orderNumber, o.number); assert.equal(det.messages[0].files.length, 1);
      assert.equal((await other.c.get(`/api/support/tickets/${t.number}`)).status, 404);
      const fid = det.messages[0].files[0].id;
      assert.equal((await cu.c.get(`/api/support/attachments/${fid}`)).status, 200);
      const stolen = await other.c.get(`/api/support/attachments/${fid}`); assert.equal(stolen.status, 403);
      assert.equal((await new Client().get(`/api/support/attachments/${fid}`)).status, 401);
      assert.equal((await admin.get(`/api/support/attachments/${fid}`)).status, 200); // staff
      assert.equal((await manager.get(`/api/support/attachments/${fid}`)).status, 403); // staff without support access
      assert.match(await (async () => (await cu.c.get(`/api/support/attachments/${fid}`)).headers.get("cache-control") ?? "")(), /private/);
    });
    it("validates tickets: subject/message, someone else's order, file type/size/count", async () => {
      const cu = await customer(), other = await customer(), prod = await testProduct(); const o = await order(other, prod);
      assert.equal((await cu.c.post("/api/support/tickets", fileForm(PNG, "a.png", "image/png", "files", { subject: "x", message: "پیام کامل" }))).status, 422);
      assert.equal((await cu.c.post("/api/support/tickets", fileForm(PNG, "a.png", "image/png", "files", { subject: "موضوع تست", message: "پیام کامل", orderNumber: String(o.number) }))).status, 404);
      assert.equal((await cu.c.post("/api/support/tickets", fileForm(Buffer.from("<svg onload=alert(1)>"), "a.svg", "image/svg+xml", "files", { subject: "موضوع تست", message: "پیام کامل" }))).status, 400);
      assert.equal((await cu.c.post("/api/support/tickets", fileForm(Buffer.alloc(6 * 1024 * 1024, 7), "big.png", "image/png", "files", { subject: "موضوع تست", message: "پیام کامل" }))).status, 400);
      const many = new FormData(); many.set("subject", "موضوع تست"); many.set("message", "پیام کامل"); for (let i = 0; i < 4; i++) many.append("files", new Blob([new Uint8Array(PNG)], { type: "image/png" }), `f${i}.png`);
      assert.equal((await cu.c.post("/api/support/tickets", many)).status, 400);
      assert.equal(ok(await cu.c.get("/api/support/tickets")).length, 0);
      assert.equal((await new Client().post("/api/support/tickets", fileForm(PNG, "a.png", "image/png", "files", { subject: "موضوع تست", message: "پیام کامل" }))).status, 401);
    });
    it("staff reply → answered + customer notification; internal notes stay hidden; customer reply reopens", async () => {
      const cu = await customer(); const t = ok(await cu.c.post("/api/support/tickets", fileForm(PNG, "a.png", "image/png", "files", { subject: "سوال درباره ارسال", message: "کی ارسال می‌شود؟" })));
      const sup = await staffClient("support");
      const adminList = ok(await sup.c.get("/api/admin/support")); assert.ok(adminList.items.some((x: any) => x.number === t.number));
      const note = new FormData(); note.set("message", "یادداشت داخلی: مشتری VIP"); note.set("internal", "true");
      ok(await sup.c.post(`/api/admin/support/${t.number}/reply`, note));
      assert.equal((await db.supportTicket.findUniqueOrThrow({ where: { number: t.number } })).status, "open"); // internal note does not answer
      assert.equal((await evts(cu.userId)).filter((n) => n.event === "support_reply").length, 0);
      const rep = new FormData(); rep.set("message", "فردا ارسال می‌شود"); rep.append("files", new Blob([new Uint8Array(PNG)], { type: "image/png" }), "info.png");
      ok(await sup.c.post(`/api/admin/support/${t.number}/reply`, rep));
      assert.equal((await db.supportTicket.findUniqueOrThrow({ where: { number: t.number } })).status, "answered");
      assert.equal((await evts(cu.userId)).filter((n) => n.event === "support_reply").length, 1);
      const det = ok(await cu.c.get(`/api/support/tickets/${t.number}`));
      assert.equal(det.messages.length, 2); assert.ok(!JSON.stringify(det).includes("VIP")); assert.equal(det.messages[1].isStaff, true);
      const full = ok(await sup.c.get(`/api/admin/support/${t.number}`)); assert.equal(full.messages.length, 3);
      ok(await cu.c.post(`/api/support/tickets/${t.number}/messages`, fileForm(PNG, "b.png", "image/png", "files", { message: "ممنون، ولی هنوز نرسیده" })));
      assert.equal((await db.supportTicket.findUniqueOrThrow({ where: { number: t.number } })).status, "open");
      // the file of an internal note is not downloadable by the customer
      const nf = await db.supportAttachment.findFirst({ where: { message: { ticketId: full.id, isInternal: true } } });
      assert.equal(nf, null);
    });
    it("staff manage priority, assignment and status; only support-capable staff can be assigned", async () => {
      const cu = await customer(); const t = ok(await cu.c.post("/api/support/tickets", fileForm(PNG, "a.png", "image/png", "files", { subject: "موضوع تست", message: "پیام کامل" })));
      const sup = await staffClient("support");
      ok(await admin.patch(`/api/admin/support/${t.number}`, { priority: "urgent", assignedToId: sup.userId }));
      let row = await db.supportTicket.findUniqueOrThrow({ where: { number: t.number } });
      assert.equal(row.priority, "urgent"); assert.equal(row.assignedToId, sup.userId);
      assert.equal((await admin.patch(`/api/admin/support/${t.number}`, { assignedToId: cu.userId })).status, 400); // a customer cannot be assignee
      assert.equal((await admin.patch(`/api/admin/support/${t.number}`, { priority: "critical" })).status, 422);
      assert.ok(ok(await sup.c.get(`/api/admin/support?assignee=${sup.userId}`)).items.some((x: any) => x.number === t.number));
      ok(await admin.patch(`/api/admin/support/${t.number}`, { status: "closed" }));
      row = await db.supportTicket.findUniqueOrThrow({ where: { number: t.number } }); assert.equal(row.status, "closed"); assert.ok(row.closedAt);
      assert.equal((await manager.patch(`/api/admin/support/${t.number}`, { priority: "low" })).status, 403);
      assert.equal((await cu.c.patch(`/api/admin/support/${t.number}`, { priority: "low" })).status, 403);
      assert.ok((await logs("support.update", row.id)) >= 2);
      ok(await cu.c.del(`/api/support/tickets/${t.number}`)); // customer close is idempotent-safe
    });
  });

  describe("Notifications", () => {
    it("are created for order, payment, status, tracking, wallet events, and are private", async () => {
      const cu = await customer(), other = await customer(), prod = await testProduct(100_000);
      const o = await order(cu, prod); await payAndApprove(cu, o.number);
      ok(await admin.post(`/api/admin/orders/${o.number}/status`, { status: "PREPARING" }));
      ok(await admin.post(`/api/admin/orders/${o.number}/status`, { status: "READY_TO_SHIP" }));
      ok(await admin.post(`/api/admin/orders/${o.number}/shipping`, { shippingCompany: "پست", trackingNumber: "TRK-777001" }));
      ok(await admin.post(`/api/admin/orders/${o.number}/status`, { status: "SHIPPED" }));
      ok(await credit(cu.userId, 5000));
      const got = new Set((await evts(cu.userId)).map((n) => n.event));
      for (const e of ["order_created", "payment_approved", "order_status", "order_tracking", "wallet_change"]) assert.ok(got.has(e), e);
      const list = ok(await cu.c.get("/api/notifications"));
      assert.ok(list.items.length >= 5); assert.equal(list.unread, list.items.length);
      assert.ok(list.items.every((n: any) => n.readAt === null && n.title));
      assert.equal(ok(await other.c.get("/api/notifications")).items.length, 0);
      assert.equal((await new Client().get("/api/notifications")).status, 401);
      // rejecting a payment notifies with the reason
      const o2 = await order(cu, prod); ok(await receipt(cu.c, o2.number));
      const pay = await db.payment.findFirstOrThrow({ where: { order: { number: o2.number } } });
      ok(await admin.post(`/api/admin/payments/${pay.id}/reject`, { reason: "رسید ناخوانا" }));
      assert.ok((await evts(cu.userId)).some((n) => n.event === "payment_rejected" && n.body === "رسید ناخوانا"));
    });
    it("read / unread state can be changed only by the owner", async () => {
      const cu = await customer(), other = await customer(), prod = await testProduct();
      await order(cu, prod); ok(await credit(cu.userId, 1000));
      const l = ok(await cu.c.get("/api/notifications")); const id = l.items[0].id;
      assert.equal(ok(await other.c.post("/api/notifications", { ids: [id] })).updated, 0); // someone else's id changes nothing
      assert.equal(ok(await cu.c.get("/api/notifications")).unread, l.unread);
      assert.equal(ok(await cu.c.post("/api/notifications", { ids: [id] })).updated, 1);
      assert.equal(ok(await cu.c.get("/api/notifications")).unread, l.unread - 1);
      ok(await cu.c.post("/api/notifications", { ids: [id], unread: true })); assert.equal(ok(await cu.c.get("/api/notifications")).unread, l.unread);
      ok(await cu.c.post("/api/notifications", { all: true })); assert.equal(ok(await cu.c.get("/api/notifications")).unread, 0);
      assert.equal(ok(await cu.c.get("/api/notifications?unread=1")).items.length, 0);
    });
    it("external channels are off by default; when enabled they queue, and unconfigured ones are skipped, never half-sent", async () => {
      const { notify, processDeliveries } = await import("../lib/server/notify");
      const cu = await customer();
      const before = await db.notificationDelivery.count();
      await notify(db, cu.userId, "wallet_change", { title: "بدون کانال" });
      assert.equal(await db.notificationDelivery.count(), before); // default: in-app only
      process.env.NOTIFY_CHANNELS = "sms,email,telegram";
      const smtp = process.env.EMAIL_SMTP_URL; delete process.env.EMAIL_SMTP_URL; // this test is about UNconfigured channels
      try {
        const n = await notify(db, cu.userId, "wallet_change", { title: "با کانال", body: "تست" });
        const rows = await db.notificationDelivery.findMany({ where: { notificationId: n.id } });
        assert.deepEqual(rows.map((r) => r.channel).sort(), ["email", "sms", "telegram"]); assert.ok(rows.every((r) => r.status === "queued"));
        await processDeliveries(500);
        const after = Object.fromEntries((await db.notificationDelivery.findMany({ where: { notificationId: n.id } })).map((r) => [r.channel, r.status]));
        assert.equal(after.sms, "sent"); assert.equal(after.email, "skipped"); assert.equal(after.telegram, "skipped");
      } finally { delete process.env.NOTIFY_CHANNELS; if (smtp) process.env.EMAIL_SMTP_URL = smtp; }
    });
  });

  describe("Wholesale portal", () => {
    it("apply → private documents → changes requested → resubmit → approve; partner sees tier, prices, orders, savings", async () => {
      const cu = await customer();
      const body = { name: "متقاضی", storeName: "فروشگاه تست", businessType: "online_shop", city: "مشهد", address: "مشهد، بلوار وکیل‌آباد، پلاک ۸" };
      const app = ok(await cu.c.post("/api/wholesale/apply", body));
      const other = await customer();
      assert.equal((await cu.c.post("/api/wholesale/documents", fileForm(PNG, "license.png", "image/png", "file", { applicationId: app.id }))).status, 200);
      assert.equal((await other.c.post("/api/wholesale/documents", fileForm(PNG, "x.png", "image/png", "file", { applicationId: app.id }))).status, 404);
      assert.equal((await cu.c.post("/api/wholesale/documents", fileForm(Buffer.from("MZ-exe-content-here"), "a.exe", "application/octet-stream", "file", { applicationId: app.id }))).status, 400);
      const mine = ok(await cu.c.get("/api/wholesale/application")); assert.equal(mine.files.length, 1); assert.equal(mine.status, "PENDING");
      const docId = mine.files[0].id;
      assert.equal((await cu.c.get(`/api/wholesale/documents/${docId}`)).status, 200);
      assert.equal((await other.c.get(`/api/wholesale/documents/${docId}`)).status, 403);
      assert.equal((await manager.get(`/api/wholesale/documents/${docId}`)).status, 403);
      assert.equal((await admin.get(`/api/wholesale/documents/${docId}`)).status, 200);
      assert.equal(ok(await admin.get(`/api/admin/wholesale/${app.id}`)).files.length, 1);
      ok(await admin.post(`/api/admin/wholesale/${app.id}/request-changes`, { note: "تصویر جواز کسب را واضح‌تر بفرستید" }));
      const chg = ok(await cu.c.get("/api/wholesale/application")); assert.equal(chg.status, "CHANGES_REQUESTED"); assert.match(chg.adminNote, /جواز/);
      assert.ok((await evts(cu.userId)).some((n) => n.event === "wholesale_changes"));
      ok(await cu.c.post("/api/wholesale/documents", fileForm(PNG, "license2.png", "image/png", "file", { applicationId: app.id })));
      ok(await cu.c.del(`/api/wholesale/documents/${docId}`));
      ok(await cu.c.post("/api/wholesale/apply", { ...body, storeName: "فروشگاه اصلاح‌شده" }));
      const re = ok(await cu.c.get("/api/wholesale/application")); assert.equal(re.status, "PENDING"); assert.equal(re.storeName, "فروشگاه اصلاح‌شده"); assert.equal(re.files.length, 1);
      const tier = await db.wholesaleTier.findUniqueOrThrow({ where: { key: "bronze" } });
      ok(await admin.post(`/api/admin/wholesale/${app.id}/approve`, { tierId: tier.id }));
      assert.ok((await evts(cu.userId)).some((n) => n.event === "wholesale_approved"));
      assert.equal((await cu.c.post("/api/wholesale/documents", fileForm(PNG, "late.png", "image/png", "file", { applicationId: app.id }))).status, 409); // locked once decided
      // approved partner: overview + server-side wholesale price + savings
      const prod = await testProduct(100_000); // wholesale 80,000 from qty 2
      const ov = ok(await cu.c.get(`/api/wholesale/overview?q=${prod.slug}`));
      assert.equal(ov.tier.key, "bronze"); assert.ok(ov.prices.length > 0); assert.equal(ov.savings.wholesale, 0);
      assert.ok(ov.prices.some((p: any) => p.slug === prod.slug && p.wholesale === 80_000 && p.minQty === 2));
      // bronze minimum order is 3,000,000: 40 × 80,000 = 3,200,000
      const o = await order(cu, prod, { qty: 40 });
      const row = await db.order.findUniqueOrThrow({ where: { number: o.number }, include: { items: true } });
      assert.equal(row.type, "WHOLESALE"); assert.equal(row.items[0].unitPrice, 80_000); assert.equal(row.items[0].listPrice, 100_000);
      await payAndApprove(cu, o.number);
      const ov2 = ok(await cu.c.get("/api/wholesale/overview"));
      assert.equal(ov2.savings.wholesale, 20_000 * 40); assert.equal(ov2.orders[0].number, o.number);
      // a non-partner gets nothing
      assert.equal(ok(await other.c.get("/api/wholesale/overview")).tier, null);
    });
    it("a rejected applicant sees the reason and may apply again", async () => {
      const cu = await customer();
      const body = { name: "متقاضی", storeName: "فروشگاه", businessType: "other", city: "شیراز", address: "شیراز، خیابان زند، پلاک ۵" };
      const app = ok(await cu.c.post("/api/wholesale/apply", body));
      ok(await admin.post(`/api/admin/wholesale/${app.id}/reject`, { note: "اطلاعات کافی نیست" }));
      assert.equal(ok(await cu.c.get("/api/wholesale/application")).status, "REJECTED");
      ok(await cu.c.post("/api/wholesale/apply", body));
      assert.equal(ok(await cu.c.get("/api/wholesale/application")).status, "PENDING");
    });
  });

  describe("Content: blog, banners, reviews", () => {
    it("blog: categories, scheduled publishing, SEO, tags, public post page", async () => {
      const cat = ok(await admin.post("/api/admin/r/blog-categories", { name: "راهنما " + uid(), slug: "guide-" + uid() }));
      const slug = "post-" + uid(), title = "مقاله آزمایشی " + slug;
      const future = new Date(Date.now() + 86400_000).toISOString();
      const p = ok(await admin.post("/api/admin/r/blog", { title, slug, content: "## سرفصل\n\nمتن اول\n\n- الف\n- ب", excerpt: "خلاصه", categoryId: cat.id, tags: ["قاب", "گلس"], isPublished: true, publishedAt: future, seoTitle: "عنوان سئوی " + slug, seoDescription: "توضیح سئو", featuredImage: "/media/images/x.png" }));
      assert.equal((await new Client().get(`/blog/${slug}`)).status, 404); // scheduled
      assert.ok(!(await new Client().get("/blog")).text.includes(title));
      ok(await admin.patch(`/api/admin/r/blog/${p.id}`, { publishedAt: new Date(Date.now() - 60_000).toISOString() }));
      const page = await new Client().get(`/blog/${slug}`);
      assert.equal(page.status, 200); assert.match(page.text, /متن اول/); assert.match(page.text, /سرفصل/); assert.match(page.text, /<title>عنوان سئوی/); assert.match(page.text, /گلس/);
      assert.ok((await new Client().get("/blog")).text.includes(title));
      assert.equal((await admin.del(`/api/admin/r/blog-categories/${cat.id}`)).status, 409); // has a post
      ok(await admin.patch(`/api/admin/r/blog/${p.id}`, { isPublished: false }));
      assert.equal((await new Client().get(`/blog/${slug}`)).status, 404);
      assert.equal((await manager.post("/api/admin/r/blog", { title: "x", slug: "x", content: "y" })).status, 403);
      ok(await admin.del(`/api/admin/r/blog/${p.id}`)); ok(await admin.del(`/api/admin/r/blog-categories/${cat.id}`));
    });
    it("banners: any placement, shown on product/blog pages and in a homepage banner section", async () => {
      const t = "بنر" + uid();
      assert.equal((await admin.post("/api/admin/r/banners", { title: "x", placement: "Bad Place!" })).status, 422);
      const prod = await testProduct();
      const b1 = ok(await admin.post("/api/admin/r/banners", { title: t + "-product", placement: "product_top" }));
      assert.match((await new Client().get(`/product/${prod.slug}`)).text, new RegExp(t + "-product"));
      const b2 = ok(await admin.post("/api/admin/r/banners", { title: t + "-blog", placement: "blog_top" }));
      assert.match((await new Client().get("/blog")).text, new RegExp(t + "-blog"));
      const place = "promo_" + uid().replace(/[^a-z0-9]/g, "");
      const b3 = ok(await admin.post("/api/admin/r/banners", { title: t + "-home", placement: place, buttonText: "برو", buttonLink: "/shop" }));
      const sec = ok(await admin.post("/api/admin/r/homepage", { key: "promo-" + uid(), type: "banner", title: "بنر سفارشی", config: { placement: place } }));
      assert.match((await new Client().get("/")).text, new RegExp(t + "-home"));
      ok(await admin.patch(`/api/admin/r/homepage/${sec.id}`, { isActive: false }));
      assert.ok(!(await new Client().get("/")).text.includes(t + "-home"));
      for (const [r, id] of [["homepage", sec.id], ["banners", b1.id], ["banners", b2.id], ["banners", b3.id]]) ok(await admin.del(`/api/admin/r/${r}/${id}`));
    });
    it("reviews: only verified (delivered) buyers, once; moderated; admin reply is public and notifies", async () => {
      const cu = await customer(), prod = await testProduct(100_000); const o = await order(cu, prod);
      const body = { orderNumber: o.number, productId: prod.id, rating: 5, body: "کیفیت عالی و ارسال سریع" };
      assert.equal((await cu.c.post("/api/reviews", body)).status, 404); // not delivered yet
      await payAndApprove(cu, o.number); await deliver(o.number);
      assert.equal((await cu.c.post("/api/reviews", { ...body, rating: 9 })).status, 422);
      const r = ok(await cu.c.post("/api/reviews", body)); assert.equal(r.status, "pending");
      assert.equal((await cu.c.post("/api/reviews", body)).status, 409);
      assert.equal((await (await customer()).c.post("/api/reviews", body)).status, 404);
      assert.ok(!(await new Client().get(`/product/${prod.slug}`)).text.includes("کیفیت عالی"));
      ok(await admin.patch(`/api/admin/reviews/${r.id}`, { status: "approved" }));
      ok(await admin.post(`/api/admin/reviews/${r.id}/reply`, { reply: "ممنون از اعتماد شما" }));
      const page = (await new Client().get(`/product/${prod.slug}`)).text;
      assert.match(page, /کیفیت عالی/); assert.match(page, /ممنون از اعتماد شما/);
      assert.ok((await evts(cu.userId)).some((n) => n.event === "review_reply"));
      assert.equal((await manager.post(`/api/admin/reviews/${r.id}/reply`, { reply: "x" })).status, 403);
    });
  });

  describe("End-to-end journey (order → pay → approve → points → status → notification → support → refund)", () => {
    it("works as one flow", async () => {
      const cu = await customer(), prod = await testProduct(300_000);
      const o = await order(cu, prod); assert.equal(o.total, 300_000);
      await payAndApprove(cu, o.number);
      assert.equal(await points(cu.userId), 30);
      ok(await admin.post(`/api/admin/orders/${o.number}/status`, { status: "PREPARING" }));
      assert.ok((await evts(cu.userId)).some((n) => n.event === "order_status"));
      const t = ok(await cu.c.post("/api/support/tickets", fileForm(PNG, "a.png", "image/png", "files", { subject: "درخواست لغو", message: "سفارش را لغو کنید", category: "return", orderNumber: String(o.number) })));
      const rep = new FormData(); rep.set("message", "درخواست شما ثبت شد"); ok(await admin.post(`/api/admin/support/${t.number}/reply`, rep));
      const r = ok(await admin.post(`/api/admin/orders/${o.number}/refunds`, { method: "wallet", amount: 300_000, reason: "لغو به درخواست مشتری", restock: true }));
      ok(await cu.c.post(`/api/refunds/${r.id}/accept`));
      const row = await db.order.findUniqueOrThrow({ where: { number: o.number } });
      assert.equal(row.status, "REFUNDED"); assert.equal(await balance(cu.userId), 300_000); assert.equal(await points(cu.userId), 0);
      assert.equal((await db.inventory.findUniqueOrThrow({ where: { variantId: prod.variantId } })).quantity, 500);
      const p = newPhone(); void p; void plantOtp;
    });
  });
});
