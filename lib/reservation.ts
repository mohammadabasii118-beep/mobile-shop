// How long stock stays reserved for a card-transfer ("کارت‌به‌کارت") order
// that hasn't been approved yet. Configurable via env var so it can be
// tuned without a code change; defaults to 24 hours, a reasonable window
// for a customer to pay and upload a receipt.
//
// Release mechanism: scripts/releaseExpiredReservations.ts finds
// PENDING_PAYMENT card-transfer orders whose reservationExpiresAt has
// passed, cancels them, and atomically restores their stock — the same
// claim-based, race-safe path used by the admin "cancel order" action
// (see lib/orderLifecycle.ts's cancelOrderAtomic). Run it on a schedule
// (cron, systemd timer, or a hosting platform's scheduled job) — see the
// README for the exact command and a suggested interval.
export const CARD_TRANSFER_HOLD_HOURS = Number(process.env.CARD_TRANSFER_HOLD_HOURS || 24);
