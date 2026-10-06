import { adminRoute } from "@/lib/server/admin/core";
import { walletOf } from "@/lib/server/admin/finance";

export const GET = adminRoute<{ userId: string }>("wallet.read", (req, p) => walletOf(p.userId, req));
