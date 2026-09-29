import { adminRoute } from "@/lib/server/admin/core";
import { approve } from "@/lib/server/admin/orders";

export const POST = adminRoute<{ id: string }>("payment.review", (_req, p, a) => approve(p.id, a));
