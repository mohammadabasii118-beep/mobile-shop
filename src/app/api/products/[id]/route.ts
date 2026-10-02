import { api, notFound, parseBody } from "@/lib/api";
import { deleteProduct, updateProduct } from "@/services/products";
import { productSchema } from "@/services/products/schema";

export const PATCH = api<{ id: string }>(async ({ request, params }) => {
  const p = updateProduct(params.id, await parseBody(request, productSchema.partial()));
  if (!p) throw notFound("Product");
  return p;
}, { role: "editor" });

export const DELETE = api<{ id: string }>(({ params }) => {
  if (!deleteProduct(params.id)) throw notFound("Product");
  return { ok: true };
}, { role: "editor" });
