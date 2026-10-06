"use client";
import { useState } from "react";
import { ReviewCard, Stars, type ReviewView } from "@/components/review-parts";
import { toFa } from "@/lib/utils";

export interface Summary { count: number; avg: number; dist: number[] }

export function ProductReviews({ slug, summary, initial, hasMore: more0 }: { slug: string; summary: Summary; initial: ReviewView[]; hasMore: boolean }) {
  const [items, setItems] = useState(initial);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(more0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const load = async () => {
    setBusy(true); setErr(false);
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(slug)}/reviews?page=${page + 1}`);
      const j = await res.json();
      if (!j.ok) throw new Error();
      setItems((cur) => [...cur, ...j.data.items.filter((n: ReviewView) => !cur.some((c) => c.id === n.id))]);
      setMore(j.data.hasMore); setPage((p) => p + 1);
    } catch { setErr(true); }
    setBusy(false);
  };
  if (!summary.count) return <p className="text-muted">هنوز نظری ثبت نشده است.</p>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-6 rounded-md bg-surface-2 p-4" data-testid="review-summary">
        <div className="text-center"><div className="text-3xl font-extrabold" data-testid="review-avg">{toFa(summary.avg)}</div><Stars value={summary.avg} className="mt-1" /><div className="mt-1 text-[11px] text-muted">{toFa(summary.count)} نظر</div></div>
        <ul className="min-w-48 flex-1 space-y-1" aria-label="توزیع امتیازها">
          {[5, 4, 3, 2, 1].map((n) => {
            const c = summary.dist[n - 1] ?? 0;
            return <li key={n} className="flex items-center gap-2 text-[11px]" data-testid={`dist-${n}`}><span className="w-10 shrink-0 text-muted">{toFa(n)} ستاره</span><span className="h-2 flex-1 overflow-hidden rounded-full bg-border"><span className="block h-full rounded-full bg-warning" style={{ width: `${(c / summary.count) * 100}%` }} /></span><span className="w-6 text-end">{toFa(c)}</span></li>;
          })}
        </ul>
      </div>
      <div className="space-y-3" data-testid="review-list">{items.map((r) => <ReviewCard key={r.id} r={r} />)}</div>
      {more && <button type="button" onClick={load} disabled={busy} className="mx-auto block cursor-pointer rounded-md border border-border px-5 py-2 text-xs font-bold hover:bg-surface-2 disabled:opacity-50" data-testid="reviews-more">{busy ? "در حال بارگذاری…" : "نمایش نظرات بیشتر"}</button>}
      {err && <p className="text-center text-xs text-error">دریافت نظرات ناموفق بود؛ دوباره تلاش کنید.</p>}
    </div>
  );
}
