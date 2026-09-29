import { adminRoute } from "@/lib/server/admin/core";
import { loyaltyOf } from "@/lib/server/admin/finance";

export const GET = adminRoute<{ userId: string }>("loyalty.read", (_r, p) => loyaltyOf(p.userId));
