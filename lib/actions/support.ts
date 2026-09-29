"use server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireStaffPermission } from "./guard";
import { ticketSchema, ticketReplySchema } from "@/lib/validation";
import { runAutomationRules } from "@/lib/automation";

async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("برای ارسال تیکت پشتیبانی ابتدا وارد حساب کاربری شوید");
  return session.user.id as string;
}

/** Opens a new ticket with its first message, both from the real logged-in user. */
export async function createTicket(formData: FormData) {
  const userId = await requireUserId();
  const raw = Object.fromEntries(formData.entries());
  const data = ticketSchema.parse(raw);

  const ticket = await db.$transaction(async (tx) => {
    const created = await tx.supportTicket.create({
      data: { userId, subject: data.subject, status: "OPEN" },
    });
    await tx.supportMessage.create({
      data: { ticketId: created.id, senderRole: "CUSTOMER", body: data.body },
    });
    await runAutomationRules(tx, "NEW_SUPPORT_TICKET", {
      message: `تیکت پشتیبانی جدید: ${data.subject}`,
      link: `/admin/support/${created.id}`,
    });
    return created;
  });

  revalidatePath("/account/support");
  revalidatePath("/admin/support");
  return { id: ticket.id };
}

/**
 * A customer's reply to their OWN ticket. Ownership is re-checked against
 * the real session on every call — a ticket id alone (guessed or shared)
 * is never enough to post into someone else's thread.
 */
export async function customerReplyToTicket(ticketId: string, formData: FormData) {
  const userId = await requireUserId();
  const raw = Object.fromEntries(formData.entries());
  const data = ticketReplySchema.parse(raw);

  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId }, select: { userId: true, status: true } });
  if (!ticket || ticket.userId !== userId) throw new Error("تیکت پیدا نشد");

  await db.$transaction(async (tx) => {
    await tx.supportMessage.create({ data: { ticketId, senderRole: "CUSTOMER", body: data.body } });
    // A customer reply always means "waiting on an admin again" — even if
    // an admin had just closed it, replying reopens the conversation
    // rather than silently posting into a dead ticket.
    await tx.supportTicket.update({ where: { id: ticketId }, data: { status: "OPEN" } });
  });

  revalidatePath(`/account/support/${ticketId}`);
  revalidatePath("/admin/support");
}

/**
 * An admin OR a staff account with the "SUPPORT" permission replying to
 * any ticket. `senderRole` is stored as "ADMIN" for both — Phase 8's
 * Role-reuse design predates the STAFF role added in Phase 9, and from
 * the customer's point of view "an agent replied" is the accurate,
 * honest framing either way (they were never told exactly which staff
 * member answers a ticket, only that support did).
 */
export async function adminReplyToTicket(ticketId: string, formData: FormData) {
  await requireStaffPermission("SUPPORT");
  const raw = Object.fromEntries(formData.entries());
  const data = ticketReplySchema.parse(raw);

  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true } });
  if (!ticket) throw new Error("تیکت پیدا نشد");

  await db.$transaction(async (tx) => {
    await tx.supportMessage.create({ data: { ticketId, senderRole: "ADMIN", body: data.body } });
    await tx.supportTicket.update({ where: { id: ticketId }, data: { status: "ANSWERED" } });
  });

  revalidatePath(`/account/support/${ticketId}`);
  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath("/admin/support");
}

export async function closeTicket(ticketId: string) {
  await requireStaffPermission("SUPPORT");
  await db.supportTicket.update({ where: { id: ticketId }, data: { status: "CLOSED" } });
  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath("/admin/support");
}
