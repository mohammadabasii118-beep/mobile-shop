import { adminRoute } from "@/lib/server/admin/core";
import { adjustStock } from "@/lib/server/admin/inventory";

export const POST = adminRoute<{ variantId: string }>("inventory.write", async (req, p, a) => adjustStock(p.variantId, await req.json().catch(() => ({})), a));
