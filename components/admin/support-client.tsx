"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Paperclip } from "lucide-react";
import { Card, Empty, ErrorBox, Label, Pager, Pill, Spinner, Table, Td, act, btnPrimary, fmtDate, fmtId, inputCls, useApi } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

const ST: Record<string, [string, "warn" | "ok" | "mute"]> = { open: ["در انتظار پاسخ", "warn"], answered: ["پاسخ داده شد", "ok"], closed: ["بسته", "mute"] };
const PR: Record<string, [string, "mute" | "info" | "warn" | "bad"]> = { low: ["کم", "mute"], normal: ["عادی", "info"], high: ["بالا", "warn"], urgent: ["فوری", "bad"] };
const CAT: Record<string, string> = { general: "عمومی", order: "سفارش", payment: "پرداخت", product: "محصول", return: "مرجوعی / لغو", wholesale: "همکاری عمده" };
interface Row { id: string; number: number; subject: string; status: string; priority: string; category: string; updatedAt: string; user: { displayName: string | null; phone: string }; assignee: { displayName: string | null; phone: string } | null; _count: { messages: number } }

export function SupportInbox({ initialStatus }: { initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus); const [priority, setPriority] = useState(""); const [assignee, setAssignee] = useState(""); const [q, setQ] = useState(""); const [page, setPage] = useState(1);
  const url = useMemo(() => { const u = new URLSearchParams({ page: String(page) }); if (status) u.set("status", status); if (priority) u.set("priority", priority); if (assignee) u.set("assignee", assignee); if (q) u.set("q", q); return `/api/admin/support?${u}`; }, [status, priority, assignee, q, page]);
  const { data, error, loading } = useApi<{ items: Row[]; total: number; page: number; pages: number; counts: Record<string, number> }>(url);
  const r = (f: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { f(e.target.value); setPage(1); };
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1 rounded-lg bg-surface p-1 shadow-sm">{[["", "همه"], ["open", "در انتظار پاسخ"], ["answered", "پاسخ داده‌شده"], ["closed", "بسته"]].map(([k, l]) => <button key={k} onClick={() => { setStatus(k!); setPage(1); }} className={cn("h-9 cursor-pointer rounded-md px-4 text-sm font-bold", status === k ? "bg-primary text-primary-fg" : "hover:bg-surface-2")}>{l}{k && data?.counts[k] ? <span className="ms-1.5 text-xs opacity-80">({fmtId(data.counts[k]!)})</span> : null}</button>)}</div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input className={cn(inputCls, "max-w-64")} placeholder="شماره، موضوع، نام یا موبایل…" value={q} onChange={r(setQ)} aria-label="جستجو" />
        <select className={cn(inputCls, "w-auto")} value={priority} onChange={r(setPriority)} aria-label="اولویت"><option value="">اولویت: همه</option>{Object.entries(PR).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
        <select className={cn(inputCls, "w-auto")} value={assignee} onChange={r(setAssignee)} aria-label="ارجاع"><option value="">ارجاع: همه</option><option value="none">بدون ارجاع</option></select>
      </div>
      {error ? <ErrorBox message={error} /> : loading && !data ? <Spinner /> : !data?.items.length ? <Empty text="تیکتی وجود ندارد." /> : (
        <>
          <Table head={["#", "موضوع", "مشتری", "دسته", "اولویت", "ارجاع به", "وضعیت", "آخرین فعالیت"]}>
            {data.items.map((t) => <tr key={t.id} className="hover:bg-surface-2/60"><Td className="font-black">{fmtId(t.number)}</Td><Td><Link href={`/admin/support/${t.number}`} className="font-bold hover:text-primary">{t.subject}</Link><div className="text-[11px] text-muted">{fmtId(t._count.messages)} پیام</div></Td><Td>{t.user.displayName ?? t.user.phone}</Td><Td className="text-xs">{CAT[t.category] ?? t.category}</Td><Td><Pill tone={PR[t.priority]?.[1] ?? "mute"}>{PR[t.priority]?.[0] ?? t.priority}</Pill></Td><Td className="text-xs">{t.assignee ? (t.assignee.displayName ?? t.assignee.phone) : "—"}</Td><Td><Pill tone={ST[t.status]![1]}>{ST[t.status]![0]}</Pill></Td><Td className="text-xs">{fmtDate(t.updatedAt)}</Td></tr>)}
          </Table>
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}

interface Msg { id: string; body: string; isStaff: boolean; isInternal: boolean; createdAt: string; author: { displayName: string | null; phone: string }; files: { id: string; originalName: string }[] }
interface Detail { id: string; number: number; subject: string; status: string; priority: string; category: string; assignedToId: string | null; createdAt: string; user: { id: string; displayName: string | null; phone: string }; order: { number: number; status: string; total: number } | null; messages: Msg[]; staff: { id: string; displayName: string | null; phone: string }[] }

export function TicketDetail({ number, canReply }: { number: number; canReply: boolean }) {
  const { data: t, error, loading, reload } = useApi<Detail>(`/api/admin/support/${number}`);
  const [message, setMessage] = useState(""); const [internal, setInternal] = useState(false); const [files, setFiles] = useState<File[]>([]); const [busy, setBusy] = useState(false);
  if (error) return <ErrorBox message={error} />;
  if (loading || !t) return <Spinner />;
  const patch = async (body: object) => { const r = await act("PATCH", `/api/admin/support/${number}`, body, "به‌روزرسانی شد."); if (r.ok) reload(); };
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const fd = new FormData(); fd.set("message", message); if (internal) fd.set("internal", "true"); files.forEach((f) => fd.append("files", f));
    const r = await act("POST", `/api/admin/support/${number}/reply`, fd, internal ? "یادداشت داخلی ثبت شد." : "پاسخ ارسال شد.");
    setBusy(false); if (r.ok) { setMessage(""); setFiles([]); setInternal(false); reload(); }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        {t.messages.map((m) => (
          <Card key={m.id} className={cn("space-y-2", m.isInternal && "border-warning/50 bg-warning/5", m.isStaff && !m.isInternal && "border-primary/30 bg-primary/5")}>
            <div className="flex items-center justify-between text-xs text-muted"><b className="text-foreground">{m.author.displayName ?? m.author.phone}{m.isStaff ? " (پشتیبانی)" : ""}</b><span>{m.isInternal && <Pill tone="warn">یادداشت داخلی</Pill>} {fmtDate(m.createdAt)}</span></div>
            <p className="whitespace-pre-wrap text-sm leading-7">{m.body}</p>
            {m.files.length > 0 && <div className="flex flex-wrap gap-2">{m.files.map((f) => <a key={f.id} href={`/api/support/attachments/${f.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-bold text-primary"><Paperclip className="size-3.5" />{f.originalName}</a>)}</div>}
          </Card>
        ))}
        {canReply && (
          <form onSubmit={send}><Card className="space-y-3">
            <textarea required rows={4} maxLength={4000} className={cn(inputCls, "h-28 py-2")} placeholder={internal ? "یادداشت داخلی (مشتری نمی‌بیند)…" : "پاسخ به مشتری…"} value={message} onChange={(e) => setMessage(e.target.value)} />
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" className="accent-[var(--primary)]" checked={internal} onChange={(e) => setInternal(e.target.checked)} />یادداشت داخلی</label>
              <label className="cursor-pointer text-xs font-bold text-primary"><Paperclip className="me-1 inline size-4" />فایل ({files.length}/۳)<input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 3)); e.target.value = ""; }} /></label>
              {files.map((f, i) => <span key={i} className="rounded bg-surface-2 px-2 py-0.5 text-xs">{f.name}</span>)}
              <button className={cn(btnPrimary, "ms-auto")} disabled={busy || !message.trim()}>{internal ? "ثبت یادداشت" : "ارسال پاسخ"}</button>
            </div>
          </Card></form>
        )}
      </div>
      <div className="space-y-3">
        <Card className="space-y-2 text-sm">
          <div className="flex items-center justify-between"><Pill tone={ST[t.status]![1]}>{ST[t.status]![0]}</Pill><span className="text-xs text-muted">{CAT[t.category]}</span></div>
          <div>مشتری: <Link href={`/admin/customers/${t.user.id}`} className="font-bold text-primary">{t.user.displayName ?? t.user.phone}</Link> <span dir="ltr" className="text-xs text-muted">{t.user.phone}</span></div>
          {t.order && <div>سفارش: <Link href={`/admin/orders/${t.order.number}`} className="font-bold text-primary">#{fmtId(t.order.number)}</Link></div>}
        </Card>
        {canReply && (
          <Card className="space-y-3">
            <Label label="وضعیت"><select className={inputCls} value={t.status} onChange={(e) => patch({ status: e.target.value })}>{Object.entries(ST).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></Label>
            <Label label="اولویت"><select className={inputCls} value={t.priority} onChange={(e) => patch({ priority: e.target.value })}>{Object.entries(PR).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></Label>
            <Label label="ارجاع به کارمند"><select className={inputCls} value={t.assignedToId ?? ""} onChange={(e) => patch({ assignedToId: e.target.value || null })}><option value="">— بدون ارجاع —</option>{t.staff.map((s) => <option key={s.id} value={s.id}>{s.displayName ?? s.phone}</option>)}</select></Label>
          </Card>
        )}
      </div>
    </div>
  );
}
