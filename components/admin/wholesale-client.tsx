"use client";
import { useState } from "react";
import { Card, Empty, ErrorBox, Label, Modal, Pager, Pill, Spinner, act, btnDanger, btnGhost, btnPrimary, fmtDate, fmtNum, inputCls, useApi } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

interface App { id: string; name: string; email: string | null; phone: string; province: string | null; storeName: string; businessType: string; instagram: string | null; website: string | null; city: string; address: string; description: string | null; status: string; adminNote: string | null; createdAt: string; files: { id: string; originalName: string }[] }
const TABS = [["PENDING", "در انتظار"], ["CHANGES_REQUESTED", "نیاز به اصلاح"], ["APPROVED", "تأیید شده"], ["REJECTED", "رد شده"]] as const;
const BT: Record<string, string> = { instagram_shop: "پیج اینستاگرام", online_shop: "فروشگاه آنلاین", physical_store: "مغازه حضوری", other: "سایر" };
const ST: Record<string, [string, "warn" | "info" | "ok" | "bad"]> = { PENDING: ["در انتظار", "warn"], CHANGES_REQUESTED: ["نیاز به اصلاح", "info"], APPROVED: ["تأیید شده", "ok"], REJECTED: ["رد شده", "bad"] };

export function WholesaleClient({ canReview }: { canReview: boolean }) {
  const [tab, setTab] = useState<string>("PENDING"); const [page, setPage] = useState(1);
  const [dlg, setDlg] = useState<{ app: App; kind: "approve" | "reject" | "changes" } | null>(null); const [tierId, setTierId] = useState(""); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  const { data, error, loading, reload } = useApi<{ items: App[]; total: number; page: number; pages: number; counts: Record<string, number> }>(`/api/admin/wholesale?status=${tab}&page=${page}`);
  const tiers = useApi<{ items: { id: string; name: string; isActive: boolean; minOrder: number }[] }>("/api/admin/r/tiers");
  const activeTiers = tiers.data?.items.filter((t) => t.isActive) ?? [];
  const submit = async () => {
    if (!dlg) return; setBusy(true);
    const path = dlg.kind === "approve" ? "approve" : dlg.kind === "reject" ? "reject" : "request-changes";
    const body = dlg.kind === "approve" ? { tierId: tierId || activeTiers[0]?.id, note: note || undefined } : { note };
    const r = await act("POST", `/api/admin/wholesale/${dlg.app.id}/${path}`, body, "ثبت شد."); setBusy(false);
    if (r.ok) { setDlg(null); setNote(""); reload(); }
  };
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-surface p-1 shadow-sm" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setPage(1); }} className={cn("h-9 cursor-pointer rounded-md px-4 text-sm font-bold", tab === k ? "bg-primary text-primary-fg" : "hover:bg-surface-2")}>{l}{data?.counts[k] ? <span className="ms-1.5 text-xs opacity-80">({fmtNum(data.counts[k]!)})</span> : null}</button>)}</div>
        {error ? <ErrorBox message={error} /> : loading && !data ? <Spinner /> : !data?.items.length ? <Empty text="درخواستی در این وضعیت نیست." /> : (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              {data.items.map((a) => (
                <Card key={a.id} className="space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-2"><div><b className="text-base">{a.storeName}</b><div className="text-muted">{a.name} · <span dir="ltr">{a.phone}</span>{a.email && <> · <span dir="ltr">{a.email}</span></>}</div></div><Pill tone={ST[a.status]![1]}>{ST[a.status]![0]}</Pill></div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs"><dt className="text-muted">نوع کسب‌وکار</dt><dd>{BT[a.businessType] ?? a.businessType}</dd><dt className="text-muted">اینستاگرام</dt><dd dir="ltr" className="text-start">{a.instagram ?? "—"}</dd><dt className="text-muted">استان</dt><dd>{a.province ?? "—"}</dd><dt className="text-muted">وب‌سایت</dt><dd dir="ltr" className="text-start">{a.website ?? "—"}</dd><dt className="text-muted">شهر</dt><dd>{a.city}</dd><dt className="text-muted">آدرس</dt><dd>{a.address}</dd><dt className="text-muted">مدارک</dt><dd>{a.files.length ? a.files.map((f) => <a key={f.id} href={`/api/wholesale/documents/${f.id}`} target="_blank" rel="noreferrer" className="me-2 font-bold text-primary">{f.originalName}</a>) : "—"}</dd><dt className="text-muted">تاریخ</dt><dd>{fmtDate(a.createdAt)}</dd></dl>
                  {a.description && <p className="rounded-lg bg-surface-2 p-2 text-xs">{a.description}</p>}
                  {a.adminNote && <p className="rounded-lg bg-primary/10 p-2 text-xs">یادداشت مدیر: {a.adminNote}</p>}
                  {canReview && a.status !== "APPROVED" && <div className="flex flex-wrap gap-2 border-t border-border pt-2"><button className={btnPrimary} onClick={() => { setDlg({ app: a, kind: "approve" }); setTierId(activeTiers[0]?.id ?? ""); setNote(""); }}>تأیید</button><button className={btnGhost} onClick={() => { setDlg({ app: a, kind: "changes" }); setNote(""); }}>درخواست اصلاح</button>{a.status !== "REJECTED" && <button className={btnDanger} onClick={() => { setDlg({ app: a, kind: "reject" }); setNote(""); }}>رد</button>}</div>}
                </Card>
              ))}
            </div>
            <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
          </>
        )}
      </div>
      {dlg && (
        <Modal title={dlg.kind === "approve" ? `تأیید ${dlg.app.storeName}` : dlg.kind === "reject" ? "رد درخواست" : "درخواست اصلاح"} onClose={() => setDlg(null)}>
          <div className="space-y-3">
            {dlg.kind === "approve" && <Label label="سطح همکار *"><select className={inputCls} value={tierId} onChange={(e) => setTierId(e.target.value)}>{activeTiers.map((t) => <option key={t.id} value={t.id}>{t.name} — حداقل سفارش {fmtNum(t.minOrder)} تومان</option>)}</select></Label>}
            <Label label={dlg.kind === "approve" ? "یادداشت (اختیاری)" : "توضیح (الزامی — برای متقاضی نمایش داده می‌شود)"}><textarea className={cn(inputCls, "h-24 py-2")} value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} /></Label>
            <div className="flex justify-end gap-2"><button className={btnGhost} onClick={() => setDlg(null)}>انصراف</button><button className={btnPrimary} disabled={busy || (dlg.kind !== "approve" && note.trim().length < 3) || (dlg.kind === "approve" && !tierId)} onClick={submit}>ثبت</button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
