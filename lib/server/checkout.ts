import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/server/errors";
import { evaluateCoupon } from "@/lib/server/coupons";
import { createHash } from "node:crypto";
import { allocate } from "@/lib/server/price-engine/calc";
import { priceLines } from "@/lib/server/price-engine/line";
import { loadActiveDiscounts, reserveDiscounts, userDiscountUses } from "@/lib/server/price-engine/discounts";
import { getWholesalePolicy } from "@/lib/server/price-engine/wholesale";
import { getProvider } from "@/lib/server/payments";
import { userCartId, variantOption } from "@/lib/server/cart";
import { rateLimit } from "@/lib/server/rate-limit";
import { getWalletBalance, walletApply } from "@/lib/server/finance/wallet";
import { assertRedeem, earnForOrder, getLoyaltyRules, getPointsBalance, pointsApply, quoteRedeem, type RedeemQuote } from "@/lib/server/finance/loyalty";
import { notify } from "@/lib/server/notify";
import { audit } from "@/lib/server/admin/core";
import type { SessionUser } from "@/lib/server/auth/session";

type Tx = Prisma.TransactionClient;

const itemsInclude = {
  items: { orderBy: { id: "asc" as const }, include: { variant: { include: { inventory: true, colorRef: { select: { name: true } }, phoneModel: { select: { name: true, brandId: true, brand: { select: { name: true } } } }, product: { include: { category: { select: { parentId: true } }, images: { where: { type: "IMAGE" as const }, orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }], take: 1 } } } } } } },
};

export const shippingCost = (m: { cost: number; freeThreshold: number | null }, amountAfterDiscount: number) =>
  m.freeThreshold != null && amountAfterDiscount >= m.freeThreshold ? 0 : m.cost;

/** Loads and prices the user's cart from current DB data. Used by both the quote and the order transaction. */
async function priceCart(tx: Tx, user: SessionUser) {
  const cartId = await userCartId(user);
  const cart = cartId ? await tx.cart.findUnique({ where: { id: cartId }, include: itemsInclude }) : null;
  if (!cart || cart.items.length === 0) throw badRequest("سبد خرید شما خالی است.", "cart_empty");
  const pmIds = cart.items.map((i) => i.phoneModelId).filter((x): x is string => !!x);
  const pms = pmIds.length ? await tx.phoneModel.findMany({ where: { id: { in: pmIds } }, select: { id: true, name: true, brand: { select: { name: true } } } }) : [];
  for (const i of cart.items) {
    if (!i.variant.product.isActive || !i.variant.isActive) throw conflict(`«${i.variant.product.name}» دیگر موجود نیست. آن را از سبد حذف کنید.`, "product_unavailable");
  }
  const discounts = await loadActiveDiscounts(tx);
  const userUses = await userDiscountUses(tx, user.id, discounts.map((d) => d.id));
  const prices = priceLines(cart.items.map((i) => ({ qty: i.quantity, product: i.variant.product, variant: i.variant })), user, discounts, userUses, await getWholesalePolicy(tx));
  const lines = cart.items.map((i, k) => {
    const p = i.variant.product;
    const price = prices[k]!;
    const pm = pms.find((m) => m.id === i.phoneModelId);
    return {
      cartItemId: i.id, variantId: i.variantId, productId: p.id, name: p.name, sku: i.variant.sku, image: p.images[0]?.url ?? null,
      option: variantOption(i.variant, pm?.name), quantity: i.quantity, stock: i.variant.inventory?.quantity ?? 0,
      unitPrice: price.unitPrice, priceType: price.priceType, total: price.unitPrice * i.quantity,
      retailUnit: price.priceType === "retail" ? price.unitPrice : Math.max(0, price.listPrice - p.retailDiscount),
      brandName: i.variant.phoneModel?.brand.name ?? pm?.brand.name ?? null, modelName: i.variant.phoneModel?.name ?? pm?.name ?? null, colorName: i.variant.colorRef?.name ?? null,
      originalPrice: price.originalPrice, discountAmount: price.discountAmount, discountId: price.discountId, discountLabel: price.discountLabel,
    };
  });
  const subtotal = lines.reduce((a, l) => a + l.total, 0);
  const retailSubtotal = lines.filter((l) => l.priceType === "retail").reduce((a, l) => a + l.total, 0);
  const wholesaleSubtotal = subtotal - retailSubtotal;
  return { cart, lines, subtotal, retailSubtotal, wholesaleSubtotal };
}

