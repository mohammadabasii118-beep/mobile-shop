import { adminRoute } from "@/lib/server/admin/core";
import { approveApplication } from "@/lib/server/admin/wholesale";

export const POST = adminRoute<{ id: string }>("wholesale.review", async (req, p, a) => approveApplication(p.id, await req.json().catch(() => ({})), a));
