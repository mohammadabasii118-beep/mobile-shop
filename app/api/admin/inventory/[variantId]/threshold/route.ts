import { adminRoute } from "@/lib/server/admin/core";
import { setThreshold } from "@/lib/server/admin/inventory";

export const POST = adminRoute<{ variantId: string }>("inventory.write", async (req, p, a) => setThreshold(p.variantId, await req.json().catch(() => ({})), a));