/** Fingerprint of what the customer is being charged for. The browser echoes it back so a price change between quote and order is detected, never silently accepted. */
const priceFingerprint = (lines: { variantId: string; quantity: number; unitPrice: number }[]) =>
  createHash("sha256").update(JSON.stringify([...lines].sort((a, b) => a.variantId.localeCompare(b.variantId)).map((l) => [l.variantId, l.quantity, l.unitPrice]))).digest("hex").slice(0, 24);

function checkWholesale(user: SessionUser, wholesaleSubtotal: number) {
  if (wholesaleSubtotal > 0 && user.wholesale && wholesaleSubtotal < user.wholesale.minOrder) {
    throw badRequest(`حداقل مبلغ سفارش عمده برای سطح ${user.wholesale.tierName} ${user.wholesale.minOrder.toLocaleString("fa-IR")} تومان است.`, "wholesale_min_order");
  }
}

export interface Quote {
  lines: { name: string; option: string | null; quantity: number; unitPrice: number; total: number; priceType: string; inStock: boolean; originalPrice: number; discountAmount: number; discountLabel: string | null }[];
  /** Echo this in createOrder({ priceHash }) so a price change after the quote is rejected with `price_changed`. */
  priceHash: string;
  subtotal: number;
  discount: number;
  couponCode: string | null;
  couponError: string | null;
  shippingMethods: { id: string; key: string; name: string; description: string | null; cost: number; freeThreshold: number | null }[];
  shipping: number;
  total: number;
  issues: string[];
  isWholesale: boolean;
  /** Loyalty points redemption and wallet usage, both computed from the current rules and balances. */
  loyalty: RedeemQuote & { discountApplied: number };
  wallet: { balance: number; applied: number };
  /** Amount left to pay by card-to-card after the wallet. */
  payable: number;
}

/** Read-only price quote. The browser only ever displays these numbers; it never sends totals back. */
export async function quoteCheckout(user: SessionUser, input: { shippingMethodId?: string; couponCode?: string | null; useWallet?: boolean; redeemPoints?: number }): Promise<Quote> {
  const priced = await priceCart(db, user);
  const issues: string[] = [];
  for (const l of priced.lines) if (l.stock < l.quantity) issues.push(`موجودی «${l.name}» کافی نیست (موجودی: ${l.stock}).`);
  try { checkWholesale(user, priced.wholesaleSubtotal); } catch (e) { issues.push((e as Error).message); }

  let discount = 0;
  let couponError: string | null = null;
  const code = (input.couponCode ?? priced.cart.couponCode) || null;
  if (code) {
    try { discount = (await evaluateCoupon(db, code, { userId: user.id, retailSubtotal: priced.retailSubtotal })).discount; }
    catch (e) { couponError = (e as Error).message; }
  }
  const walletBalance = await getWalletBalance(user.id);
  const rules = await getLoyaltyRules();
  const redeem = quoteRedeem(rules, await getPointsBalance(user.id), input.redeemPoints ?? 0, priced.retailSubtotal - discount);
  const methods = await db.shippingMethod.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  const after = priced.subtotal - discount - redeem.discount;
  const chosen = methods.find((m) => m.id === input.shippingMethodId);
  const shipping = chosen ? shippingCost(chosen, after) : 0;
  return {
    lines: priced.lines.map((l) => ({ name: l.name, option: l.option, quantity: l.quantity, unitPrice: l.unitPrice, total: l.total, priceType: l.priceType, inStock: l.stock >= l.quantity, originalPrice: l.originalPrice, discountAmount: l.discountAmount, discountLabel: l.discountLabel })),
    priceHash: priceFingerprint(priced.lines),
    subtotal: priced.subtotal, discount: discount + redeem.discount, couponCode: couponError ? null : code, couponError,
    shippingMethods: methods.map((m) => ({ id: m.id, key: m.key, name: m.name, description: m.description, cost: shippingCost(m, after), freeThreshold: m.freeThreshold })),
    shipping, total: after + shipping, issues, isWholesale: priced.wholesaleSubtotal > 0,
    loyalty: { ...redeem, discountApplied: redeem.discount },
    wallet: { balance: walletBalance, applied: input.useWallet ? Math.min(walletBalance, after + shipping) : 0 },
    payable: after + shipping - (input.useWallet ? Math.min(walletBalance, after + shipping) : 0),
  };
}

export interface CreateOrderInput { addressId: string; shippingMethodId: string; couponCode?: string | null; paymentMethod: string; note?: string; useWallet?: boolean; redeemPoints?: number; priceHash?: string }

