"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Paperclip, Send, Ticket, X } from "lucide-react";
import { Card, Modal, Pill, act, btnGhost, btnPrimary, fmtId, inputCls } from "@/components/admin/kit";
import { api } from "@/lib/client/api";
import { CATEGORIES, CHAT_STATUS_LABEL } from "@/lib/support-meta";
import { cn } from "@/lib/utils";

const time = (d: string) => new Date(d).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
const when = (d: string) => new Date(d).toLocaleString("fa-IR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const nf = (n: number) => n.toLocaleString("fa-IR");

function useVisibleInterval(fn: () => void, ms: number) {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; });
  useEffect(() => {
    const go = () => { if (document.visibilityState === "visible") ref.current(); };
    const t = setInterval(go, ms);
    document.addEventListener("visibilitychange", go);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", go); };
  }, [ms]);
}

interface Row { id: string; number: number; status: string; unread: number; lastMessageAt: string; preview: string | null; user: { displayName: string | null; phone: string }; orderNumber: number | null }
interface ListData { items: Row[]; total: number; pages: number; page: number; counts: { waiting: number; active: number; closed: number; unread: number; open: number } }
interface Msg { id: string; isStaff: boolean; body: string; createdAt: string; readAt: string | null; files: { id: string; originalName: string; mime: string }[] }
interface Detail {
  conversation: { id: string; number: number; status: string; closedBy: string | null; user: { id: string; displayName: string | null; phone: string; email: string | null } };
  tickets: { number: number; subject: string; status: string }[]; messages: Msg[];
  orders: { number: number; status: string; total: number; createdAt: string }[]; linkedOrder: { number: number; status: string; total: number } | null;
}

const TABS: [string, string][] = [["open", "باز"], ["waiting", "منتظر پاسخ"], ["active", "فعال"], ["unread", "خوانده‌نشده"], ["closed", "بسته‌شده"]];

