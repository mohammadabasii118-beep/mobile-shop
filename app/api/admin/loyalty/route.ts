import { adminRoute } from "@/lib/server/admin/core";
import { listLoyalty } from "@/lib/server/admin/misc";

export const GET = adminRoute("loyalty.read", (req) => listLoyalty(req));
