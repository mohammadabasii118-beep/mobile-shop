import { adminRoute } from "@/lib/server/admin/core";
import { listPricing } from "@/lib/server/admin/pricing";

export const GET = adminRoute("pricing.read", (req) => listPricing(req));
