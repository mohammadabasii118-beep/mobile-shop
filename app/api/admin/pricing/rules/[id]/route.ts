import { adminRoute } from "@/lib/server/admin/core";
import { deleteRule } from "@/lib/server/admin/pricing";

export const DELETE = adminRoute<{ id: string }>("pricing.write", async (req, p, a) => deleteRule(p.id, await req.json().catch(() => ({})), a));
