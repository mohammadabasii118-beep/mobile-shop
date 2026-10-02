import { api, parseBody } from "@/lib/api";
import { productSchema } from "@/services/products/schema";
import { createProduct, listProducts } from "@/services/products";

export const GET = api(() => listProducts());
export const POST = api(async ({ request }) => createProduct(await parseBody(request, productSchema)), { role: "editor" });
