import { adminRoute } from "@/lib/server/admin/core";
import { createProduct, listProducts } from "@/lib/server/admin/products";

export const GET = adminRoute("product.read", (req) => listProducts(req));
export const POST = adminRoute("product.write", async (req, _p, a) => createProduct(await req.json().catch(() => ({})), a));
