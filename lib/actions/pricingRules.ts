"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { pricingRuleSchema } from "@/lib/validation";
import { requireAdmin } from "./guard";

function parseForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return pricingRuleSchema.parse(raw);
}

export async function createPricingRule(formData: FormData) {
  await requireAdmin();
  const data = parseForm(formData);
  await db.pricingRule.create({ data: { ...data, isActive: !!data.isActive } });
  revalidatePath("/admin/pricing-rules");
  redirect("/admin/pricing-rules");
}

export async function updatePricingRule(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(formData);
  await db.pricingRule.update({ where: { id }, data: { ...data, isActive: !!data.isActive } });
  revalidatePath("/admin/pricing-rules");
  redirect("/admin/pricing-rules");
}

export async function deletePricingRule(id: string) {
  await requireAdmin();
  await db.pricingRule.delete({ where: { id } });
  revalidatePath("/admin/pricing-rules");
}
