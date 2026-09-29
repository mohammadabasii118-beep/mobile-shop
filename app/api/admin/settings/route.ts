import { adminRoute } from "@/lib/server/admin/core";
import { getAllSettings } from "@/lib/server/admin/settings";

export const GET = adminRoute("settings.write", () => getAllSettings());
