import { route } from "@/lib/server/http";
import { notFound } from "@/lib/server/errors";
import { requireUser } from "@/lib/server/auth/guard";
import { getUserOrder } from "@/lib/server/orders";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ number: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const u = await requireUser();
  const n = Number((await params).number);
  const order = Number.isInteger(n) ? await getUserOrder(u.id, n) : null;
  if (!order) throw notFound("سفارش پیدا نشد."); // same answer for "does not exist" and "belongs to someone else"
  return order;
});
