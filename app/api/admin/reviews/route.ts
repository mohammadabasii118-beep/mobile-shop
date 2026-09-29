import { adminRoute } from "@/lib/server/admin/core";
import { listReviews } from "@/lib/server/admin/misc";

export const GET = adminRoute("review.moderate", (req) => listReviews(req));
