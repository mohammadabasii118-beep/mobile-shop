import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { quoteCheckout } from "@/lib/server/checkout";
import { quoteQuerySchema } from "@/lib/server/validation";

export const dynamic = "force-dynamic";
export const GET = route(async (req) => {
  const user = await requireUser();
  const q = quoteQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return quoteCheckout(user, q);
});
