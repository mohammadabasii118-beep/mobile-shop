import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { partnerOverview } from "@/lib/server/wholesale-portal";

export const GET = route(async (req) => (await partnerOverview(await requireUser(), (req.nextUrl.searchParams.get("q") ?? "").slice(0, 60))) ?? { tier: null });
