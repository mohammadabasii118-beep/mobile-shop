import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { openAttachment } from "@/lib/server/support";

export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const f = await openAttachment(await requireUser(), (await params).id);
  return new Response(f.stream, { headers: { "content-type": f.mime, "content-length": String(f.size), "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'" } });
});
