import { adminRoute } from "@/lib/server/admin/core";
import { createResource, listResource, resource } from "@/lib/server/admin/crud";

type P = { resource: string };
// Permission is resolved from the resource registry on the server for every call.
export const GET = adminRoute<P>((_r, p) => resource(p.resource).perm, (req, p) => listResource(p.resource, req));
export const POST = adminRoute<P>((_r, p) => resource(p.resource).perm, async (req, p, a) => createResource(p.resource, await req.json().catch(() => ({})), a));
