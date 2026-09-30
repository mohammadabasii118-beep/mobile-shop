import { adminRoute } from "@/lib/server/admin/core";
import { listDiscounts } from "@/lib/server/admin/pricing";

export const GET = adminRoute("discount.write", (req) => listDiscounts(req));
