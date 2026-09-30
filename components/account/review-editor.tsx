"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Star } from "lucide-react";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";

export const REVIEW_SUCCESS = "نظر شما ثبت شد و پس از بررسی منتشر خواهد شد.";
export const REVIEW_STATUS_LABEL: Record<string, string> = { pending: "در انتظار بررسی", approved: "منتشر شده", rejected: "رد شده" };
export const REVIEW_STATUS_CLS: Record<string, string> = { pending: "bg-warning/15 text-warning", approved: "bg-success/12 text-success", rejected: "bg-hot/12 text-hot" };

export function StatusChip({ status }: { status: string }) {
  return <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", REVIEW_STATUS_CLS[status])} data-testid="review-status">{REVIEW_STATUS_LABEL[status] ?? status}</span>;
}

export interface ReviewDraft { id: string; rating: number; title: string | null; body: string }

/**
 * Create (order + product) or edit-and-resubmit (review id) form. The client only sends rating/title/body (+ the order/product it
 * wants to review); status, verified purchase and order item are decided by the server.
 */
export function ReviewEditor({ target, initial, onClose }: { target: { orderNumber: number; productId: string } | { reviewId: string }; initial?: ReviewDraft; onClose?: () => void }) {
  const router = useRouter();
  const [rating, setRating] = useState(initial?.rating ?? 5);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const payload = { rating, title: title.trim() || undefined, body };
    const r = "reviewId" in target ? await api("PATCH", `/api/reviews/${target.reviewId}`, payload) : await api("POST", "/api/reviews", { ...target, ...payload });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, t: r.error.message });
    setMsg({ ok: true, t: REVIEW_SUCCESS });
    router.refresh();
    setTimeout(() => onClose?.(), 1800);
  }
  return (
    <form onSubmit={submit} className="w-full space-y-3 rounded-xl bg-surface-2 p-3 text-sm" data-testid="review-form">
      <div className="flex gap-1" role="radiogroup" aria-label="امتیاز">
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} role="radio" aria-checked={rating === n} aria-label={`${n} ستاره`} onClick={() => setRating(n)} className="cursor-pointer p-0.5">
            <Star className={cn("size-6", n <= rating ? "fill-warning text-warning" : "text-border")} />
          </button>
        ))}
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="عنوان (اختیاری)" aria-label="عنوان نظر" className="h-11 w-full rounded-xl border border-border bg-surface px-4" />
      <textarea required minLength={5} maxLength={1500} rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="تجربه خود را بنویسید…" aria-label="متن نظر" className="w-full rounded-xl border border-border bg-surface px-4 py-3 leading-7" />
      {msg && <p role="status" className={cn("text-xs", msg.ok ? "text-success" : "text-hot")}>{msg.t}</p>}
      <div className="flex gap-2">
        <button disabled={busy || msg?.ok} className="h-10 cursor-pointer rounded-xl bg-primary px-6 text-xs font-bold text-primary-fg disabled:opacity-60">{"reviewId" in target ? "ویرایش و ارسال مجدد" : "ثبت نظر"}</button>
        {onClose && <button type="button" onClick={onClose} className="h-10 cursor-pointer rounded-xl border border-border px-4 text-xs">انصراف</button>}
      </div>
    </form>
  );
}
