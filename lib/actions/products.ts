"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { productSchema } from "@/lib/validation";
import { requireAdmin } from "./guard";

function parseForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return productSchema.parse(raw);
}

// Turns admin-entered "key: value" lines into a plain object for the
// Product.specs JSON column. Lines without a ":" are ignored rather than
// guessed at, and an empty result is stored as null (no invented specs).
function parseSpecsText(text?: string): Record<string, string> | null {
  if (!text) return null;
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key && value) out[key] = value;
  }
  return Object.keys(out).length ? out : null;
}

export async function createProduct(formData: FormData) {
  await requireAdmin();
  const data = parseForm(formData);
  const images = (data.images || "").split("\n").map((s) => s.trim()).filter(Boolean);
  await db.product.create({
    data: {
      name: data.name, slug: data.slug, description: data.description,
      price: data.price, oldPrice: data.oldPrice || null, costPrice: data.costPrice || null,
      wholesalePrice: data.wholesalePrice || null,
      stock: data.stock, categoryId: data.categoryId, brandId: data.brandId || null,
      phoneModelId: data.phoneModelId || null, images,
      specs: parseSpecsText(data.specsText) ?? Prisma.DbNull,
      isActive: !!data.isActive, isBestSeller: !!data.isBestSeller, isNew: !!data.isNew,
      isFeatured: !!data.isFeatured, isTrending: !!data.isTrending,
      hasVariants: !!data.hasVariants,
    },
  });
  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export async function updateProduct(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(formData);
  const images = (data.images || "").split("\n").map((s) => s.trim()).filter(Boolean);
  await db.product.update({
    where: { id },
    data: {
      name: data.name, slug: data.slug, description: data.description,
      price: data.price, oldPrice: data.oldPrice || null, costPrice: data.costPrice || null,
      wholesalePrice: data.wholesalePrice || null,
      stock: data.stock, categoryId: data.categoryId, brandId: data.brandId || null,
      phoneModelId: data.phoneModelId || null, images,
      specs: parseSpecsText(data.specsText) ?? Prisma.DbNull,
      isActive: !!data.isActive, isBestSeller: !!data.isBestSeller, isNew: !!data.isNew,
      isFeatured: !!data.isFeatured, isTrending: !!data.isTrending,
      hasVariants: !!data.hasVariants,
    },
  });
  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  await db.product.delete({ where: { id } });
  revalidatePath("/admin/products");
}
