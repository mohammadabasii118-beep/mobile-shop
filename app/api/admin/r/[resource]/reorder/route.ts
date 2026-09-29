import { adminRoute } from "@/lib/server/admin/core";
import { reorderResource, resource } from "@/lib/server/admin/crud";

type P = { resource: string };
export const POST = adminRoute<P>((_r, p) => resource(p.resource).perm, async (req, p, a) => reorderResource(p.resource, await req.json().catch(() => ({})), a));
