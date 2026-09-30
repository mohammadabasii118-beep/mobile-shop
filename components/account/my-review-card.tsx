"use client";
import Link from "next/link";
import { useState } from "react";
import { ReviewEditor, StatusChip } from "@/components/account/review-editor";
import { Stars, VerifiedBadge } from "@/components/review-parts";
import { formatDateFa } from "@/lib/utils";

export interface MyReview { id: string; status: string; rating: number; title: string | null; body: string; verified: boolean; rejectionReason: string | null; createdAt: string; reply: string | null; product: { name: string; slug: string; img: string | null } }

export function MyReviewCard({ r }: { r: MyReview }) {
  const [edit, setEdit] = useState(false);
  return (
    <article className="rounded-2xl border border-border p-4" data-testid="my-review">
      <div className="flex items-start gap-3">
        <span className="size-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">{r.product.img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.product.img} alt="" className="size-full object-cover" loading="lazy" width={56} height={56} />
        )}</span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2"><Link href={`/product/${r.product.slug}`} className="line-clamp-1 text-sm font-bold hover:text-primary">{r.product.name}</Link><StatusChip status={r.status} />{r.verified && <VerifiedBadge />}</div>
          <div className="flex items-center gap-2 text-[11px] text-muted"><Stars value={r.rating} /><time dateTime={r.createdAt}>{formatDateFa(r.createdAt)}</time></div>
          {r.title && <h3 className="text-sm font-black">{r.title}</h3>}
          <p className="whitespace-pre-line text-[13px] leading-7 text-muted">{r.body}</p>
          {r.status === "rejected" && r.rejectionReason && <p className="rounded-lg bg-hot/10 p-2 text-xs"><b>دلیل رد: </b>{r.rejectionReason}</p>}
          {r.reply && <p className="rounded-lg bg-primary/10 p-2 text-xs"><b className="text-primary">پاسخ فروشگاه: </b>{r.reply}</p>}
        </div>
      </div>
      {r.status === "rejected" && !edit && <button type="button" onClick={() => setEdit(true)} className="mt-3 h-10 cursor-pointer rounded-xl border border-border px-4 text-xs font-bold" data-testid="review-edit">ویرایش و ارسال مجدد</button>}
      {edit && <div className="mt-3"><ReviewEditor target={{ reviewId: r.id }} initial={{ id: r.id, rating: r.rating, title: r.title, body: r.body }} onClose={() => setEdit(false)} /></div>}
    </article>
  );
}
