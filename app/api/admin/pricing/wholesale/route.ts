import { adminRoute } from "@/lib/server/admin/core";
import { wholesaleConflicts } from "@/lib/server/admin/pricing";

export const GET = adminRoute("pricing.read", () => wholesaleConflicts());
