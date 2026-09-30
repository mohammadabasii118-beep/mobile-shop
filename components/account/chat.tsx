"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Paperclip, Send, X } from "lucide-react";
import { api } from "@/lib/client/api";
import { CHAT_STATUS_LABEL } from "@/lib/support-meta";
import { cn } from "@/lib/utils";

const field = "w-full rounded-xl border border-border bg-surface px-4 text-sm outline-none focus:border-primary";
const fa = (n: number) => n.toLocaleString("fa-IR", { useGrouping: false });
const time = (d: string) => new Date(d).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
const day = (d: string) => new Date(d).toLocaleDateString("fa-IR", { month: "long", day: "numeric" });
const tone = { warn: "bg-warning/15 text-warning", ok: "bg-success/15 text-success", mute: "bg-surface-2 text-muted", info: "bg-primary/15 text-primary" } as const;

function useVisibleInterval(fn: () => void, ms: number, on: boolean) {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; });
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") ref.current(); }, ms);
    const v = () => { if (document.visibilityState === "visible") ref.current(); };
    document.addEventListener("visibilitychange", v);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", v); };
  }, [ms, on]);
}

export const OnlineDot = ({ online }: { online: boolean }) => (
  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold", online ? "bg-success/15 text-success" : "bg-surface-2 text-muted")} data-testid="online-state"><i className={cn("size-2 rounded-full", online ? "bg-success" : "bg-muted")} />{online ? "پشتیبانی آنلاین است" : "پشتیبانی آفلاین است؛ پاسخ در اولین فرصت"}</span>
);

function Files({ files, setFiles }: { files: File[]; setFiles: (f: File[]) => void }) {
  return (
    <>
      <label className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl bg-surface-2 text-primary" title="افزودن تصویر یا PDF"><Paperclip className="size-5" /><span className="sr-only">افزودن فایل</span>
        <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" data-testid="chat-file" onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 3)); e.target.value = ""; }} /></label>
    </>
  );
}

