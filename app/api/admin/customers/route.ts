import { adminRoute } from "@/lib/server/admin/core";
import { listCustomers, listRoles } from "@/lib/server/admin/customers";

export const GET = adminRoute("customer.read", async (req) => {
  const list = await listCustomers(req);
  return new URL(req.url).searchParams.get("roles") ? { ...list, roles: await listRoles() } : list;
});
