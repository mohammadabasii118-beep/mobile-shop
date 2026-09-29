/**
 * Releases stock reserved by card-transfer ("کارت‌به‌کارت") orders whose
 * hold window has expired without an approved receipt.
 *
 * Run with: npx tsx scripts/releaseExpiredReservations.ts
 *
 * How the hold works (see lib/reservation.ts): every CARD_TRANSFER order
 * gets a `reservationExpiresAt` timestamp (default: 24 hours from
 * checkout, configurable via the CARD_TRANSFER_HOLD_HOURS env var). While
 * an order is PENDING_PAYMENT and past that timestamp, this script cancels
 * it and atomically gives its reserved stock back to inventory (via the
 * same race-safe cancelOrderAtomic() used by the admin panel and the
 * Zarinpal callback, so it can never double-restore stock even if this
 * script and an admin click "cancel" on the same order at the same time).
 *
 * This does NOT run automatically — schedule it yourself, e.g. with a
 * cron entry that runs it every 15 minutes (minute field "0,15,30,45" —
 * written this way, instead of the equivalent "*(/)15" step syntax, so this
 * comment block's own closing "*(/)" isn't accidentally triggered early):
 *
 *   0,15,30,45 * * * * cd /path/to/caseline-shop && npx tsx scripts/releaseExpiredReservations.ts >> /var/log/caseline-release.log 2>&1
 *
 * or an equivalent scheduled job on your hosting platform (systemd timer,
 * a platform "cron job" / "scheduled task" feature, etc).
 */
import { db } from "@/lib/db";
import { cancelOrderAtomic } from "@/lib/orderLifecycle";

async function main() {
  const expired = await db.order.findMany({
    where: {
      paymentMethod: "CARD_TRANSFER",
      status: "PENDING_PAYMENT",
      reservationExpiresAt: { lt: new Date() },
    },
    select: { id: true, orderNumber: true },
  });

  if (expired.length === 0) {
    console.log("No expired card-transfer reservations to release.");
    return;
  }

  console.log(`Found ${expired.length} expired reservation(s). Releasing...`);
  for (const order of expired) {
    const result = await cancelOrderAtomic(order.id, "مهلت رزرو موجودی برای پرداخت کارت‌به‌کارت به پایان رسید");
    console.log(
      result.canceled
        ? `  ✓ ${order.orderNumber}: canceled, stock restored`
        : `  – ${order.orderNumber}: already resolved by something else, skipped`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
