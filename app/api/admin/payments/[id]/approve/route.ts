import { route } from "@/lib/server/http";
import { requirePermission, requireUser } from "@/lib/server/auth/guard";
import { approvePayment } from "@/lib/server/payments/service";

type Ctx = { params: Promise<{ id: string }> };

// Backend for the Phase 3 admin screen: enforced on the server with the payment.review permission.
export const POST = route<Ctx>(async (_req, { params }) => {
  const admin = await requireUser();
  requirePermission(admin, "payment.review");
  return approvePayment((await params).id, admin.id);
});
