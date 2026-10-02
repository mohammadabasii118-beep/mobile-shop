import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(1).max(120), sku: z.string().min(1).max(40), category: z.string().min(1),
  price: z.coerce.number().int().min(0), stock: z.coerce.number().int().min(0),
  status: z.enum(["active", "draft", "out_of_stock"]),
});
