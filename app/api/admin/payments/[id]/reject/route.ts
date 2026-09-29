import { parseJson, route } from "@/lib/server/http";
import { requirePermission, requireUser } from "@/lib/server/auth/guard";
import { rejectPayment } from "@/lib/server/payments/service";
import { rejectSchema } from "@/lib/server/validation";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const admin = await requireUser();
  requirePermission(admin, "payment.review");
  const { reason } = await parseJson(req, rejectSchema);
  return rejectPayment((await params).id, admin.id, reason);
});
