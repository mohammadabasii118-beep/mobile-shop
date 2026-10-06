import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { myApplication } from "@/lib/server/wholesale-portal";

export const GET = route(async () => myApplication((await requireUser()).id));
