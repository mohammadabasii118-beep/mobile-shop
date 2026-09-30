"use client";
import Link from "next/link";
import { useState } from "react";
import { Card, Empty, ErrorBox, Pager, Pill, Spinner, act, btnDanger, btnGhost, btnPrimary, confirmAsk, fmtDate, inputCls, useApi } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

interface R {
  id: string; rating: number; title: string | null; body: string; status: string; verifiedPurchase: boolean; rejectionReason: string | null; adminReply: string | null; createdAt: string;
  product: { id: string; name: string; slug: string }; user: { id: string; displayName: string | null; phone: string }; order: { number: number; status: string } | null;
}
interface Stats { pending: number; approved: number; rejected: number; avgRating: number }
const TABS = [["pending", "در انتظار"], ["approved", "تأیید شده"], ["rejected", "رد شده"]] as const;

export function ReviewsClient({ initialStatus = "pending", initialProductId = "" }: { initialStatus?: string; initialProductId?: string }) {
  const [tab, setTab] = useState<string>(initialStatus); const [page, setPage] = useState(1);
  const [q, setQ] = useState(""); const [qs, setQs] = useState(""); const [rating, setRating] = useState(""); const [productId, setProductId] = useState(initialProductId);
  const { data, error, loading, reload } = useApi<{ items: R[]; total: number; page: number; pages: number; stats: Stats }>(`/api/admin/reviews?status=${tab}&page=${page}&q=${encodeURIComponent(qs)}${rating ? `&rating=${rating}` : ""}${productId ? `&productId=${productId}` : ""}`);
  const set = async (id: string, status: string, reason?: string) => { const r = await act("PATCH", `/api/admin/reviews/${id}`, { status, ...(reason ? { reason } : {}) }, "ثبت شد."); if (r.ok) reload(); };
  const [replying, setReplying] = useState<string | null>(null); const [text, setText] = useState("");
  const [rejecting, setRejecting] = useState<string | null>(null); const [reason, setReason] = useState("");
  const sendReply = async (id: string) => { const r = await act("POST", `/api/admin/reviews/${id}/reply`, { reply: text }, "پاسخ ذخیره شد."); if (r.ok) { setReplying(null); reload(); } };
  const del = async (id: string) => { if (confirmAsk("نظر حذف شود؟")) { const r = await act("DELETE", `/api/admin/reviews/${id}`, undefined, "حذف شد."); if (r.ok) reload(); } };
  const st = data?.stats;
  return (
    <div>
      {st && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="review-stats">
          {([["در انتظار", st.pending], ["تأیید شده", st.approved], ["رد شده", st.rejected], ["میانگین امتیاز", st.approved ? st.avgRating.toLocaleString("fa-IR") : "—"]] as const).map(([l, v]) => (
            <Card key={l}><div className="text-xs text-muted">{l}</div><div className="mt-1 text-xl font-black">{typeof v === "number" ? v.toLocaleString("fa-IR") : v}</div></Card>
          ))}
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-surface p-1 shadow-sm" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setPage(1); }} className={cn("h-9 cursor-pointer rounded-md px-4 text-sm", tab === k ? "bg-primary font-bold text-primary-fg" : "text-muted hover:bg-surface-2")}>{l}</button>)}</div>
        <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); setQs(q.trim()); setPage(1); }}>
          <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو در متن، محصول یا کاربر…" aria-label="جستجو" />
          <select className={cn(inputCls, "w-32")} value={rating} onChange={(e) => { setRating(e.target.value); setPage(1); }} aria-label="امتیاز"><option value="">همه امتیازها</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n.toLocaleString("fa-IR")} ستاره</option>)}</select>
          <button className={btnGhost}>جستجو</button>
        </form>
        {productId && <button className={cn(btnGhost, "h-9 text-xs")} onClick={() => { setProductId(""); setPage(1); }}>حذف فیلتر محصول ×</button>}
      </div>
      {error ? <ErrorBox message={error} /> : loading ? <Spinner /> : !data?.items.length ? <Empty /> : (
        <>
          <div className="space-y-3">{data.items.map((r) => (
            <Card key={r.id} className="space-y-2" data-testid="review-row">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="flex flex-wrap items-center gap-2"><Link href={`/product/${r.product.slug}`} className="font-bold hover:text-primary">{r.product.name}</Link><button className="cursor-pointer text-[11px] text-primary" onClick={() => { setProductId(r.product.id); setPage(1); }}>فقط این محصول</button></span>
                <span className="flex items-center gap-2">{r.verifiedPurchase && <Pill tone="ok">✓ خرید تأییدشده</Pill>}<Pill tone="warn">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</Pill></span>
              </div>
              {r.title && <h3 className="text-sm font-black">{r.title}</h3>}
              <p className="whitespace-pre-line text-sm leading-7">{r.body}</p>
              {r.status === "rejected" && r.rejectionReason && <p className="rounded-lg bg-hot/10 p-2 text-xs"><b>دلیل رد: </b>{r.rejectionReason}</p>}
              {r.adminReply && replying !== r.id && <p className="rounded-lg bg-primary/10 p-2 text-xs"><b className="text-primary">پاسخ فروشگاه: </b>{r.adminReply}</p>}
              {replying === r.id && <div className="flex gap-2"><input className={inputCls} maxLength={800} value={text} onChange={(e) => setText(e.target.value)} placeholder="پاسخ عمومی به این نظر (خالی = حذف پاسخ)" autoFocus /><button className={btnPrimary} onClick={() => sendReply(r.id)}>ذخیره</button><button className={btnGhost} onClick={() => setReplying(null)}>انصراف</button></div>}
              {rejecting === r.id && <div className="flex gap-2"><input className={inputCls} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="دلیل رد (اختیاری؛ برای کاربر نمایش داده می‌شود)" autoFocus /><button className={btnDanger} onClick={() => { void set(r.id, "rejected", reason); setRejecting(null); setReason(""); }}>رد نظر</button><button className={btnGhost} onClick={() => setRejecting(null)}>انصراف</button></div>}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span>{r.user.displayName ?? "—"} · <Link href={`/admin/customers/${r.user.id}`} className="text-primary" dir="ltr">{r.user.phone}</Link>{r.order && <> · سفارش <Link href={`/admin/orders/${r.order.number}`} className="text-primary">{r.order.number.toLocaleString("fa-IR")}</Link></>} · {fmtDate(r.createdAt)}</span>
                <span className="flex gap-2">
                  {r.status !== "approved" && <button className={cn(btnPrimary, "h-8 px-3 text-xs")} onClick={() => set(r.id, "approved")}>تأیید</button>}
                  {r.status !== "rejected" && <button className={cn(btnGhost, "h-8 px-3 text-xs")} onClick={() => { setRejecting(r.id); setReason(""); }}>رد</button>}
                  {r.status === "approved" && <button className={cn(btnGhost, "h-8 px-3 text-xs")} onClick={() => { setReplying(r.id); setText(r.adminReply ?? ""); }}>{r.adminReply ? "ویرایش پاسخ" : "پاسخ"}</button>}
                  <button className={cn(btnDanger, "h-8 px-3 text-xs")} onClick={() => del(r.id)}>حذف</button>
                </span>
              </div>
            </Card>
          ))}</div>
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
