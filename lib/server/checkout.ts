import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/server/errors";
import { evaluateCoupon } from "@/lib/server/coupons";
import { unitPriceFor } from "@/lib/server/pricing";
import { getProvider } from "@/lib/server/payments";
import { userCartId } from "@/lib/server/cart";
import { rateLimit } from "@/lib/server/rate-limit";
import type { SessionUser } from "@/lib/server/auth/session";

type Tx = Prisma.TransactionClient;

const itemsInclude = {
  items: { orderBy: { id: "asc" as const }, include: { variant: { include: { inventory: true, product: { include: { images: { orderBy: [{ isPrimary: "desc" as const }], take: 1 } } } } } } },
};

export const shippingCost = (m: { cost: number; freeThreshold: number | null }, amountAfterDiscount: number) =>
  m.freeThreshold != null && amountAfterDiscount >= m.freeThreshold ? 0 : m.cost;

/** Loads and prices the user's cart from current DB data. Used by both the quote and the order transaction. */
async function priceCart(tx: Tx, user: SessionUser) {
  const cartId = await userCartId(user);
  const cart = cartId ? await tx.cart.findUnique({ where: { id: cartId }, include: itemsInclude }) : null;
  if (!cart || cart.items.length === 0) throw badRequest("سبد خرید شما خالی است.", "cart_empty");
  const pmIds = cart.items.map((i) => i.phoneModelId).filter((x): x is string => !!x);
  const pms = pmIds.length ? await tx.phoneModel.findMany({ where: { id: { in: pmIds } }, select: { id: true, name: true } }) : [];
  const lines = cart.items.map((i) => {
    const p = i.variant.product;
    if (!p.isActive || !i.variant.isActive) throw conflict(`«${p.name}» دیگر موجود نیست. آن را از سبد حذف کنید.`, "product_unavailable");
    const price = unitPriceFor(p, i.variant, i.quantity, user);
    const pm = pms.find((m) => m.id === i.phoneModelId);
    return {
      cartItemId: i.id, variantId: i.variantId, productId: p.id, name: p.name, sku: i.variant.sku, image: p.images[0]?.url ?? null,
      option: pm?.name ?? (i.variant.name !== "استاندارد" ? i.variant.name : null), quantity: i.quantity, stock: i.variant.inventory?.quantity ?? 0,
      unitPrice: price.unitPrice, priceType: price.priceType, total: price.unitPrice * i.quantity,
    };
  });
  const subtotal = lines.reduce((a, l) => a + l.total, 0);
  const retailSubtotal = lines.filter((l) => l.priceType === "retail").reduce((a, l) => a + l.total, 0);
  const wholesaleSubtotal = subtotal - retailSubtotal;
  return { cart, lines, subtotal, retailSubtotal, wholesaleSubtotal };
}

function checkWholesale(user: SessionUser, wholesaleSubtotal: number) {
  if (wholesaleSubtotal > 0 && user.wholesale && wholesaleSubtotal < user.wholesale.minOrder) {
    throw badRequest(`حداقل مبلغ سفارش عمده برای سطح ${user.wholesale.tierName} ${user.wholesale.minOrder.toLocaleString("fa-IR")} تومان است.`, "wholesale_min_order");
  }
}

export interface Quote {
  lines: { name: string; option: string | null; quantity: number; unitPrice: number; total: number; priceType: string; inStock: boolean }[];
  subtotal: number;
  discount: number;
  couponCode: string | null;
  couponError: string | null;
  shippingMethods: { id: string; key: string; name: string; description: string | null; cost: number; freeThreshold: number | null }[];
  shipping: number;
  total: number;
  issues: string[];
  isWholesale: boolean;
}

/** Read-only price quote. The browser only ever displays these numbers; it never sends totals back. */
export async function quoteCheckout(user: SessionUser, input: { shippingMethodId?: string; couponCode?: string | null }): Promise<Quote> {
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
  const methods = await db.shippingMethod.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  const after = priced.subtotal - discount;
  const chosen = methods.find((m) => m.id === input.shippingMethodId);
  const shipping = chosen ? shippingCost(chosen, after) : 0;
  return {
    lines: priced.lines.map((l) => ({ name: l.name, option: l.option, quantity: l.quantity, unitPrice: l.unitPrice, total: l.total, priceType: l.priceType, inStock: l.stock >= l.quantity })),
    subtotal: priced.subtotal, discount, couponCode: couponError ? null : code, couponError,
    shippingMethods: methods.map((m) => ({ id: m.id, key: m.key, name: m.name, description: m.description, cost: shippingCost(m, after), freeThreshold: m.freeThreshold })),
    shipping, total: after + shipping, issues, isWholesale: priced.wholesaleSubtotal > 0,
  };
}

