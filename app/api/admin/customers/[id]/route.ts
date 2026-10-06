import { adminRoute } from "@/lib/server/admin/core";
import { getCustomer, updateCustomer } from "@/lib/server/admin/customers";

export const GET = adminRoute<{ id: string }>("customer.read", (_r, p) => getCustomer(p.id));
export const PATCH = adminRoute<{ id: string }>("customer.write", async (req, p, a) => updateCustomer(p.id, await req.json().catch(() => ({})), a));
