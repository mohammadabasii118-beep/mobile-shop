import { adminRoute } from "@/lib/server/admin/core";
import { deleteProduct, getProduct, updateProduct } from "@/lib/server/admin/products";

type P = { id: string };
export const GET = adminRoute<P>("product.read", (_r, p, a) => getProduct(p.id, { cost: a.admin.permissions.includes("pricing.read") || a.admin.permissions.includes("pricing.write") }));
export const PATCH = adminRoute<P>("product.write", async (req, p, a) => updateProduct(p.id, await req.json().catch(() => ({})), a));
export const DELETE = adminRoute<P>("product.delete", (_r, p, a) => deleteProduct(p.id, a));
