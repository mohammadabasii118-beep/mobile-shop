import { adminRoute } from "@/lib/server/admin/core";
import { dashboardData } from "@/lib/server/admin/misc";

export const GET = adminRoute("dashboard.view", () => dashboardData());