export interface CreateOrderInput { addressId: string; shippingMethodId: string; couponCode?: string | null; paymentMethod: string; note?: string }

/**
 * Creates the order atomically. Everything is recomputed from the database inside the transaction:
 * prices, wholesale eligibility, coupon, shipping and stock. Stock is taken with a conditional
 * UPDATE (quantity >= wanted), so two buyers can never oversell the same unit.
 */
export async function createOrder(user: SessionUser, input: CreateOrderInput) {
  await rateLimit(`order:create:${user.id}`, 10, 600);
  const provider = getProvider(input.paymentMethod);
  if (!provider) throw badRequest("روش پرداخت انتخاب‌شده فعال نیست.", "payment_method_invalid");

  return db.$transaction(async (tx) => {
    const address = await tx.address.findFirst({ where: { id: input.addressId, userId: user.id } });
    if (!address) throw notFound("آدرس انتخاب‌شده پیدا نشد.");
    const method = await tx.shippingMethod.findFirst({ where: { id: input.shippingMethodId, isActive: true } });
    if (!method) throw badRequest("روش ارسال معتبر نیست.", "shipping_invalid");

    const priced = await priceCart(tx, user);
    checkWholesale(user, priced.wholesaleSubtotal);

    // Take stock atomically, in a stable order to avoid deadlocks between concurrent orders.
    const sorted = [...priced.lines].sort((a, b) => a.variantId.localeCompare(b.variantId));
    for (const l of sorted) {
      const r = await tx.inventory.updateMany({ where: { variantId: l.variantId, quantity: { gte: l.quantity } }, data: { quantity: { decrement: l.quantity } } });
      if (r.count !== 1) throw conflict(`موجودی «${l.name}» کافی نیست.`, "out_of_stock");
    }

    let discount = 0;
    let couponId: string | null = null;
    let couponCode: string | null = null;
    const wanted = (input.couponCode ?? priced.cart.couponCode) || null;
    if (wanted) {
      const c = await evaluateCoupon(tx, wanted, { userId: user.id, retailSubtotal: priced.retailSubtotal });
      const bumped = await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = "usedCount" + 1 WHERE "id" = ${c.couponId} AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
      if (bumped !== 1) throw badRequest("ظرفیت استفاده از این کد تخفیف تمام شده است.", "coupon_exhausted");
      discount = c.discount; couponId = c.couponId; couponCode = c.code;
    }
    const after = priced.subtotal - discount;
    const shipping = shippingCost(method, after);
    const total = after + shipping;

    const order = await tx.order.create({
      data: {
        userId: user.id,
        type: priced.wholesaleSubtotal > 0 ? "WHOLESALE" : "RETAIL",
        customerName: address.receiver, customerPhone: user.phone, customerEmail: user.email,
        shippingAddress: { title: address.title, receiver: address.receiver, phone: address.phone, province: address.province, city: address.city, postalCode: address.postalCode, address: address.address },
        shippingMethodId: method.id, subtotal: priced.subtotal, discountTotal: discount, shippingCost: shipping, total, couponCode, paymentMethod: provider.key, note: input.note || null,
        items: { create: priced.lines.map((l) => ({ variantId: l.variantId, productId: l.productId, name: l.name, sku: l.sku, image: l.image, option: l.option, unitPrice: l.unitPrice, priceType: l.priceType, quantity: l.quantity, total: l.total })) },
        history: { create: { status: "PENDING_PAYMENT", description: "سفارش ثبت شد و در انتظار پرداخت است.", createdById: user.id } },
        payments: { create: { amount: total, method: provider.key, provider: provider.key } },
      },
    });

    for (const l of sorted) {
      const inv = await tx.inventory.findUniqueOrThrow({ where: { variantId: l.variantId } });
      await tx.inventoryMovement.create({ data: { inventoryId: inv.id, delta: -l.quantity, reason: "order", orderId: order.id, createdById: user.id } });
    }
    if (couponId) await tx.couponUsage.create({ data: { couponId, userId: user.id, orderId: order.id } });
    await tx.cartItem.deleteMany({ where: { cartId: priced.cart.id } });
    await tx.cart.update({ where: { id: priced.cart.id }, data: { couponCode: null } });
    await tx.notification.create({ data: { userId: user.id, type: "order_created", title: `سفارش ${order.number.toLocaleString("fa-IR")} ثبت شد`, body: "برای تکمیل سفارش، پرداخت را انجام دهید.", link: `/account/orders/${order.number}` } });
    return { id: order.id, number: order.number, total };
  }, { timeout: 20_000 });
}
