"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Paperclip, Plus } from "lucide-react";
import { api } from "@/lib/client/api";
import { CATEGORIES } from "@/lib/support-meta";

const field = "w-full rounded-xl border border-border bg-surface px-4 text-sm outline-none focus:border-primary";
const CATS = Object.entries(CATEGORIES) as [string, string][];

function Files({ files, setFiles }: { files: File[]; setFiles: (f: File[]) => void }) {
  return (
    <div className="text-xs">
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-surface px-3 py-2 font-bold text-primary"><Paperclip className="size-4" />افزودن فایل (تصویر یا PDF، حداکثر ۳ فایل ۵ مگابایتی)
        <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 3)); e.target.value = ""; }} /></label>
      {files.length > 0 && <ul className="mt-2 space-y-1">{files.map((f, i) => <li key={i} className="flex items-center justify-between rounded-lg bg-surface px-3 py-1.5"><span className="truncate">{f.name}</span><button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="cursor-pointer text-hot">حذف</button></li>)}</ul>}
    </div>
  );
}

export function NewTicketForm({ orders, defaults }: { orders: { number: number; label: string }[]; defaults?: { order?: string; category?: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(!!defaults?.order);
  const [v, setV] = useState({ subject: defaults?.category === "return" ? "درخواست لغو / مرجوعی سفارش" : "", message: "", category: defaults?.category && CATS.some(([k]) => k === defaults.category) ? defaults.category : defaults?.order ? "order" : "general", orderNumber: defaults?.order ?? "" });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const fd = new FormData();
    fd.set("subject", v.subject); fd.set("message", v.message); fd.set("category", v.category); if (v.orderNumber) fd.set("orderNumber", v.orderNumber);
    files.forEach((f) => fd.append("files", f));
    const r = await api<{ number: number }>("POST", "/api/support/tickets", fd);
    setBusy(false);
    if (!r.ok) return setErr(r.error.message);
    router.push(`/account/tickets/${r.data.number}`);
  }
  if (!open) return <button onClick={() => setOpen(true)} className="flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-fg shadow-md hover:bg-primary-hover"><Plus className="size-4" />تیکت جدید</button>;
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-surface-2 p-4">
      <input required value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} placeholder="موضوع تیکت" maxLength={120} className={`${field} h-11`} />
      <div className="grid gap-3 sm:grid-cols-2">
        <select value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} className={`${field} h-11`} aria-label="دسته">{CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select value={v.orderNumber} onChange={(e) => setV({ ...v, orderNumber: e.target.value })} className={`${field} h-11`} aria-label="سفارش مرتبط"><option value="">سفارش مرتبط (اختیاری)</option>{orders.map((o) => <option key={o.number} value={o.number}>{o.label}</option>)}</select>
      </div>
      <textarea required rows={4} value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} placeholder="پیام خود را بنویسید…" maxLength={4000} className={`${field} py-3 leading-7`} />
      <Files files={files} setFiles={setFiles} />
      <p role="alert" className="min-h-4 text-xs text-hot">{err}</p>
      <div className="flex gap-2"><button disabled={busy} className="h-11 flex-1 cursor-pointer rounded-xl bg-primary text-sm font-bold text-primary-fg hover:bg-primary-hover disabled:opacity-60">{busy ? "در حال ارسال…" : "ارسال تیکت"}</button><button type="button" onClick={() => setOpen(false)} className="h-11 cursor-pointer rounded-xl bg-surface px-5 text-sm text-muted">انصراف</button></div>
    </form>
  );
}

export function TicketReply({ number, closed }: { number: number; closed: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState(""); const [files, setFiles] = useState<File[]>([]); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const fd = new FormData(); fd.set("message", message); files.forEach((f) => fd.append("files", f));
    const r = await api("POST", `/api/support/tickets/${number}/messages`, fd);
    setBusy(false);
    if (!r.ok) return setErr(r.error.message);
    setMessage(""); setFiles([]); router.refresh();
  }
  async function close() { await api("DELETE", `/api/support/tickets/${number}`); router.refresh(); }
  return (
    <form onSubmit={send} className="space-y-3 rounded-2xl border border-border bg-surface-2 p-4">
      <h3 className="text-sm font-black">{closed ? "بازگشایی تیکت با پیام جدید" : "پاسخ شما"}</h3>
      <textarea required rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} placeholder="پیام…" className={`${field} py-3 leading-7`} />
      <Files files={files} setFiles={setFiles} />
      <p role="alert" className="min-h-4 text-xs text-hot">{err}</p>
      <div className="flex gap-2"><button disabled={busy} className="h-11 flex-1 cursor-pointer rounded-xl bg-primary text-sm font-bold text-primary-fg disabled:opacity-60">ارسال</button>{!closed && <button type="button" onClick={close} className="h-11 cursor-pointer rounded-xl bg-surface px-5 text-sm text-muted">بستن تیکت</button>}</div>
    </form>
  );
}
