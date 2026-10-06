import { adminRoute } from "@/lib/server/admin/core";
import { listInventory } from "@/lib/server/admin/inventory";

export const GET = adminRoute(["inventory.write", "product.read"], (req) => listInventory(req));
