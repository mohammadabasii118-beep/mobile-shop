import { adminRoute } from "@/lib/server/admin/core";
import { deleteResource, getResource, resource, updateResource } from "@/lib/server/admin/crud";

type P = { resource: string; id: string };
const perm = (_r: unknown, p: P) => resource(p.resource).perm;
export const GET = adminRoute<P>(perm, (_req, p) => getResource(p.resource, p.id));
export const PATCH = adminRoute<P>(perm, async (req, p, a) => updateResource(p.resource, p.id, await req.json().catch(() => ({})), a));
export const DELETE = adminRoute<P>(perm, (_req, p, a) => deleteResource(p.resource, p.id, a));
