import { adminRoute } from "@/lib/server/admin/core";
import { requestChanges } from "@/lib/server/admin/wholesale";

export const POST = adminRoute<{ id: string }>("wholesale.review", async (req, p, a) => requestChanges(p.id, await req.json().catch(() => ({})), a));