export function ChatConsole({ initialTab, initialOpen, canReply, canTicket }: { initialTab: string; initialOpen: string; canReply: boolean; canTicket: boolean }) {
  const [tab, setTab] = useState(initialTab); const [q, setQ] = useState(""); const [page, setPage] = useState(1);
  const [list, setList] = useState<ListData | null>(null); const [err, setErr] = useState("");
  const [sel, setSel] = useState(initialOpen);
  const loadList = useCallback(() => {
    void api<ListData>("GET", `/api/admin/support/chat?${new URLSearchParams({ tab, q, page: String(page) })}`).then((r) => { if (r.ok) { setList(r.data); setErr(""); } else setErr(r.error.message); });
  }, [tab, q, page]);
  useEffect(loadList, [loadList]);
  useVisibleInterval(loadList, 5000);
  const counts = list?.counts;
  const badge = (k: string) => (k === "open" ? counts?.open : k === "waiting" ? counts?.waiting : k === "active" ? counts?.active : k === "unread" ? counts?.unread : counts?.closed) ?? 0;
  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]" data-testid="chat-console">
      <div className={cn("min-w-0 space-y-3", sel && "hidden lg:block")}>
        <div className="flex flex-wrap gap-1 rounded-lg bg-surface p-1 shadow-sm" role="tablist" aria-label="فیلتر گفتگوها">
          {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} data-testid={`tab-${k}`} onClick={() => { setTab(k); setPage(1); }} className={cn("h-9 cursor-pointer rounded-md px-2.5 text-xs font-bold", tab === k ? "bg-primary text-primary-fg" : "text-muted hover:bg-surface-2")}>{l}{badge(k) > 0 && <span className="ms-1 opacity-80">({nf(badge(k))})</span>}</button>)}
        </div>
        <input className={inputCls} placeholder="جستجوی کاربر (نام، موبایل، ایمیل، شماره گفتگو)" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="جستجوی کاربر" />
        {err && <p className="text-xs font-bold text-error">{err}</p>}
        <ul className="space-y-1.5" data-testid="chat-list">
          {list && list.items.length === 0 && <li className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted">گفتگویی در این بخش نیست.</li>}
          {list?.items.map((c) => {
            const [label, tone] = CHAT_STATUS_LABEL[c.status] ?? ["", "mute" as const];
            return (
              <li key={c.id}><button onClick={() => setSel(c.id)} data-testid="chat-row" className={cn("block w-full cursor-pointer rounded-lg border p-3 text-start transition-colors", sel === c.id ? "border-primary bg-primary/8" : "border-border bg-surface hover:bg-surface-2")}>
                <div className="flex items-center justify-between gap-2"><b className="truncate text-[13px]">{c.user.displayName ?? c.user.phone}</b><span className="text-[11px] text-muted">{when(c.lastMessageAt)}</span></div>
                <p className="mt-0.5 truncate text-xs text-muted">{c.preview}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5"><Pill tone={tone}>{label}</Pill><span className="text-[11px] text-muted">گفتگو {fmtId(c.number)}{c.orderNumber ? ` · سفارش ${fmtId(c.orderNumber)}` : ""}</span>{c.unread > 0 && <span className="ms-auto rounded-full bg-hot px-2 text-[11px] font-bold text-white" data-testid="row-unread">{nf(c.unread)}</span>}</div>
              </button></li>
            );
          })}
        </ul>
        {list && list.pages > 1 && <div className="flex items-center justify-between text-xs"><button className={cn(btnGhost, "h-8 px-3 text-xs")} disabled={page <= 1} onClick={() => setPage(page - 1)}>قبلی</button><span>{nf(page)} / {nf(list.pages)}</span><button className={cn(btnGhost, "h-8 px-3 text-xs")} disabled={page >= list.pages} onClick={() => setPage(page + 1)}>بعدی</button></div>}
      </div>
      <div className={cn("min-w-0", !sel && "hidden lg:block")}>
        {sel ? <ChatPane key={sel} id={sel} canReply={canReply} canTicket={canTicket} onBack={() => setSel("")} onChanged={loadList} />
          : <Card className="grid min-h-72 place-items-center text-center text-sm text-muted"><div><MessageCircle className="mx-auto mb-2 size-8 text-primary" />یک گفتگو را از فهرست انتخاب کنید.</div></Card>}
      </div>
    </div>
  );
}

