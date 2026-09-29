import { adminRoute } from "@/lib/server/admin/core";
import { revokePartner, setPartnerTier } from "@/lib/server/admin/wholesale";

export const PATCH = adminRoute<{ userId: string }>("wholesale.review", async (req, p, a) => setPartnerTier(p.userId, await req.json().catch(() => ({})), a));
export const DELETE = adminRoute<{ userId: string }>("wholesale.review", (_r, p, a) => revokePartner(p.userId, a));
