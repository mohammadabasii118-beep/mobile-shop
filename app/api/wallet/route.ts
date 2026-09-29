import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { walletHistory } from "@/lib/server/finance/wallet";

export const GET = route(async (req) => {
  const user = await requireUser();
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
  return walletHistory(user.id, 20, (page - 1) * 20);
});
