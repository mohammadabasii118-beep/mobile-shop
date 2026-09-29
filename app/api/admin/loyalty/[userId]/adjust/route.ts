import { adminRoute } from "@/lib/server/admin/core";
import { adjustLoyalty } from "@/lib/server/admin/finance";

export const POST = adminRoute<{ userId: string }>("loyalty.adjust", async (req, p, a) => adjustLoyalty(p.userId, await req.json().catch(() => ({})), a));
