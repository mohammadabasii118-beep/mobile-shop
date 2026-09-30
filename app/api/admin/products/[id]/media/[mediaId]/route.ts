import { adminRoute } from "@/lib/server/admin/core";
import { deleteMedia, mediaPatchSchema, updateMedia } from "@/lib/server/admin/media";

type P = { id: string; mediaId: string };
export const PATCH = adminRoute<P>("product.write", async (req, p, a) => updateMedia(p.id, p.mediaId, mediaPatchSchema.parse(await req.json().catch(() => ({}))), a));
export const DELETE = adminRoute<P>("product.write", (_r, p, a) => deleteMedia(p.id, p.mediaId, a));
