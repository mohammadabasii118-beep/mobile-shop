import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkoutSchema } from "@/lib/validation";
import { paymentProvider } from "@/lib/payment";
import { customAlphabet } from "nanoid";
import { CARD_TRANSFER_HOLD_HOURS } from "@/lib/reservation";
import { logOrderStatus } from "@/lib/orderStatusHistory";
import { effectivePrice, getActiveWholesaleTiers, applyWholesaleTier } from "@/lib/wholesalePricing";
import { creditLoyaltyForOrder, clampRedeemablePoints, POINT_REDEEM_VALUE_TOMAN } from "@/lib/loyalty";
import { checkLowStockAfterDecrement } from "@/lib/lowStock";

const genOrderNumber = customAlphabet("0123456789", 8);

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "اطلاعات نامعتبر است" }, { status: 400 });
  }
  const { items, shippingName, shippingPhone, shippingAddress, shippingCity, shippingPostal, discountCode, paymentMethod, useWalletAmount, redeemPoints } = parsed.data;

  const session = await getServerSession(authOptions);

  // A wallet payment must be tied to a real, logged-in account — there is
  // no such thing as a guest wallet balance.
  if (paymentMethod === "WALLET" && !session?.user?.id) {
    return NextResponse.json({ error: "برای پرداخت از کیف پول باید وارد حساب کاربری خود شوید" }, { status: 400 });
  }

  try {
    // Merge duplicate cart lines (same product + same variant, or same
    // plain product) into a single line before pricing/stock — otherwise
    // a duplicated line (client bug, replayed request, or a manually
    // crafted request) would create two separate OrderItem rows and two
    // separate stock-decrement calls for what is really one purchase.
    const mergedMap = new Map<string, { productId: string; variantId?: string; quantity: number }>();
    for (const line of items) {
      const key = `${line.productId}::${line.variantId || ""}`;
      const existing = mergedMap.get(key);
      if (existing) {
        existing.quantity += line.quantity;
      } else {
        mergedMap.set(key, { productId: line.productId, variantId: line.variantId, quantity: line.quantity });
      }
    }
    const mergedItems = Array.from(mergedMap.values());

    // Re-price every line from the database — never trust client-sent prices.
    const productIds = Array.from(new Set(mergedItems.map((i) => i.productId)));
    const variantIds = Array.from(new Set(mergedItems.filter((i) => i.variantId).map((i) => i.variantId as string)));

    // Wholesale pricing, like everything else on this route, is resolved
    // authoritatively from the database — never from anything the client
    // sent — and re-checked fresh on every checkout in case an
    // approval/status changed since the session was issued.
    // Real loyalty-point balance and wallet balance for the logged-in
    // customer (Phase 5) — fetched fresh here, never trusted from the
    // client, exactly like isWholesale above. Both are 0 for a guest order
    // (there is no account to redeem points from or debit a wallet for).
    const [products, variants, isWholesale, wholesaleTiers, walletUser] = await Promise.all([
      db.product.findMany({ where: { id: { in: productIds } } }),
      variantIds.length
        ? db.productVariant.findMany({
            where: { id: { in: variantIds } },
            include: { brand: true, phoneModel: true, color: true },
          })
        : Promise.resolve([]),
      session?.user?.id
        ? db.user.findUnique({ where: { id: session.user.id as string }, select: { isWholesale: true } }).then((u) => !!u?.isWholesale)
        : Promise.resolve(false),
      getActiveWholesaleTiers(),
      session?.user?.id
        ? db.user.findUnique({ where: { id: session.user.id as string }, select: { loyaltyPoints: true, walletBalance: true } })
        : Promise.resolve(null),
    ]);
    const availableLoyaltyPoints = walletUser?.loyaltyPoints || 0;
    const availableWalletBalance = walletUser?.walletBalance || 0;

    let subtotal = 0;
    const orderItemsData = mergedItems.map((line) => {
      const p = products.find((pp) => pp.id === line.productId);
      if (!p || !p.isActive) throw new Error("برخی محصولات دیگر موجود نیستند");

      if (p.hasVariants) {
        if (!line.variantId) throw new Error(`برای «${p.name}» باید یک گزینه (رنگ/مدل) انتخاب شود`);
        const v = variants.find((vv) => vv.id === line.variantId && vv.productId === p.id);
        if (!v || !v.isActive) throw new Error(`گزینه انتخاب‌شده برای «${p.name}» دیگر موجود نیست`);
        if (v.stock < line.quantity) throw new Error(`موجودی «${p.name}» کافی نیست`);
        const label = [v.brand?.name, v.phoneModel?.name, v.color?.name].filter(Boolean).join(" / ") || null;
        let unitPrice = effectivePrice(v.price, v.wholesalePrice, isWholesale);
        if (isWholesale) unitPrice = applyWholesaleTier(unitPrice, line.quantity, wholesaleTiers);
        const lineTotal = unitPrice * line.quantity;
        subtotal += lineTotal;
        return {
          productId: p.id,
          variantId: v.id as string | null,
          variantLabel: label as string | null,
          nameSnapshot: p.name,
          unitPrice,
          quantity: line.quantity,
          total: lineTotal,
        };
      }

      if (p.stock < line.quantity) throw new Error(`موجودی «${p.name}» کافی نیست`);
      let unitPrice = effectivePrice(p.price, p.wholesalePrice, isWholesale);
      if (isWholesale) unitPrice = applyWholesaleTier(unitPrice, line.quantity, wholesaleTiers);
      const lineTotal = unitPrice * line.quantity;
      subtotal += lineTotal;
      return {
        productId: p.id,
        variantId: null as string | null,
        variantLabel: null as string | null,
        nameSnapshot: p.name,
        unitPrice,
        quantity: line.quantity,
        total: lineTotal,
      };
    });

    // Apply discount code, if any (read outside the transaction — the
    // authoritative re-check of usage limit happens again, atomically,
    // inside the transaction below right before incrementing usedCount).
    let discountAmount = 0;
    let appliedCode: string | undefined;
    let discountUsageLimit: number | null = null;
    if (discountCode) {
      const d = await db.discount.findUnique({ where: { code: discountCode.toUpperCase() } });
      const now = new Date();
      const valid =
        d && d.isActive &&
        (!d.startsAt || d.startsAt <= now) &&
        (!d.endsAt || d.endsAt >= now) &&
        (!d.minOrderAmount || subtotal >= d.minOrderAmount) &&
        (!d.usageLimit || d.usedCount < d.usageLimit);
      if (valid) {
        discountAmount = d!.type === "PERCENT" ? Math.round((subtotal * d!.value) / 100) : d!.value;
        discountAmount = Math.min(discountAmount, subtotal);
        appliedCode = d!.code;
        discountUsageLimit = d!.usageLimit;
      }
    }

    const shippingFee = subtotal > 1000000 ? 0 : 45000;
    const preLoyaltyTotal = subtotal - discountAmount + shippingFee;

    // Loyalty-point redemption (Phase 5) — the amount the customer ASKED to
    // redeem is re-clamped here to their real balance and to
    // MAX_LOYALTY_DISCOUNT_SHARE of the pre-loyalty total. Guest orders have
    // no points, so this is always 0 for them.
    const redeemPointsActual = session?.user?.id ? clampRedeemablePoints(redeemPoints, availableLoyaltyPoints, preLoyaltyTotal) : 0;
    const loyaltyDiscount = redeemPointsActual * POINT_REDEEM_VALUE_TOMAN;

    // `total` is the order's real, final total AFTER the loyalty discount —
    // this is what's stored on Order.total and what a gateway/card-transfer
    // amount is derived from below (minus any wallet contribution).
    const total = preLoyaltyTotal - loyaltyDiscount;

    // Partial wallet payment (Phase 5) — for a full "WALLET" paymentMethod
    // the entire `total` is covered by the wallet (unchanged behavior,
    // just re-expressed in terms of the new `walletAmountUsed` variable so
    // the debit/claim logic below can be shared). For any other payment
    // method, the customer may optionally cover part of `total` from their
    // wallet alongside the gateway/card-transfer payment — re-clamped to
    // their real balance and to `total` itself (never more than the order
    // actually costs).
    const walletAmountUsed =
      paymentMethod === "WALLET"
        ? total
        : session?.user?.id
        ? Math.max(0, Math.min(useWalletAmount, availableWalletBalance, total))
        : 0;

    // What's actually left to collect via a gateway redirect or a manual
    // card-transfer receipt, after the loyalty discount and any wallet
    // contribution. Zero means the order is already fully paid the moment
    // it's created, regardless of the nominal paymentMethod.
    const remainingDue = total - walletAmountUsed;
    const isFullyPaidAtCreation = paymentMethod === "WALLET" || remainingDue <= 0;

    const orderNumber = `CL-${genOrderNumber()}`;

    // Requirement #1 (security spec): every order gets a long, unguessable
    // token. For guest orders (no logged-in user) this token — not the
    // order id or orderNumber — is what grants access to the payment and
    // receipt pages. It's generated for logged-in orders too for
    // consistency, but only guest orders rely on it for access control.
    const guestToken = randomBytes(24).toString("base64url");

    // Card-transfer orders reserve stock only for a limited window — see
    // lib/reservation.ts for the hold duration and the release mechanism
    // (scripts/releaseExpiredReservations.ts, run on a schedule).
    const reservationExpiresAt =
      paymentMethod === "CARD_TRANSFER"
        ? new Date(Date.now() + CARD_TRANSFER_HOLD_HOURS * 60 * 60 * 1000)
        : null;

    // Order creation, item creation, stock decrement, and the discount's
    // usage-count increment all happen inside ONE database transaction.
    // If any step fails (out-of-stock race lost, discount limit hit in the
    // meantime, etc.) the whole transaction is rolled back automatically —
    // nothing is left half-applied (no orphaned order, no partially
    // decremented stock).
    const order = await db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          guestToken,
          userId: session?.user?.id,
          paymentMethod,
          // A wallet payment (full or, together with loyalty points, partial
          // but covering the whole remaining amount) is collected
          // immediately at the moment the order is created — there's no
          // gateway redirect or manual receipt to wait for — so the order is
          // created already PAID rather than going through PENDING_PAYMENT
          // first.
          status: isFullyPaidAtCreation ? "PAID" : undefined,
          reservationExpiresAt,
          subtotal, discountAmount, shippingFee, total,
          loyaltyPointsUsed: redeemPointsActual,
          loyaltyDiscount,
          walletAmountUsed,
          discountCode: appliedCode,
          shippingName, shippingPhone, shippingAddress, shippingCity, shippingPostal,
          items: { create: orderItemsData },
        },
      });

      if (isFullyPaidAtCreation) {
        await logOrderStatus(
          tx,
          created.id,
          "PAID",
          paymentMethod === "WALLET" ? "پرداخت کامل از طریق کیف پول" : "پرداخت کامل از طریق کیف پول و امتیاز باشگاه مشتریان"
        );
      } else {
        await logOrderStatus(tx, created.id, "PENDING_PAYMENT", "ثبت سفارش");
      }

      // Decrement stock now (reserve it while payment is pending), guarding
      // against a race with `stock: { gte: quantity }` so it can never go
      // negative even under concurrent orders. Variant stock and plain
      // product stock are decremented on their own respective tables.
      // Throwing here aborts and rolls back the entire transaction —
      // including the order and item rows just created above, and any
      // stock already decremented earlier in this same loop.
      for (const line of orderItemsData) {
        if (line.variantId) {
          const result = await tx.productVariant.updateMany({
            where: { id: line.variantId, stock: { gte: line.quantity } },
            data: { stock: { decrement: line.quantity } },
          });
          if (result.count === 0) {
            throw new Error(`موجودی «${line.nameSnapshot}» به‌تازگی تمام شد`);
          }
          await checkLowStockAfterDecrement(tx, { variantId: line.variantId, quantitySold: line.quantity, nameSnapshot: line.nameSnapshot });
        } else if (line.productId) {
          const result = await tx.product.updateMany({
            where: { id: line.productId, stock: { gte: line.quantity } },
            data: { stock: { decrement: line.quantity } },
          });
          if (result.count === 0) {
            throw new Error(`موجودی «${line.nameSnapshot}» به‌تازگی تمام شد`);
          }
          await checkLowStockAfterDecrement(tx, { productId: line.productId, quantitySold: line.quantity, nameSnapshot: line.nameSnapshot });
        }
      }

      if (appliedCode) {
        // Re-check and claim the usage limit atomically inside the
        // transaction — the read done above (before the transaction) could
        // be stale under concurrency. updateMany only matches (and only
        // increments) while the code is still under its usage limit, so
        // two concurrent checkouts can never both claim the last use.
        const claim = await tx.discount.updateMany({
          where: {
            code: appliedCode,
            isActive: true,
            OR: [{ usageLimit: null }, { usedCount: { lt: discountUsageLimit ?? undefined } }],
          },
          data: { usedCount: { increment: 1 } },
        });
        if (claim.count === 0) {
          throw new Error("ظرفیت این کد تخفیف تکمیل شده است");
        }
      }

      // Loyalty-point redemption debit (Phase 5) — claim-guarded exactly
      // like every other balance change in this transaction: re-checks the
      // REAL current point balance and only succeeds while it still covers
      // the amount being redeemed. `orderId` is deliberately left unset
      // (null) on this transaction row — unlike the earning-side
      // LoyaltyTransaction rows created by creditLoyaltyForOrder, which rely
      // on `orderId` being unique per order for idempotency — so a
      // redemption row never collides with (or blocks) that later credit.
      if (redeemPointsActual > 0) {
        const userId = session!.user!.id as string;
        const claim = await tx.user.updateMany({
          where: { id: userId, loyaltyPoints: { gte: redeemPointsActual } },
          data: { loyaltyPoints: { decrement: redeemPointsActual } },
        });
        if (claim.count === 0) {
          throw new Error("امتیاز باشگاه مشتریان شما برای این میزان استفاده کافی نیست");
        }
        await tx.loyaltyTransaction.create({
          data: { userId, points: -redeemPointsActual, reason: `استفاده در سفارش ${orderNumber}` },
        });
      }

      // Wallet debit (Phase 5) — covers both a full "WALLET" paymentMethod
      // and a partial wallet contribution alongside another payment method.
      // Claim-guarded like the point redemption above: re-checks the REAL
      // current balance from the database (never trusts anything the client
      // sent) and only succeeds while it actually covers walletAmountUsed;
      // if it doesn't (e.g. it changed since the page loaded), this throws
      // and the whole transaction — order, items, stock decrement, discount
      // claim, point redemption — rolls back together, exactly like an
      // out-of-stock line would.
      if (walletAmountUsed > 0) {
        const userId = session!.user!.id as string;
        const debit = await tx.user.updateMany({
          where: { id: userId, walletBalance: { gte: walletAmountUsed } },
          data: { walletBalance: { decrement: walletAmountUsed } },
        });
        if (debit.count === 0) {
          throw new Error("موجودی کیف پول شما برای این سفارش کافی نیست");
        }
        await tx.walletTransaction.create({
          data: { userId, amount: -walletAmountUsed, reason: `پرداخت سفارش ${orderNumber}`, orderId: created.id },
        });
      }

      if (isFullyPaidAtCreation && session?.user?.id) {
        // The order is already PAID at creation (fully covered by wallet
        // and/or loyalty redemption), so loyalty is credited right here
        // rather than waiting for a separate callback/approval step that
        // will never come for this order.
        await creditLoyaltyForOrder(tx, created.id, session.user.id as string, total);
      }

      return created;
    });

    // Only hand the guest token back to the browser when the order truly is
    // a guest order — a logged-in user's session is already the access
    // control, so there's no reason to mint or expose a bearer token for it.
    const isGuestOrder = !session?.user?.id;

    if (isFullyPaidAtCreation) {
      // Fully covered by the wallet and/or loyalty-point redemption at the
      // moment of creation — regardless of the nominal paymentMethod (a
      // partial wallet contribution can happen to cover 100% of a
      // ZARINPAL/CARD_TRANSFER order too), there's nothing further to
      // redirect to: no gateway, no receipt upload.
      return NextResponse.json({
        orderId: order.id,
        orderNumber: order.orderNumber,
        walletPaid: true,
        guestToken: isGuestOrder ? guestToken : undefined,
      });
    }

    if (paymentMethod === "CARD_TRANSFER") {
      // No gateway involved — the customer will pay by bank transfer and
      // upload a receipt; an admin reviews it manually (see /admin/card-transfers).
      // The remaining amount they need to transfer (order.total minus any
      // partial wallet contribution already collected) is shown on the
      // card-transfer instructions page itself, computed from the order's
      // own stored fields — not repeated here.
      return NextResponse.json({
        orderId: order.id,
        orderNumber: order.orderNumber,
        cardTransfer: true,
        guestToken: isGuestOrder ? guestToken : undefined,
      });
    }

    const callbackUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/payment/callback?orderId=${order.id}`;
    const payment = await paymentProvider.requestPayment({
      orderId: order.id,
      orderNumber: order.orderNumber,
      // The gateway only ever collects the REMAINING amount after any
      // partial wallet contribution and loyalty discount — never the full
      // order.total when part of it was already covered at checkout.
      amountToman: remainingDue,
      description: `سفارش ${order.orderNumber}`,
      callbackUrl,
    });

    if (!payment.ok) {
      return NextResponse.json({
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentError: true,
        guestToken: isGuestOrder ? guestToken : undefined,
      });
    }

    await db.order.update({ where: { id: order.id }, data: { paymentAuthority: payment.authority } });

    return NextResponse.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      redirectUrl: payment.redirectUrl,
      guestToken: isGuestOrder ? guestToken : undefined,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "خطا در ثبت سفارش" }, { status: 400 });
  }
}
