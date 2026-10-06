import { adminRoute } from "@/lib/server/admin/core";
import { setRoles } from "@/lib/server/admin/customers";

export const POST = adminRoute<{ id: string }>("role.manage", async (req, p, a) => setRoles(p.id, await req.json().catch(() => ({})), a));
