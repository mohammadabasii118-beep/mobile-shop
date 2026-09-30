import { adminRoute } from "@/lib/server/admin/core";
import { targets } from "@/lib/server/admin/pricing";

export const GET = adminRoute(["pricing.read", "pricing.write", "discount.write", "product.write"], (req) => targets(req));
