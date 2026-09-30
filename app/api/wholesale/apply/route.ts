import { route, parseJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { applyAsUser, partnerApplySchema } from "@/lib/server/wholesale-register";

/** A signed-in customer asks to become a wholesale partner; staff review it in the admin panel. The application is always PENDING. */
export const POST = route(async (req) => applyAsUser(await requireUser(), await parseJson(req, partnerApplySchema)));
