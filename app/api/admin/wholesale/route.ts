import { adminRoute } from "@/lib/server/admin/core";
import { listApplications } from "@/lib/server/admin/wholesale";

export const GET = adminRoute("wholesale.review", (req) => listApplications(req));
