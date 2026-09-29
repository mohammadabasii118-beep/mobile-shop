"use client";
import { useState } from "react";
import { Card, Empty, ErrorBox, Pager, Pill, Spinner, act, btnDanger, btnGhost, btnPrimary, confirmAsk, fmtDate, useApi } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

interface R { id: string; rating: number; body: string; status: string; createdAt: string; product: { name: string; slug: string }; user: { displayName: string | null; phone: string } }
const TABS = [["pending", "در انتظار"], ["approved", "تأیید شده"], ["rejected", "رد شده"]] as const;

export function ReviewsClient() {
  const [tab, setTab] = useState<string>("pending"); const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<{ items: R[]; total: number; page: number; pages: number }>(`/api/admin/reviews?status=${tab}&page=${page}`);
  const set = async (id: string, status: string) => { const r = await act("PATCH", `/api/admin/reviews/${id}`, { status }, "ثبت شد."); if (r.ok) reload(); };
  const del = async (id: string) => { if (confirmAsk("نظر حذف شود؟")) { const r = await act("DELETE", `/api/admin/reviews/${id}`, undefined, "حذف شد."); if (r.ok) reload(); } };
  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-lg bg-surface p-1 shadow-sm" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setPage(1); }} className={cn("h-9 cursor-pointer rounded-md px-4 text-sm font-bold", tab === k ? "bg-primary text-primary-fg" : "hover:bg-surface-2")}>{l}</button>)}</div>
      {error ? <ErrorBox message={error} /> : loading ? <Spinner /> : !data?.items.length ? <Empty /> : (
        <>
          <div className="space-y-3">{data.items.map((r) => (
            <Card key={r.id} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><b>{r.product.name}</b><Pill tone="warn">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</Pill></div>
              <p className="text-sm leading-7">{r.body}</p>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted"><span>{r.user.displayName ?? r.user.phone} · {fmtDate(r.createdAt)}</span>
                <span className="flex gap-2">{r.status !== "approved" && <button className={cn(btnPrimary, "h-8 px-3 text-xs")} onClick={() => set(r.id, "approved")}>تأیید</button>}{r.status !== "rejected" && <button className={cn(btnGhost, "h-8 px-3 text-xs")} onClick={() => set(r.id, "rejected")}>رد</button>}<button className={cn(btnDanger, "h-8 px-3 text-xs")} onClick={() => del(r.id)}>حذف</button></span></div>
            </Card>
          ))}</div>
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
