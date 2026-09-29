import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// Read-only lookup of the current user's real wallet balance and loyalty
// points, used by the checkout page to decide whether to offer/allow the
// "pay from wallet" option and a loyalty-point redemption amount. Never
// trust a client-sent balance/points — the checkout route itself re-checks
// these same numbers from the database again before actually
// debiting/redeeming anything.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ balance: null, loyaltyPoints: null });
  const user = await db.user.findUnique({ where: { id: session.user.id as string }, select: { walletBalance: true, loyaltyPoints: true } });
  return NextResponse.json({ balance: user?.walletBalance ?? 0, loyaltyPoints: user?.loyaltyPoints ?? 0 });
}
