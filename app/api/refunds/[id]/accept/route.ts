import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { acceptWalletRefund } from "@/lib/server/finance/refunds";

export const POST = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => acceptWalletRefund(await requireUser(), (await params).id));