function ChatPane({ id, canReply, canTicket, onBack, onChanged }: { id: string; canReply: boolean; canTicket: boolean; onBack: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null); const [msgs, setMsgs] = useState<Msg[]>([]); const [err, setErr] = useState("");
  const [text, setText] = useState(""); const [files, setFiles] = useState<File[]>([]); const [busy, setBusy] = useState(false);
  const [tk, setTk] = useState<{ subject: string; category: string; priority: string } | null>(null);
  const last = useRef<string | null>(null); const box = useRef<HTMLDivElement>(null); const stick = useRef(true);
  const load = useCallback(async () => {
    const r = await api<Detail>("GET", `/api/admin/support/chat/${id}${last.current ? `?after=${last.current}` : ""}`);
    if (!r.ok) { setErr(r.error.message); return; }
    setErr(""); setD(r.data);
    if (r.data.messages.length) { setMsgs((old) => { const seen = new Set(old.map((m) => m.id)); const add = r.data.messages.filter((m) => !seen.has(m.id)); return add.length ? [...old, ...add] : old; }); last.current = r.data.messages[r.data.messages.length - 1]!.id; onChanged(); }
  }, [id, onChanged]);
  useEffect(() => { void load(); }, [load]);
  useVisibleInterval(() => { void load(); }, 3000);
  useEffect(() => { if (stick.current && box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs]);

  if (!d) return <Card className="text-center text-sm text-muted">{err || "در حال بارگذاری…"}</Card>;
  const c = d.conversation; const closed = c.status === "closed"; const [label, tone] = CHAT_STATUS_LABEL[c.status] ?? ["", "mute" as const];
  const send = async (e?: React.FormEvent) => {
    e?.preventDefault(); if (busy || (!text.trim() && !files.length)) return; setBusy(true);
    const fd = new FormData(); fd.set("message", text); files.forEach((f) => fd.append("files", f));
    const r = await api("POST", `/api/admin/support/chat/${id}/messages`, fd);
    setBusy(false); if (!r.ok) return setErr(r.error.message);
    setText(""); setFiles([]); stick.current = true; await load(); onChanged();
  };
  const simple = async (path: string, ok: string) => { const r = await act("POST", `/api/admin/support/chat/${id}/${path}`, {}, ok); if (r.ok) { await load(); onChanged(); } };
  const makeTicket = async () => { if (!tk) return; const r = await act<{ number: number }>("POST", `/api/admin/support/chat/${id}/ticket`, { ...tk, subject: tk.subject.trim() || undefined }, "تیکت ساخته شد."); if (r.ok) { setTk(null); await load(); } };
  return (
    <div className="grid gap-3 xl:grid-cols-[1fr_15rem]" data-testid="chat-pane">
      <div className="min-w-0 space-y-3">
        <Card className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0"><button className="text-[11px] font-bold text-primary lg:hidden" onClick={onBack}>‹ فهرست</button>
            <div className="flex items-center gap-2"><b className="truncate">{c.user.displayName ?? c.user.phone}</b><Pill tone={tone}>{label}</Pill></div>
            <div className="text-[11px] text-muted">گفتگو {fmtId(c.number)} · <span dir="ltr">{c.user.phone}</span></div></div>
          {canReply && <div className="flex flex-wrap gap-2">
            {canTicket && <button className={cn(btnGhost, "h-9 px-3 text-xs")} data-testid="make-ticket" onClick={() => setTk({ subject: "", category: d.linkedOrder ? "order" : "general", priority: "normal" })}><Ticket className="size-4" />ایجاد تیکت از این گفتگو</button>}
            {closed ? <button className={cn(btnGhost, "h-9 px-3 text-xs")} data-testid="reopen" onClick={() => simple("reopen", "گفتگو دوباره باز شد.")}>باز کردن مجدد</button> : <button className={cn(btnGhost, "h-9 px-3 text-xs")} data-testid="close" onClick={() => simple("close", "گفتگو بسته شد.")}>بستن گفتگو</button>}
          </div>}
        </Card>
        {d.tickets.length > 0 && <p className="rounded-lg bg-primary/8 px-3 py-2 text-xs">تیکت‌های ثبت‌شده از این گفتگو: {d.tickets.map((t) => <Link key={t.number} href={`/admin/support/tickets/${t.number}`} className="me-2 font-bold text-primary">تیکت {fmtId(t.number)}</Link>)}</p>}
        <div ref={box} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }} className="h-[50vh] min-h-72 overflow-y-auto rounded-xl border border-border bg-surface p-3" role="log" aria-label="پیام‌ها">
          <ol className="space-y-2">{msgs.map((m) => (
            <li key={m.id} className={cn("flex", m.isStaff ? "justify-start" : "justify-end")} data-testid={m.isStaff ? "a-msg-staff" : "a-msg-user"}>
              <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-7", m.isStaff ? "bg-primary text-primary-fg" : "bg-surface-2")}>
                {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                {m.files.length > 0 && <div className="mt-1 flex flex-wrap gap-2">{m.files.map((f) => <a key={f.id} href={`/api/chat/attachments/${f.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-black/10 px-2 py-0.5 text-xs font-bold"><Paperclip className="size-3.5" />{f.originalName}</a>)}</div>}
                <span className={cn("block text-[10px]", m.isStaff ? "text-primary-fg/80" : "text-muted")}>{time(m.createdAt)}{m.isStaff && (m.readAt ? " · ✓✓ دیده شد" : " · ✓ ارسال شد")}</span>
              </div>
            </li>))}</ol>
        </div>
        {err && <p role="alert" className="text-xs font-bold text-error">{err}</p>}
        {canReply && (closed ? <p className="rounded-lg bg-surface-2 p-3 text-xs text-muted">گفتگو بسته است؛ برای پاسخ‌دادن ابتدا «باز کردن مجدد» را بزنید.</p> : (
          <form onSubmit={send} className="space-y-2">
            {files.length > 0 && <ul className="flex flex-wrap gap-2 text-xs">{files.map((f, i) => <li key={i} className="flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5">{f.name}<button type="button" aria-label="حذف" onClick={() => setFiles(files.filter((_, j) => j !== i))}><X className="size-3.5" /></button></li>)}</ul>}
            <div className="flex items-end gap-2">
              <label className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-md border border-border bg-surface text-primary" title="افزودن فایل"><Paperclip className="size-5" /><span className="sr-only">افزودن فایل</span><input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 3)); e.target.value = ""; }} /></label>
              <textarea rows={2} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} className={cn(inputCls, "h-auto min-h-10 py-2")} placeholder="پاسخ به مشتری… (Enter = ارسال)" aria-label="پاسخ" data-testid="a-input" />
              <button className={cn(btnPrimary, "px-4")} disabled={busy || (!text.trim() && !files.length)} data-testid="a-send"><Send className="size-4" />ارسال</button>
            </div>
          </form>))}
      </div>
      <div className="space-y-3">
        <Card className="space-y-1.5 text-sm">
          <b className="text-xs">کاربر</b>
          <Link href={`/admin/customers/${c.user.id}`} className="block font-bold text-primary">{c.user.displayName ?? c.user.phone}</Link>
          <div className="text-xs text-muted" dir="ltr">{c.user.phone}</div>{c.user.email && <div className="truncate text-xs text-muted" dir="ltr">{c.user.email}</div>}
          {d.linkedOrder && <div className="text-xs">سفارش مرتبط: <Link href={`/admin/orders/${d.linkedOrder.number}`} className="font-bold text-primary" data-testid="linked-order">#{fmtId(d.linkedOrder.number)}</Link></div>}
        </Card>
        <Card className="space-y-1.5 text-xs">
          <b>سفارش‌های اخیر کاربر</b>
          {d.orders.length === 0 && <p className="text-muted">سفارشی ندارد.</p>}
          {d.orders.map((o) => <Link key={o.number} href={`/admin/orders/${o.number}`} className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-surface-2" data-testid="user-order"><span className="font-bold text-primary">#{fmtId(o.number)}</span><span className="text-muted">{o.status}</span></Link>)}
        </Card>
      </div>
      {tk && (
        <Modal title="ایجاد تیکت از گفتگو" onClose={() => setTk(null)}>
          <p className="mb-3 text-xs leading-6 text-muted">یک تیکت مستقل با شمارهٔ جدا ساخته می‌شود و خلاصهٔ این گفتگو به‌عنوان زمینه در آن می‌آید. خود گفتگو همچنان چت می‌ماند.</p>
          <div className="space-y-3">
            <input className={inputCls} placeholder="عنوان تیکت (اختیاری)" value={tk.subject} onChange={(e) => setTk({ ...tk, subject: e.target.value })} aria-label="عنوان تیکت" />
            <select className={inputCls} value={tk.category} onChange={(e) => setTk({ ...tk, category: e.target.value })} aria-label="دسته تیکت">{Object.entries(CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <select className={inputCls} value={tk.priority} onChange={(e) => setTk({ ...tk, priority: e.target.value })} aria-label="اولویت تیکت">{[["low", "کم"], ["normal", "عادی"], ["high", "بالا"], ["urgent", "فوری"]].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <div className="flex justify-end gap-2"><button className={btnGhost} onClick={() => setTk(null)}>انصراف</button><button className={btnPrimary} data-testid="ticket-go" onClick={makeTicket}>ساخت تیکت</button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
