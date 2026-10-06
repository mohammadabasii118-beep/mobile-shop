import { adminRoute } from "@/lib/server/admin/core";
import { deleteReview, moderateReview } from "@/lib/server/admin/misc";

export const PATCH = adminRoute<{ id: string }>("review.moderate", async (req, p, a) => moderateReview(p.id, await req.json().catch(() => ({})), a));
export const DELETE = adminRoute<{ id: string }>("review.moderate", (_r, p, a) => deleteReview(p.id, a));
