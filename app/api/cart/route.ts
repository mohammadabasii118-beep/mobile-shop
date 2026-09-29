import { route } from "@/lib/server/http";
import { getCurrentUser } from "@/lib/server/auth/session";
import { getCartView } from "@/lib/server/cart";

export const dynamic = "force-dynamic";
export const GET = route(async () => getCartView(await getCurrentUser()));