/* ───────── list + start ───────── */
interface Item { id: string; number: number; status: string; unread: number; lastMessageAt: string; preview: string | null; orderNumber: number | null }
export function ChatHome({ orders }: { orders: { number: number; label: string }[] }) {
  const router = useRouter();
  const [data, setData] = useState<{ online: boolean; unread: number; items: Item[] } | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [text, setText] = useState(""); const [order, setOrder] = useState(""); const [files, setFiles] = useState<File[]>([]);
  const load = useCallback(() => { void api<{ online: boolean; unread: number; items: Item[] }>("GET", "/api/chat").then((r) => { if (r.ok) setData(r.data); else setErr(r.error.message); }); }, []);
  useEffect(load, [load]);
  useVisibleInterval(load, 10000, true);
  const open = data?.items.find((c) => c.status !== "closed");
  async function start(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const fd = new FormData(); fd.set("message", text); if (order) fd.set("orderNumber", order); files.forEach((f) => fd.append("files", f));
    const r = await api<{ id: string }>("POST", "/api/chat", fd);
    setBusy(false);
    if (!r.ok) return setErr(r.error.message);
    router.push(`/account/chat/${r.data.id}`);
  }
  if (!data) return <p className="py-10 text-center text-xs text-muted">{err || "در حال بارگذاری…"}</p>;
  return (
    <div className="space-y-4" data-testid="chat-home">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-2 p-3">
        <div><b className="text-sm">چت آنلاین</b><p className="text-[11px] text-muted">برای سوال سریع و ارتباط مستقیم با پشتیبانی. درخواست‌های رسمی و قابل پیگیری را در <Link href="/account/tickets" className="font-bold text-primary">تیکت‌های من</Link> ثبت کنید.</p></div>
        <OnlineDot online={data.online} />
      </div>
      {open ? (
        <Link href={`/account/chat/${open.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-sm font-bold text-primary" data-testid="continue-chat">
          <span className="flex items-center gap-2"><MessageCircle className="size-5" />ادامهٔ گفتگوی باز</span>
          {open.unread > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-hot px-1.5 text-[11px] text-white">{fa(open.unread)}</span>}
        </Link>
      ) : (
        <form onSubmit={start} className="space-y-3 rounded-2xl border border-border bg-surface-2 p-4">
          <b className="block text-sm">شروع گفتگوی جدید</b>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="پیام خود را بنویسید…" aria-label="پیام" className={`${field} py-3`} data-testid="start-text" />
          {orders.length > 0 && <select value={order} onChange={(e) => setOrder(e.target.value)} className={`${field} h-11`} aria-label="سفارش مرتبط (اختیاری)"><option value="">سفارش مرتبط (اختیاری)</option>{orders.map((o) => <option key={o.number} value={o.number}>{o.label}</option>)}</select>}
          {files.length > 0 && <ul className="flex flex-wrap gap-2 text-xs">{files.map((f, i) => <li key={i} className="flex items-center gap-1 rounded-lg bg-surface px-2 py-1">{f.name}<button type="button" aria-label="حذف" onClick={() => setFiles(files.filter((_, j) => j !== i))}><X className="size-3.5" /></button></li>)}</ul>}
          {err && <p role="alert" className="text-xs font-bold text-hot">{err}</p>}
          <div className="flex items-center gap-2"><Files files={files} setFiles={setFiles} /><button disabled={busy || (!text.trim() && !files.length)} className="ms-auto flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-fg disabled:opacity-50" data-testid="start-send"><Send className="size-4" />شروع گفتگو</button></div>
        </form>
      )}
      <div>
        <h2 className="mb-2 text-sm font-black">گفتگوهای قبلی</h2>
        {data.items.length === 0 ? <p className="rounded-2xl border border-dashed border-primary/30 px-4 py-8 text-center text-xs text-muted">هنوز گفتگویی نداشته‌اید.</p> : (
          <ul className="space-y-2">{data.items.map((c) => {
            const [label, t] = CHAT_STATUS_LABEL[c.status] ?? ["", "mute" as const];
            return (
              <li key={c.id}><Link href={`/account/chat/${c.id}`} className="block rounded-2xl border border-border bg-surface p-3.5 transition-shadow hover:shadow-md" data-testid="chat-row">
                <div className="flex items-start justify-between gap-3"><b className="text-[13px]">گفتگو {fa(c.number)}{c.orderNumber ? ` · سفارش ${fa(c.orderNumber)}` : ""}</b><span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold", tone[t])}>{label}</span></div>
                <p className="mt-1 truncate text-xs text-muted">{c.preview}</p>
                <p className="mt-1 flex items-center justify-between text-[11px] text-muted"><span>{day(c.lastMessageAt)} · {time(c.lastMessageAt)}</span>{c.unread > 0 && <span className="rounded-full bg-hot px-2 text-white">{fa(c.unread)} پیام جدید</span>}</p>
              </Link></li>
            );
          })}</ul>
        )}
      </div>
    </div>
  );
}

/* ───────── conversation ───────── */
interface Msg { id: string; isStaff: boolean; body: string; createdAt: string; readAt: string | null; files: { id: string; originalName: string; mime: string }[] }
interface Conv { id: string; number: number; status: string; orderNumber: number | null; closedAt: string | null; tickets: number[] }

/** Private, cookie-authenticated attachment: a plain <img> is right here (next/image cannot fetch it with the session). */
function AttachImg({ src, alt }: { src: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="max-h-40 rounded-lg" />;
}

export function Bubble({ m, mine, read }: { m: Msg; mine: boolean; read?: boolean }) {
  return (
    <li className={cn("flex", mine ? "justify-start" : "justify-end")} data-testid={mine ? "msg-mine" : "msg-staff"}>
      <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-7", mine ? "rounded-ss-md bg-primary text-primary-fg" : "rounded-se-md bg-surface-2")}>
        {!mine && <b className="mb-0.5 block text-[11px] text-primary">پشتیبانی کیس‌لاین</b>}
        {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
        {m.files.length > 0 && <div className="mt-1.5 flex flex-wrap gap-2">{m.files.map((f) => f.mime.startsWith("image/")
          ? <a key={f.id} href={`/api/chat/attachments/${f.id}`} target="_blank" rel="noopener noreferrer"><AttachImg src={`/api/chat/attachments/${f.id}`} alt={f.originalName} /></a>
          : <a key={f.id} href={`/api/chat/attachments/${f.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-black/10 px-2 py-1 text-xs font-bold"><Paperclip className="size-3.5" />{f.originalName}</a>)}</div>}
        <span className={cn("mt-1 flex items-center gap-1.5 text-[10px]", mine ? "text-primary-fg/80" : "text-muted")}>{time(m.createdAt)}{mine && <span data-testid="msg-state">{read ? "✓✓ خوانده شد" : "✓ ارسال شد"}</span>}</span>
      </div>
    </li>
  );
}

export function ChatThread({ id }: { id: string }) {
  const [conv, setConv] = useState<Conv | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]); const [read, setRead] = useState<Set<string>>(new Set());
  const [online, setOnline] = useState(false); const [err, setErr] = useState("");
  const [text, setText] = useState(""); const [files, setFiles] = useState<File[]>([]); const [busy, setBusy] = useState(false); const [ending, setEnding] = useState(false);
  const last = useRef<string | null>(null); const box = useRef<HTMLDivElement>(null); const stick = useRef(true);

  const load = useCallback(async () => {
    const r = await api<{ conversation: Conv; messages: Msg[]; ownRead: string[]; online: boolean }>("GET", `/api/chat/${id}${last.current ? `?after=${last.current}` : ""}`);
    if (!r.ok) { setErr(r.error.message); return; }
    setErr(""); setConv(r.data.conversation); setOnline(r.data.online); setRead(new Set(r.data.ownRead));
    if (r.data.messages.length) {
      setMsgs((old) => { const seen = new Set(old.map((m) => m.id)); const add = r.data.messages.filter((m) => !seen.has(m.id)); return add.length ? [...old, ...add] : old; });
      last.current = r.data.messages[r.data.messages.length - 1]!.id;
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  useVisibleInterval(() => { void load(); }, 3000, conv?.status !== "closed");
  useVisibleInterval(() => { void load(); }, 15000, conv?.status === "closed");
  useEffect(() => { if (stick.current && box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault(); if (busy || (!text.trim() && !files.length)) return;
    setBusy(true); setErr("");
    const fd = new FormData(); fd.set("message", text); files.forEach((f) => fd.append("files", f));
    const r = await api("POST", `/api/chat/${id}/messages`, fd);
    setBusy(false);
    if (!r.ok) return setErr(r.error.message);
    setText(""); setFiles([]); stick.current = true; await load();
  }
  async function end() { const r = await api("DELETE", `/api/chat/${id}`); if (!r.ok) setErr(r.error.message); setEnding(false); await load(); }

  if (!conv) return <p className="py-10 text-center text-xs text-muted">{err || "در حال بارگذاری…"}</p>;
  const closed = conv.status === "closed";
  const [label, t] = CHAT_STATUS_LABEL[conv.status] ?? ["", "mute" as const];
  return (
    <div className="space-y-3" data-testid="chat-thread">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><Link href="/account/chat" className="text-[11px] font-bold text-primary">‹ همهٔ گفتگوها</Link><h2 className="text-base font-black">گفتگو {fa(conv.number)}{conv.orderNumber ? <span className="text-xs font-normal text-muted"> · سفارش {fa(conv.orderNumber)}</span> : null}</h2></div>
        <div className="flex items-center gap-2"><span className={cn("rounded-full px-3 py-1.5 text-xs font-bold", tone[t])} data-testid="chat-status">{label}</span><OnlineDot online={online} /></div>
      </div>
      {conv.tickets.length > 0 && <p className="rounded-xl bg-primary/8 px-3 py-2 text-xs">از این گفتگو تیکت ثبت شده: {conv.tickets.map((n) => <Link key={n} href={`/account/tickets/${n}`} className="me-2 font-bold text-primary">تیکت {fa(n)}</Link>)}</p>}
      <div ref={box} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }} className="h-[52vh] min-h-72 overflow-y-auto rounded-2xl border border-border bg-surface p-3" role="log" aria-live="polite" aria-label="پیام‌های گفتگو">
        <ol className="space-y-2">
          {msgs.map((m, i) => (
            <div key={m.id}>
              {(i === 0 || day(msgs[i - 1]!.createdAt) !== day(m.createdAt)) && <p className="my-2 text-center text-[10px] text-muted">{day(m.createdAt)}</p>}
              <Bubble m={m} mine={!m.isStaff} read={!!m.readAt || read.has(m.id)} />
            </div>
          ))}
        </ol>
      </div>
      {closed && <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted" data-testid="closed-note">این گفتگو بسته شده است. با ارسال پیام جدید (تا ۷ روز) دوباره باز می‌شود.</p>}
      {err && <p role="alert" className="text-xs font-bold text-hot">{err}</p>}
      <form onSubmit={send} className="space-y-2">
        {files.length > 0 && <ul className="flex flex-wrap gap-2 text-xs">{files.map((f, i) => <li key={i} className="flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1">{f.name}<button type="button" aria-label="حذف" onClick={() => setFiles(files.filter((_, j) => j !== i))}><X className="size-3.5" /></button></li>)}</ul>}
        <div className="flex items-end gap-2">
          <Files files={files} setFiles={setFiles} />
          <textarea rows={1} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="پیام…" aria-label="پیام" className={`${field} max-h-32 min-h-10 py-2.5`} data-testid="chat-input" />
          <button disabled={busy || (!text.trim() && !files.length)} aria-label="ارسال" className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl bg-primary text-primary-fg disabled:opacity-50" data-testid="chat-send"><Send className="size-5" /></button>
        </div>
      </form>
      {!closed && (ending
        ? <p className="flex flex-wrap items-center gap-2 text-xs">گفتگو بسته شود؟ <button onClick={end} className="cursor-pointer rounded-lg bg-hot/10 px-3 py-1.5 font-bold text-hot" data-testid="end-confirm">بله، پایان گفتگو</button><button onClick={() => setEnding(false)} className="cursor-pointer text-muted">انصراف</button></p>
        : <button onClick={() => setEnding(true)} className="cursor-pointer text-xs font-bold text-muted hover:text-hot" data-testid="end-chat">پایان گفتگو</button>)}
    </div>
  );
}
