import { adminRoute } from "@/lib/server/admin/core";
import { listTickets } from "@/lib/server/admin/misc";

export const GET = adminRoute("support.read", (req) => listTickets(req));
