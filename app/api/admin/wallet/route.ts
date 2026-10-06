import { adminRoute } from "@/lib/server/admin/core";
import { listWallets } from "@/lib/server/admin/finance";

export const GET = adminRoute("wallet.read", (req) => listWallets(req));
