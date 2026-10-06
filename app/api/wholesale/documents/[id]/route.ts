import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { deleteDocument, openDocument } from "@/lib/server/wholesale-portal";

type Ctx = { params: Promise<{ id: string }> };
export const GET = route<Ctx>(async (_req, { params }) => {
  const f = await openDocument(await requireUser(), (await params).id);
  return new Response(f.stream, { headers: { "content-type": f.mime, "content-length": String(f.size), "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'" } });
});
export const DELETE = route<Ctx>(async (_req, { params }) => deleteDocument(await requireUser(), (await params).id));
