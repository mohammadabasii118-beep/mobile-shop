import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { listUserOrders } from "@/lib/server/orders";

export const dynamic = "force-dynamic";
export const GET = route(async () => {
  const u = await requireUser();
  const orders = await listUserOrders(u.id);
  return orders.map((o) => ({ number: o.number, status: o.status, paymentStatus: o.paymentStatus, total: o.total, createdAt: o.createdAt, items: o.items.map((i) => i.name) }));
});
