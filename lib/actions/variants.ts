"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { variantSchema } from "@/lib/validation";
import { requireAdmin } from "./guard";

function parseForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const data = variantSchema.parse(raw);
  return {
    brandId: data.brandId || null,
    phoneModelId: data.phoneModelId || null,
    colorId: data.colorId || null,
    sku: data.sku || null,
    price: data.price,
    oldPrice: data.oldPrice === "" || data.oldPrice === undefined ? null : Number(data.oldPrice),
    wholesalePrice: data.wholesalePrice === "" || data.wholesalePrice === undefined ? null : Number(data.wholesalePrice),
    stock: data.stock,
    imageUrl: data.imageUrl || null,
    isActive: !!data.isActive,
  };
}

// Postgres treats NULL as distinct in a unique index, so the schema-level
// @@unique([productId, brandId, phoneModelId, colorId]) constraint alone
// won't catch every duplicate combination (e.g. two variants with the same
// brand+model and no color at all). This app-level check closes that gap.
async function assertNoDuplicate(
  productId: string,
  brandId: string | null,
  phoneModelId: string | null,
  colorId: string | null,
  excludeId?: string
) {
  const existing = await db.productVariant.findFirst({
    where: {
      productId,
      brandId,
      phoneModelId,
      colorId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  if (existing) throw new Error("این ترکیب برند/مدل/رنگ قبلاً برای این محصول ثبت شده است");
}

export async function createVariant(productId: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(formData);
  await assertNoDuplicate(productId, data.brandId, data.phoneModelId, data.colorId);

  await db.$transaction([
    db.productVariant.create({ data: { ...data, productId } }),
    db.product.update({ where: { id: productId }, data: { hasVariants: true } }),
  ]);

  revalidatePath(`/admin/products/${productId}/variants`);
  redirect(`/admin/products/${productId}/variants`);
}

export async function updateVariant(variantId: string, productId: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(formData);
  await assertNoDuplicate(productId, data.brandId, data.phoneModelId, data.colorId, variantId);
  await db.productVariant.update({ where: { id: variantId }, data });
  revalidatePath(`/admin/products/${productId}/variants`);
  redirect(`/admin/products/${productId}/variants`);
}

export async function deleteVariant(variantId: string, productId: string) {
  await requireAdmin();
  await db.productVariant.delete({ where: { id: variantId } });
  const remaining = await db.productVariant.count({ where: { productId } });
  if (remaining === 0) {
    await db.product.update({ where: { id: productId }, data: { hasVariants: false } });
  }
  revalidatePath(`/admin/products/${productId}/variants`);
}
