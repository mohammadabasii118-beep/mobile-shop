import { adminRoute } from "@/lib/server/admin/core";
import { listAudit } from "@/lib/server/admin/misc";

export const GET = adminRoute("audit.read", (req) => listAudit(req));
