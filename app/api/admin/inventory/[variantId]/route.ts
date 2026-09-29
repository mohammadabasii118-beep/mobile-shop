import { adminRoute } from "@/lib/server/admin/core";
import { movements } from "@/lib/server/admin/inventory";

export const GET = adminRoute<{ variantId: string }>(["inventory.write", "product.read"], (_r, p) => movements(p.variantId));
