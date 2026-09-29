"use server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireAdmin } from "./guard";
import { detectImageType, MAX_IMAGE_SIZE, IMAGE_TYPE_EXTENSION } from "@/lib/fileValidation";
import { logOrderStatus } from "@/lib/orderStatusHistory";
import { creditLoyaltyForOrder } from "@/lib/loyalty";

// Stored outside the public/ folder on purpose — receipts are private and
// must only ever reach the browser through the authenticated route handler
// at app/api/receipts/[filename]/route.ts.
const RECEIPTS_DIR = path.join(process.cwd(), "private-uploads", "receipts");

// Abuse-prevention limits for requirement #4 (rate-limit receipt submission).
const MAX_RECEIPTS_PER_ORDER = 5;
const MIN_SECONDS_BETWEEN_SUBMISSIONS = 30;

// Requirement #1: a guest order must never be reachable by order id alone.
// If the order has no owning user, the caller must present the exact
// guestToken that was issued when the order was created (or be an admin).
async function assertCanAccessOrder(orderId: string, guestToken?: string | null) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("سفارش پیدا نشد");

  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";

  if (order.userId) {
    const isOwner = session?.user?.id === order.userId;
    if (!isOwner && !isAdmin) throw new Error("دسترسی غیرمجاز");
  } else if (!isAdmin) {
    if (!order.guestToken || !guestToken || guestToken !== order.guestToken) {
      throw new Error("دسترسی غیرمجاز");
    }
  }
  return order;
}

export async function submitReceipt(
  orderId: string,
  guestToken: string | null,
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const order = await assertCanAccessOrder(orderId, guestToken);

    // Only an order still awaiting payment can receive a new receipt — this
    // also blocks submissions against an order that has already been
    // canceled (e.g. its stock reservation expired and was released), not
    // just ones that are already paid/processing/shipped/delivered.
    if (order.status !== "PENDING_PAYMENT") {
      return {
        error:
          order.status === "CANCELED"
            ? "این سفارش لغو شده است و دیگر امکان ارسال رسید برای آن وجود ندارد."
            : "این سفارش قبلاً پرداخت‌شده تلقی شده است",
      };
    }

    // Requirement #4: rate-limit abuse of receipt submission.
    const existingReceipts = await db.cardTransferReceipt.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "desc" },
    });
    if (existingReceipts.length >= MAX_RECEIPTS_PER_ORDER) {
      return { error: "تعداد دفعات ارسال رسید برای این سفارش به حداکثر رسیده است. لطفاً با پشتیبانی تماس بگیرید." };
    }
    if (existingReceipts.some((r) => r.status === "PENDING")) {
      return { error: "یک رسید برای این سفارش در انتظار بررسی است. لطفاً منتظر نتیجه بمانید." };
    }
    const last = existingReceipts[0];
    if (last && Date.now() - last.createdAt.getTime() < MIN_SECONDS_BETWEEN_SUBMISSIONS * 1000) {
      return { error: "لطفاً کمی صبر کنید و دوباره تلاش کنید." };
    }

    const file = formData.get("file") as File | null;
    const trackingCode = (formData.get("trackingCode") as string) || null;

    if (!file || file.size === 0) return { error: "لطفاً تصویر رسید را انتخاب کنید" };
    if (file.size > MAX_IMAGE_SIZE) return { error: "حجم فایل نباید بیشتر از ۵ مگابایت باشد" };

    // Requirement #3: verify the REAL file type on the server (magic bytes),
    // never trust the browser-supplied file.type or extension.
    const buffer = Buffer.from(await file.arrayBuffer());
    const detected = detectImageType(buffer);
    if (!detected) return { error: "فقط فایل تصویری معتبر (jpg, png, webp, gif) مجاز است" };

    const ext = IMAGE_TYPE_EXTENSION[detected];
    const filename = `${order.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await mkdir(RECEIPTS_DIR, { recursive: true });
    await writeFile(path.join(RECEIPTS_DIR, filename), buffer);

    // Requirement #7: creating the receipt NEVER changes order.status. The
    // order stays PENDING_PAYMENT until an admin manually approves it.
    await db.cardTransferReceipt.create({
      data: { orderId: order.id, imageFile: filename, trackingCode, status: "PENDING" },
    });

    revalidatePath(`/checkout/card-transfer/${order.id}`);
    revalidatePath("/admin/card-transfers");
    revalidatePath(`/admin/orders/${order.id}`);
    revalidatePath(`/account/orders/${order.id}`);
    return { ok: true };
  } catch (e: any) {
    return { error: e?.message || "خطا در ثبت رسید" };
  }
}

export async function reviewReceipt(
  receiptId: string,
  action: "APPROVE" | "REJECT",
  reason?: string
) {
  // Requirement #5: only an ADMIN-role session can approve/reject.
  await requireAdmin();

  const receipt = await db.cardTransferReceipt.findUnique({ where: { id: receiptId }, include: { order: true } });
  if (!receipt) throw new Error("رسید پیدا نشد");

  // Requirement #6: approve/reject happens inside a DB transaction using a
  // conditional "claim" pattern — updateMany only succeeds if the receipt is
  // still PENDING, so two concurrent/duplicate review calls can never both
  // succeed. The order's status flip to PAID happens in the SAME
  // transaction as the claim (also via a conditional updateMany, so a
  // meanwhile-canceled order — e.g. its stock reservation expired — can
  // never be flipped back to PAID by approving a stale receipt), so
  // approval and status-change are atomic together.
  await db.$transaction(async (tx) => {
    const claim = await tx.cardTransferReceipt.updateMany({
      where: { id: receiptId, status: "PENDING" },
      data:
        action === "APPROVE"
          ? { status: "APPROVED", reviewedAt: new Date(), rejectReason: null }
          : { status: "REJECTED", reviewedAt: new Date(), rejectReason: reason || "نامشخص" },
    });
    if (claim.count === 0) {
      throw new Error("این رسید قبلاً بررسی شده است");
    }
    if (action === "APPROVE") {
      const orderClaim = await tx.order.updateMany({
        where: { id: receipt.orderId, status: "PENDING_PAYMENT" },
        data: { status: "PAID" },
      });
      if (orderClaim.count === 0) {
        // Order is no longer awaiting payment (already paid through
        // another receipt, or canceled — e.g. its reservation expired).
        // Throwing here rolls back the receipt claim above too, so the
        // receipt is left exactly as it was for the admin to re-check.
        throw new Error("وضعیت این سفارش تغییر کرده (مثلاً لغو شده) و دیگر قابل تأیید نیست");
      }
      await logOrderStatus(tx, receipt.orderId, "PAID", "رسید کارت‌به‌کارت توسط مدیر تأیید شد");
      await creditLoyaltyForOrder(tx, receipt.orderId, receipt.order.userId, receipt.order.total);
    }
    // On REJECT, the order stays PENDING_PAYMENT so the customer can
    // upload a new receipt.
  });

  revalidatePath("/admin/card-transfers");
  revalidatePath(`/admin/orders/${receipt.orderId}`);
  revalidatePath(`/checkout/card-transfer/${receipt.orderId}`);
  revalidatePath(`/account/orders/${receipt.orderId}`);
}
