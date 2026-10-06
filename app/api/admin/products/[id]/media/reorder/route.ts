import { adminRoute } from "@/lib/server/admin/core";
import { mediaReorderSchema, reorderMedia } from "@/lib/server/admin/media";

type P = { id: string };
export const POST = adminRoute<P>("product.write", async (req, p, a) => reorderMedia(p.id, mediaReorderSchema.parse(await req.json().catch(() => ({}))).ids, a));
