"use server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireAdmin } from "./guard";
import { partnerApplicationSchema } from "@/lib/validation";

export type PartnerApplyState = { error?: string; success?: boolean };

/**
 * Submits a new wholesale/reseller partnership application for the
 * logged-in user. Requires login (rather than a bare email field) so every
 * application is unambiguously tied to one real account — the same account
 * that gets isWholesale=true if it's later approved.
 */
export async function submitPartnerApplication(formData: FormData): Promise<PartnerApplyState> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "برای ارسال درخواست همکاری ابتدا وارد حساب کاربری شوید" };

  const parsed = partnerApplicationSchema.safeParse({
    companyName: formData.get("companyName"),
    phone: formData.get("phone"),
    city: formData.get("city"),
    message: formData.get("message"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "اطلاعات نامعتبر است" };

  const userId = session.user.id as string;

  const pending = await db.partnerApplication.findFirst({ where: { userId, status: "PENDING" } });
  if (pending) return { error: "شما یک درخواست در انتظار بررسی دارید. لطفاً منتظر نتیجه بمانید." };

  await db.partnerApplication.create({
    data: {
      userId,
      companyName: parsed.data.companyName || null,
      phone: parsed.data.phone,
      city: parsed.data.city || null,
      message: parsed.data.message,
    },
  });

  revalidatePath("/partners");
  revalidatePath("/admin/partners");
  return { success: true };
}

export async function getMyPartnerApplications() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return [];
  return db.partnerApplication.findMany({
    where: { userId: session.user.id as string },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Approves or rejects an application. Approving is the ONLY code path in
 * the whole project allowed to set User.isWholesale = true — done here,
 * inside the same transaction as the status change, so a user is never
 * flagged wholesale without an actually-approved application on record.
 */
export async function reviewPartnerApplication(id: string, action: "APPROVE" | "REJECT", note?: string) {
  await requireAdmin();

  const application = await db.partnerApplication.findUnique({ where: { id } });
  if (!application) throw new Error("درخواست پیدا نشد");
  if (application.status !== "PENDING") throw new Error("این درخواست قبلاً بررسی شده است");

  await db.$transaction(async (tx) => {
    const claim = await tx.partnerApplication.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: action === "APPROVE" ? "APPROVED" : "REJECTED",
        reviewedAt: new Date(),
        reviewNote: note || null,
      },
    });
    if (claim.count === 0) throw new Error("این درخواست قبلاً بررسی شده است");

    if (action === "APPROVE") {
      await tx.user.update({ where: { id: application.userId }, data: { isWholesale: true } });
    }
  });

  revalidatePath("/admin/partners");
  revalidatePath("/partners");
}
