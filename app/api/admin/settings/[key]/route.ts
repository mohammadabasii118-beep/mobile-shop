import { adminRoute } from "@/lib/server/admin/core";
import { updateSetting } from "@/lib/server/admin/settings";

export const PUT = adminRoute<{ key: string }>("settings.write", async (req, p, a) => updateSetting(p.key, await req.json().catch(() => ({})), a));
