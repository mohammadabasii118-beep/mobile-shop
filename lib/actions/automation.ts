"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "./guard";
import { automationRuleSchema } from "@/lib/validation";

export async function createAutomationRule(formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const data = automationRuleSchema.parse(raw);

  await db.automationRule.create({
    data: {
      name: data.name,
      trigger: data.trigger,
      action: data.action,
      isActive: data.isActive ?? true,
      actionConfig: data.action === "GRANT_LOYALTY_BONUS" ? { points: data.points || 0 } : undefined,
    },
  });

  revalidatePath("/admin/automation");
  redirect("/admin/automation");
}

export async function toggleAutomationRule(id: string, isActive: boolean) {
  await requireAdmin();
  await db.automationRule.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/automation");
}

export async function deleteAutomationRule(id: string) {
  await requireAdmin();
  await db.automationRule.delete({ where: { id } });
  revalidatePath("/admin/automation");
}

export async function markAlertRead(id: string, isRead: boolean) {
  await requireAdmin();
  await db.adminAlert.update({ where: { id }, data: { isRead } });
  revalidatePath("/admin/alerts");
  revalidatePath("/admin");
}
