"use client";
import { useState } from "react";
import { ReviewEditor, StatusChip, type ReviewDraft } from "@/components/account/review-editor";

/** Per-item review action on a DELIVERED order: «ثبت نظر» when none exists, otherwise the status (rejected → edit & resubmit). */
export function ItemReview({ orderNumber, productId, review }: { orderNumber: number; productId: string; review: (ReviewDraft & { status: string; rejectionReason: string | null }) | null }) {
  const [open, setOpen] = useState(false);
  if (open) return <ReviewEditor target={review ? { reviewId: review.id } : { orderNumber, productId }} initial={review ?? undefined} onClose={() => setOpen(false)} />;
  return (
    <div className="flex w-full flex-wrap items-center gap-2 text-xs" data-testid="item-review">
      {!review ? <button type="button" onClick={() => setOpen(true)} className="h-9 cursor-pointer rounded-[10px] bg-primary px-4 text-xs font-bold text-primary-fg" data-testid="review-open">ثبت نظر</button> : (
        <>
          <span className="text-muted">نظر شما ثبت شده</span><StatusChip status={review.status} />
          {review.status === "rejected" && <>{review.rejectionReason && <span className="text-hot">دلیل: {review.rejectionReason}</span>}<button type="button" onClick={() => setOpen(true)} className="h-9 cursor-pointer rounded-[10px] border border-border px-4 font-bold">ویرایش و ارسال مجدد</button></>}
        </>
      )}
    </div>
  );
}
