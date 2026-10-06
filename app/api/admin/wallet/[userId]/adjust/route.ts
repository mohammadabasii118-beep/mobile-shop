import { adminRoute } from "@/lib/server/admin/core";
import { adjustWallet } from "@/lib/server/admin/finance";

export const POST = adminRoute<{ userId: string }>("wallet.adjust", async (req, p, a) => adjustWallet(p.userId, await req.json().catch(() => ({})), a));
