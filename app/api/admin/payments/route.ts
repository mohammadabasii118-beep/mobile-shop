import { adminRoute } from "@/lib/server/admin/core";
import { listPayments } from "@/lib/server/admin/orders";

export const GET = adminRoute("payment.review", (req) => listPayments(req));
