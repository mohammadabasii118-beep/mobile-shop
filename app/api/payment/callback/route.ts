import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { paymentProvider } from "@/lib/payment";
import { cancelOrderAtomic } from "@/lib/orderLifecycle";
import { logOrderStatus } from "@/lib/orderStatusHistory";
import { creditLoyaltyForOrder } from "@/lib/loyalty";

// A previous callback attempt that crashed or hung mid-verification leaves
// its lock behind; after this long, a fresh callback hit is allowed to
// reclaim and retry instead of the order being stuck forever.
const LOCK_STALE_MS = 2 * 60 * 1000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("orderId");
  const authority = url.searchParams.get("Authority") || url.searchParams.get("authority");
  const status = url.searchParams.get("Status");
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  if (!orderId) return NextResponse.redirect(`${site}/checkout/success?error=1`);

  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.redirect(`${site}/checkout/success?error=1`);

  // Already resolved (paid/canceled/etc. by an earlier callback hit, or by
  // an admin action) — just report the current state, don't touch stock or
  // status again.
  if (order.status !== "PENDING_PAYMENT") {
    return NextResponse.redirect(`${site}/checkout/success?order=${order.orderNumber}&status=${order.status === "PAID" ? "paid" : "failed"}`);
  }

  // Claim the order for processing with a conditional updateMany BEFORE
  // calling out to the gateway or touching stock — this is what makes the
  // callback safe against duplicate/concurrent hits for the same order
  // (the payment gateway itself, a user refreshing the callback URL, or a
  // gateway retry can all trigger this route more than once). Only the
  // request that wins this claim proceeds; everyone else just reports the
  // latest state instead of re-verifying or re-crediting/re-debiting stock.
  const claim = await db.order.updateMany({
    where: {
      id: order.id,
      status: "PENDING_PAYMENT",
      OR: [{ paymentLockedAt: null }, { paymentLockedAt: { lt: new Date(Date.now() - LOCK_STALE_MS) } }],
    },
    data: { paymentLockedAt: new Date() },
  });

  if (claim.count === 0) {
    // Another request is currently processing (or just finished
    // processing) this exact order — don't race it, just report its
    // latest known state.
    const fresh = await db.order.findUnique({ where: { id: order.id } });
    const st = fresh?.status === "PAID" ? "paid" : fresh?.status === "CANCELED" ? "failed" : "pending";
    return NextResponse.redirect(`${site}/checkout/success?order=${order.orderNumber}&status=${st}`);
  }

  try {
    if (status === "NOK") {
      // Customer canceled at the gateway. cancelOrderAtomic atomically
      // flips the order to CANCELED and restores stock (and is itself
      // race-safe against, e.g., the admin canceling it at the same time).
      await cancelOrderAtomic(order.id, "پرداخت توسط مشتری در درگاه لغو شد");
      return NextResponse.redirect(`${site}/checkout/success?order=${order.orderNumber}&status=canceled`);
    }

    // Verify against what was ACTUALLY requested from the gateway at
    // checkout — order.total minus any partial wallet contribution already
    // collected there (Phase 5), never the full order.total when part of it
    // was covered another way.
    const gatewayAmount = order.total - order.walletAmountUsed;
    const verify = await paymentProvider.verifyPayment(authority || order.paymentAuthority || "", gatewayAmount);
    if (verify.ok) {
      await db.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { status: "PAID", paymentRefId: verify.refId, paymentLockedAt: null },
        });
        await logOrderStatus(tx, order.id, "PAID", "پرداخت آنلاین تأیید شد (زرین‌پال)");
        await creditLoyaltyForOrder(tx, order.id, order.userId, order.total);
      });
      return NextResponse.redirect(`${site}/checkout/success?order=${order.orderNumber}&status=paid`);
    }

    await cancelOrderAtomic(order.id, "تأیید پرداخت توسط درگاه ناموفق بود");
    return NextResponse.redirect(`${site}/checkout/success?order=${order.orderNumber}&status=failed`);
  } catch (e) {
    // Something unexpected (e.g. the gateway request itself threw) —
    // release the lock so a legitimate future retry isn't blocked forever,
    // and leave the order PENDING_PAYMENT rather than guessing at a final
    // state.
    await db.order.updateMany({
      where: { id: order.id, status: "PENDING_PAYMENT" },
      data: { paymentLockedAt: null },
    });
    return NextResponse.redirect(`${site}/checkout/success?order=${order.orderNumber}&status=pending`);
  }
}
