import { adminRoute } from "@/lib/server/admin/core";
import { createUser, listCustomers, listRoles } from "@/lib/server/admin/customers";

export const GET = adminRoute("customer.read", async (req) => {
  const list = await listCustomers(req);
  return new URL(req.url).searchParams.get("roles") ? { ...list, roles: await listRoles() } : list;
});

/** Manual account creation: a plain customer (customer.write) or an admin (role.manage; checked in the service). */
export const POST = adminRoute(["customer.write", "role.manage"], async (req, _p, a) => createUser(await req.json().catch(() => ({})), a), { maxBody: 8_000 });
