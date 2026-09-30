import { adminRoute } from "@/lib/server/admin/core";
import { priceHistoryList } from "@/lib/server/admin/pricing";

export const GET = adminRoute("pricing.read", (req) => priceHistoryList(req));
