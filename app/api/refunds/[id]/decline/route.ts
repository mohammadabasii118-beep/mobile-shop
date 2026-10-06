import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { declineWalletRefund } from "@/lib/server/finance/refunds";

export const POST = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => declineWalletRefund(await requireUser(), (await params).id));
