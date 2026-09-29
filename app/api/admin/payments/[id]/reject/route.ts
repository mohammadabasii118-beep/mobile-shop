import { adminRoute } from "@/lib/server/admin/core";
import { reject } from "@/lib/server/admin/orders";
import { parseJson } from "@/lib/server/http";
import { rejectSchema } from "@/lib/server/validation";

export const POST = adminRoute<{ id: string }>("payment.review", async (req, p, a) => reject(p.id, (await parseJson(req, rejectSchema)).reason, a));
