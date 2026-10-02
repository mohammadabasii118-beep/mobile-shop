import { getDb, nextId } from "@/database/store";
import type { Product } from "@/types";

export const listProducts = () => getDb().products;

export function createProduct(input: Omit<Product, "id">) {
  const p: Product = { id: nextId("p"), ...input };
  getDb().products.unshift(p);
  return p;
}
export function updateProduct(id: string, patch: Partial<Omit<Product, "id">>) {
  const p = getDb().products.find((x) => x.id === id);
  if (!p) return null;
  Object.assign(p, patch);
  return p;
}
export function deleteProduct(id: string) {
  const db = getDb();
  const before = db.products.length;
  db.products = db.products.filter((x) => x.id !== id);
  return db.products.length < before;
}
