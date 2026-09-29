import { db } from "@/lib/db";
import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { getLoyaltyRules } from "@/lib/server/finance/loyalty";

export const GET = route(async () => {
  const user = await requireUser();
  const [acc, rules] = await Promise.all([db.loyaltyAccount.findUnique({ where: { userId: user.id }, include: { transactions: { orderBy: { createdAt: "desc" }, take: 50 } } }), getLoyaltyRules()]);
  return { points: acc?.points ?? 0, items: acc?.transactions ?? [], rules };
});
