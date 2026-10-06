import { adminRoute } from "@/lib/server/admin/core";
import { rejectApplication } from "@/lib/server/admin/wholesale";

export const POST = adminRoute<{ id: string }>("wholesale.review", async (req, p, a) => rejectApplication(p.id, await req.json().catch(() => ({})), a));
