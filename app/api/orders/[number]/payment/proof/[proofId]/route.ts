import { NextRequest } from "next/server";
import { AppError } from "@/lib/server/errors";
import { requireUser } from "@/lib/server/auth/guard";
import { openProof } from "@/lib/server/payments/service";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ number: string; proofId: string }> };

// Private download: only the order owner or staff holding payment.review. Never cacheable, never sniffed.
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { number, proofId } = await params;
    const obj = await openProof(user, Number(number), proofId);
    return new Response(obj.stream, {
      headers: { "Content-Type": obj.mime, "Content-Length": String(obj.size), "Content-Disposition": "inline", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" },
    });
  } catch (e) {
    if (e instanceof AppError) return Response.json({ ok: false, error: { code: e.code, message: e.message } }, { status: e.status });
    return Response.json({ ok: false, error: { code: "not_found", message: "پیدا نشد." } }, { status: 404 });
  }
}
