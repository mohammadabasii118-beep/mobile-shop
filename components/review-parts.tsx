import { BadgeCheck } from "lucide-react";
import { cn, formatDateFa, toFa } from "@/lib/utils";

export function Stars({ value, className, size }: { value: number; className?: string; size?: string }) {
  // `size` is kept for callers; the star size is 14px (a CSS variable can override it via className).
  void size;
  return <span className={cn("cl-stars", className)} style={{ "--n": Math.max(0, Math.min(5, Math.round(value))) } as React.CSSProperties} role="img" aria-label={`امتیاز ${toFa(value)} از ۵`} />;
}

export function VerifiedBadge() {
  return <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[10.5px] font-bold text-success" data-testid="verified-badge"><BadgeCheck className="size-3" aria-hidden />✓ خرید تأییدشده</span>;
}

export interface ReviewView { id: string; name: string; rating: number; title: string | null; body: string; verified: boolean; createdAt: string; reply: string | null }

/** Plain-text rendering only (React escapes everything); newlines are preserved with CSS. */
export function ReviewCard({ r }: { r: ReviewView }) {
  return (
    <article className="rounded-md bg-surface-2 p-4" data-testid="review-item">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2"><b>{r.name}</b>{r.verified && <VerifiedBadge />}</span>
        <Stars value={r.rating} />
      </div>
      {r.title && <h3 className="mt-2 font-extrabold">{r.title}</h3>}
      <p className="mt-1 whitespace-pre-line text-muted">{r.body}</p>
      <time dateTime={r.createdAt} className="mt-2 block text-[11px] text-muted">{formatDateFa(r.createdAt)}</time>
      {r.reply && <p className="mt-2 rounded-md bg-primary/10 p-2 text-xs"><b className="text-primary">پاسخ فروشگاه: </b>{r.reply}</p>}
    </article>
  );
}
