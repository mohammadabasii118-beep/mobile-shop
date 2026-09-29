"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { formatToman } from "@/lib/utils";

export function OrderExtras({ number }: { number: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function cancel() {
    if (!window.confirm("این سفارش لغو شود؟ کالاها، کد تخفیف، امتیاز و اعتبار کیف پولِ استفاده‌شده به حساب شما برمی‌گردد.")) return;
    setBusy(true); setErr("");
    const r = await api("POST", `/api/orders/${number}/cancel`);
    setBusy(false);
    if (!r.ok) return setErr(r.error.message);
    router.refresh();
  }
  return (
    <div>
      <button onClick={cancel} disabled={busy} className="cursor-pointer rounded-xl bg-hot/10 px-5 py-2.5 text-xs font-bold text-hot hover:bg-hot/15 disabled:opacity-60">{busy ? "در حال لغو…" : "لغو سفارش"}</button>
      {err && <p role="alert" className="mt-2 text-xs text-hot">{err}</p>}
    </div>
  );
}

const RSTATUS: Record<string, string> = { AWAITING_CUSTOMER: "در انتظار تأیید شما", PENDING_BANK: "در انتظار واریز بانکی", COMPLETED: "انجام شد", REJECTED: "رد شد", CANCELLED: "لغو شد" };
export function RefundBox({ refunds }: { refunds: { id: string; method: string; amount: number; status: string; reason: string; bankReference: string | null }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
  async function act(id: string, what: "accept" | "decline") {
    if (what === "accept" && !window.confirm("مبلغ به کیف پول شما واریز شود؟")) return;
    setBusy(id); setErr("");
    const r = await api("POST", `/api/refunds/${id}/${what}`);
    setBusy("");
    if (!r.ok) return setErr(r.error.message);
    router.refresh();
  }
  return (
    <section aria-label="بازگشت وجه" className="rounded-2xl border border-border p-4">
      <h2 className="mb-2 text-sm font-black">بازگشت وجه</h2>
      <ul className="space-y-3 text-[13px]">
        {refunds.map((r) => (
          <li key={r.id} className="rounded-xl bg-surface-2 p-3">
            <div className="flex items-center justify-between gap-2"><b>{formatToman(r.amount)} — {r.method === "wallet" ? "به کیف پول" : "به حساب بانکی"}</b><span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-bold">{RSTATUS[r.status]}</span></div>
            <p className="mt-1 text-[11px] text-muted">{r.reason}</p>
            {r.status === "COMPLETED" && r.bankReference && <p className="mt-1 text-[11px]">شماره پیگیری بانکی: <b dir="ltr">{r.bankReference}</b></p>}
            {r.status === "PENDING_BANK" && <p className="mt-1 text-[11px] text-muted">پس از واریز، شماره پیگیری بانکی همین‌جا نمایش داده می‌شود.</p>}
            {r.status === "AWAITING_CUSTOMER" && (
              <div className="mt-3 flex gap-2">
                <button disabled={busy === r.id} onClick={() => act(r.id, "accept")} className="h-10 flex-1 cursor-pointer rounded-xl bg-primary text-xs font-bold text-primary-fg disabled:opacity-60">تأیید و واریز به کیف پول</button>
                <button disabled={busy === r.id} onClick={() => act(r.id, "decline")} className="h-10 cursor-pointer rounded-xl bg-surface px-4 text-xs text-muted">نمی‌پذیرم</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {err && <p role="alert" className="mt-2 text-xs text-hot">{err}</p>}
    </section>
  );
}

export function ReviewForm({ orderNumber, items }: { orderNumber: number; items: { productId: string; name: string }[] }) {
  const router = useRouter();
  const [pid, setPid] = useState(items[0]?.productId ?? ""); const [rating, setRating] = useState(5); const [body, setBody] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  if (items.length === 0) return null;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const r = await api("POST", "/api/reviews", { orderNumber, productId: pid, rating, body });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, t: r.error.message });
    setMsg({ ok: true, t: "نظر شما ثبت شد و پس از بررسی نمایش داده می‌شود." }); setBody(""); router.refresh();
  }
  return (
    <section aria-label="ثبت نظر" className="rounded-2xl border border-border p-4">
      <h2 className="mb-3 text-sm font-black">نظر شما درباره کالاهای این سفارش</h2>
      <form onSubmit={submit} className="space-y-3 text-sm">
        <select value={pid} onChange={(e) => setPid(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-surface px-3">{items.map((i) => <option key={i.productId} value={i.productId}>{i.name}</option>)}</select>
        <div className="flex gap-1" role="radiogroup" aria-label="امتیاز">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} role="radio" aria-checked={rating === n} onClick={() => setRating(n)} className={`cursor-pointer text-2xl ${n <= rating ? "text-warning" : "text-border"}`}>★</button>)}</div>
        <textarea required minLength={5} rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="تجربه خود را بنویسید…" className="w-full rounded-xl border border-border bg-surface px-4 py-3 leading-7" />
        {msg && <p role="status" className={`text-xs ${msg.ok ? "text-success" : "text-hot"}`}>{msg.t}</p>}
        <button disabled={busy} className="h-11 cursor-pointer rounded-xl bg-primary px-6 text-xs font-bold text-primary-fg disabled:opacity-60">ثبت نظر</button>
      </form>
    </section>
  );
}
