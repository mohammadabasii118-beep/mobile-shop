"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaffPermission } from "./guard";

export async function markContactMessageRead(id: string, isRead: boolean) {
  await requireStaffPermission("SUPPORT");
  await db.contactMessage.update({ where: { id }, data: { isRead } });
  revalidatePath("/admin/contact-messages");
}
