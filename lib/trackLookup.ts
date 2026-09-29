import { db } from "@/lib/db";

// Rate limiting for the public "track my order" form (order number +
// shipping phone). Knowing an order number is not secret by itself, so
// without this limit an attacker who has (or guesses) an order number
// could brute-force the shipping phone number. Keyed by order number so
// attempts against a single order — regardless of source IP — are capped.
const MAX_ATTEMPTS = 8;
const WINDOW_MINUTES = 15;

async function fetchOrder(orderNumber: string) {
  return db.order.findUnique({
    where: { orderNumber },
    include: {
      items: true,
      receipts: { orderBy: { createdAt: "desc" }, take: 1 },
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });
}

export type TrackedOrder = NonNullable<Awaited<ReturnType<typeof fetchOrder>>>;

export type TrackLookupResult =
  | { ok: true; order: TrackedOrder }
  | { ok: false; reason: "rate_limited" | "not_found" | "requires_login" };

export async function lookupOrderForTracking(
  orderNumber: string,
  phone: string,
  ip: string | null
): Promise<TrackLookupResult> {
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const recentAttempts = await db.trackLookupAttempt.count({
    where: { orderNumber, createdAt: { gte: windowStart } },
  });

  // Record this attempt regardless of outcome, so repeated guesses against
  // the same order number keep counting toward the limit.
  await db.trackLookupAttempt.create({ data: { orderNumber, ip: ip || undefined } });

  if (recentAttempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: "rate_limited" };
  }

  const order = await fetchOrder(orderNumber);
  if (!order || order.shippingPhone !== phone) {
    return { ok: false, reason: "not_found" };
  }

  // Requirement: private order details are only ever shown through owner
  // authentication (a logged-in session for that user) or a secure token
  // (the guestToken flow used elsewhere) — never through the order-number
  // + phone combination alone when the order is tied to a registered
  // account. Guest orders (no account) may still use this public form,
  // since there is no account to log into.
  if (order.userId) {
    return { ok: false, reason: "requires_login" };
  }

  return { ok: true, order };
}