/**
 * Creates the order atomically. Everything is recomputed from the database inside the transaction:
 * prices, wholesale eligibility, coupon, shipping and stock. Stock is taken with a conditional
 * UPDATE (quantity >= wanted), so two buyers can never oversell the same unit.
 */
export async function createOrder(user: SessionUser, input: CreateOrderInput) {
  await rateLimit(`order:create:${user.id}`, 10, 600);
  const provider = getProvider(input.paymentMethod);
  // A card provider is only needed when the wallet does not cover the whole order; validated again below.
  if (!provider && !input.useWallet) throw badRequest("روش پرداخت انتخاب‌شده فعال نیست.", "payment_method_invalid");

  return db.$transaction(async (tx) => {
    const address = await tx.address.findFirst({ where: { id: input.addressId, userId: user.id } });
    if (!address) throw notFound("آدرس انتخاب‌شده پیدا نشد.");
    const method = await tx.shippingMethod.findFirst({ where: { id: input.shippingMethodId, isActive: true } });
    if (!method) throw badRequest("روش ارسال معتبر نیست.", "shipping_invalid");

    const priced = await priceCart(tx, user);
    checkWholesale(user, priced.wholesaleSubtotal);
    // The customer confirmed a specific price. If anything that affects it changed since (price, rule, discount, quantity), stop and let them re-check.
    if (input.priceHash && input.priceHash !== priceFingerprint(priced.lines)) throw conflict("قیمت یکی از کالاها تغییر کرده است. مبلغ به‌روز شد؛ لطفاً سبد و مبلغ نهایی را دوباره بررسی و سپس سفارش را ثبت کنید.", "price_changed");

    // Take stock atomically, in a stable order to avoid deadlocks between concurrent orders.
    const sorted = [...priced.lines].sort((a, b) => a.variantId.localeCompare(b.variantId));
    for (const l of sorted) {
      const r = await tx.inventory.updateMany({ where: { variantId: l.variantId, quantity: { gte: l.quantity } }, data: { quantity: { decrement: l.quantity } } });
      if (r.count !== 1) throw conflict(`موجودی «${l.name}» کافی نیست.`, "out_of_stock");
    }

    let couponDiscount = 0;
    let couponId: string | null = null;
    let couponCode: string | null = null;
    const wanted = (input.couponCode ?? priced.cart.couponCode) || null;
    if (wanted) {
      const c = await evaluateCoupon(tx, wanted, { userId: user.id, retailSubtotal: priced.retailSubtotal });
      const bumped = await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = "usedCount" + 1 WHERE "id" = ${c.couponId} AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
      if (bumped !== 1) throw badRequest("ظرفیت استفاده از این کد تخفیف تمام شده است.", "coupon_exhausted");
      couponDiscount = c.discount; couponId = c.couponId; couponCode = c.code;
    }

    // Loyalty points → discount (rules from the admin panel; the balance is re-read inside the transaction).
    const rules = await getLoyaltyRules(tx);
    const acc = await tx.loyaltyAccount.findUnique({ where: { userId: user.id } });
    const redeem = quoteRedeem(rules, acc?.points ?? 0, input.redeemPoints ?? 0, priced.retailSubtotal - couponDiscount);
    assertRedeem(redeem);

    // The coupon applies to retail lines only; each line records its exact share (parts add up to the coupon discount).
    const retailWeights = priced.lines.map((l) => (l.priceType === "retail" ? l.total : 0));
    const couponShare = allocate(couponDiscount, retailWeights);

    const after = priced.subtotal - couponDiscount - redeem.discount;
    const shipping = shippingCost(method, after);
    const total = after + shipping;

    // Wallet: read the balance in the same transaction; the debit itself is an atomic conditional update.
    const wallet = input.useWallet ? await tx.wallet.findUnique({ where: { userId: user.id } }) : null;
    const walletApplied = input.useWallet ? Math.min(wallet?.balance ?? 0, total) : 0;
    const payable = total - walletApplied;
    if (payable > 0 && !provider) throw badRequest("برای مبلغ باقی‌مانده یک روش پرداخت انتخاب کنید.", "payment_method_invalid");
    const walletOnly = walletApplied > 0 && payable === 0;

    const order = await tx.order.create({
      data: {
        userId: user.id,
        type: priced.wholesaleSubtotal > 0 ? "WHOLESALE" : "RETAIL",
        customerName: address.receiver, customerPhone: user.phone ?? address.phone, customerEmail: user.email,
        shippingAddress: { title: address.title, receiver: address.receiver, phone: address.phone, province: address.province, city: address.city, postalCode: address.postalCode, address: address.address },
        shippingMethodId: method.id, subtotal: priced.subtotal, discountTotal: couponDiscount + redeem.discount, shippingCost: shipping, total, couponCode,
        paymentMethod: walletOnly ? "wallet" : provider!.key, note: input.note || null,
        walletUsed: walletApplied, loyaltyPointsUsed: redeem.applied, loyaltyDiscount: redeem.discount,
        status: walletOnly ? "PROCESSING" : "PENDING_PAYMENT", paymentStatus: walletOnly ? "PAID" : "PENDING",
        items: { create: priced.lines.map((l, k) => ({ variantId: l.variantId, productId: l.productId, name: l.name, sku: l.sku, image: l.image, option: l.option, unitPrice: l.unitPrice, listPrice: l.retailUnit, priceType: l.priceType, quantity: l.quantity, total: l.total,
          brandName: l.brandName, modelName: l.modelName, colorName: l.colorName, originalPrice: l.originalPrice, discountAmount: l.discountAmount, discountLabel: l.discountLabel, couponDiscount: couponShare[k]!, finalTotal: l.total - couponShare[k]! })) },
        history: { create: [{ status: "PENDING_PAYMENT", description: "سفارش ثبت شد.", createdById: user.id }, ...(walletOnly ? [{ status: "PROCESSING" as const, description: "پرداخت کامل از کیف پول انجام شد. سفارش در حال پردازش است.", createdById: user.id }] : [])] },
        payments: { create: walletOnly ? { amount: total, method: "wallet", provider: "wallet", status: "PAID", paidAt: new Date(), submittedAt: new Date() } : { amount: payable, method: provider!.key, provider: provider!.key } },
      },
    });

    for (const l of sorted) {
      const inv = await tx.inventory.findUniqueOrThrow({ where: { variantId: l.variantId } });
      await tx.inventoryMovement.create({ data: { inventoryId: inv.id, delta: -l.quantity, balanceAfter: inv.quantity, reason: "order", orderId: order.id, createdById: user.id } });
    }
    if (couponId) await tx.couponUsage.create({ data: { couponId, userId: user.id, orderId: order.id } });
    await reserveDiscounts(tx, user.id, order.id, priced.lines.filter((l) => l.priceType === "retail" && l.discountId).map((l) => l.discountId!));
    if (redeem.applied > 0) {
      await pointsApply(tx, { userId: user.id, points: -redeem.applied, type: "redeem", reference: `redeem:${order.id}`, description: `استفاده از امتیاز در سفارش ${order.number}`, orderId: order.id });
      await audit({ admin: user, ip: "customer" }, "loyalty.redeem", "order", order.id, undefined, { points: redeem.applied, discount: redeem.discount, orderNumber: order.number }, tx);
    }
    if (walletApplied > 0) {
      await walletApply(tx, { userId: user.id, direction: "out", amount: walletApplied, type: "order_payment", reference: `order-pay:${order.id}`, description: `پرداخت سفارش ${order.number}`, orderId: order.id });
      await audit({ admin: user, ip: "customer" }, "wallet.order_payment", "order", order.id, undefined, { amount: walletApplied, orderNumber: order.number, fullyPaid: walletOnly }, tx);
    }
    await tx.cartItem.deleteMany({ where: { cartId: priced.cart.id } });
    await tx.cart.update({ where: { id: priced.cart.id }, data: { couponCode: null } });
    await notify(tx, user.id, "order_created", { title: `سفارش ${order.number.toLocaleString("fa-IR")} ثبت شد`, body: walletOnly ? "پرداخت از کیف پول انجام شد و سفارش در حال پردازش است." : "برای تکمیل سفارش، پرداخت را انجام دهید.", link: `/account/orders/${order.number}`, data: { orderNumber: order.number } });
    if (walletApplied > 0) await notify(tx, user.id, "wallet_change", { title: "برداشت از کیف پول", body: `${walletApplied.toLocaleString("fa-IR")} تومان بابت سفارش ${order.number.toLocaleString("fa-IR")} از کیف پول شما کسر شد.`, link: "/account/wallet" });
    if (walletOnly) await earnForOrder(tx, order.id, "payment");
    return { id: order.id, number: order.number, total, walletUsed: walletApplied, payable };
  }, { timeout: 20_000 });
}
