import { adminRoute } from "@/lib/server/admin/core";
import { bulkPricing } from "@/lib/server/admin/pricing";

export const POST = adminRoute("pricing.write", async (req, _p, a) => bulkPricing(await req.json().catch(() => ({})), a));
