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
      <button onClick={cancel} disabled={busy} className="cursor-pointer rounded-[10px] bg-hot/10 px-5 py-2.5 text-xs font-bold text-hot hover:bg-hot/15 disabled:opacity-60">{busy ? "در حال لغو…" : "لغو سفارش"}</button>
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
    <section aria-label="بازگشت وجه" className="rounded-[16px] border border-border p-4">
      <h2 className="mb-2 text-sm font-extrabold">بازگشت وجه</h2>
      <ul className="space-y-3 text-[13px]">
        {refunds.map((r) => (
          <li key={r.id} className="rounded-[10px] bg-surface-2 p-3">
            <div className="flex items-center justify-between gap-2"><b>{formatToman(r.amount)} — {r.method === "wallet" ? "به کیف پول" : "به حساب بانکی"}</b><span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-bold">{RSTATUS[r.status]}</span></div>
            <p className="mt-1 text-[11px] text-muted">{r.reason}</p>
            {r.status === "COMPLETED" && r.bankReference && <p className="mt-1 text-[11px]">شماره پیگیری بانکی: <b dir="ltr">{r.bankReference}</b></p>}
            {r.status === "PENDING_BANK" && <p className="mt-1 text-[11px] text-muted">پس از واریز، شماره پیگیری بانکی همین‌جا نمایش داده می‌شود.</p>}
            {r.status === "AWAITING_CUSTOMER" && (
              <div className="mt-3 flex gap-2">
                <button disabled={busy === r.id} onClick={() => act(r.id, "accept")} className="h-10 flex-1 cursor-pointer rounded-[10px] bg-primary text-xs font-bold text-primary-fg disabled:opacity-60">تأیید و واریز به کیف پول</button>
                <button disabled={busy === r.id} onClick={() => act(r.id, "decline")} className="h-10 cursor-pointer rounded-[10px] bg-surface px-4 text-xs text-muted">نمی‌پذیرم</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {err && <p role="alert" className="mt-2 text-xs text-hot">{err}</p>}
    </section>
  );
}
