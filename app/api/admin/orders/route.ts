import { adminRoute } from "@/lib/server/admin/core";
import { listOrders } from "@/lib/server/admin/orders";

export const GET = adminRoute("order.read", (req) => listOrders(req));
