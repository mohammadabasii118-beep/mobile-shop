import { adminRoute } from "@/lib/server/admin/core";
import { listWallets } from "@/lib/server/admin/misc";

export const GET = adminRoute("wallet.read", (req) => listWallets(req));
