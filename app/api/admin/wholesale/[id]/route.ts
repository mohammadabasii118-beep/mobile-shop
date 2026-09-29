import { adminRoute } from "@/lib/server/admin/core";
import { getApplication } from "@/lib/server/admin/wholesale";

export const GET = adminRoute<{ id: string }>("wholesale.review", (_r, p) => getApplication(p.id));
