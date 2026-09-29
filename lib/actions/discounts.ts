"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { discountSchema } from "@/lib/validation";
import { requireAdmin } from "./guard";

function parseForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return discountSchema.parse(raw);
}

function toData(data: ReturnType<typeof discountSchema.parse>) {
  return {
    code: data.code,
    type: data.type,
    value: data.value,
    minOrderAmount: data.minOrderAmount || null,
    usageLimit: data.usageLimit || null,
    startsAt: data.startsAt ? new Date(data.startsAt) : null,
    endsAt: data.endsAt ? new Date(data.endsAt) : null,
    isActive: !!data.isActive,
  };
}

export async function createDiscount(formData: FormData) {
  await requireAdmin();
  const data = parseForm(formData);
  await db.discount.create({ data: toData(data) });
  revalidatePath("/admin/discounts");
  redirect("/admin/discounts");
}

export async function updateDiscount(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(formData);
  await db.discount.update({ where: { id }, data: toData(data) });
  revalidatePath("/admin/discounts");
  redirect("/admin/discounts");
}

export async function deleteDiscount(id: string) {
  await requireAdmin();
  await db.discount.delete({ where: { id } });
  revalidatePath("/admin/discounts");
}
