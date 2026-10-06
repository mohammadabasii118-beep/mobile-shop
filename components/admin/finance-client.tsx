"use client";
import { useMemo, useState } from "react";
import { Card, Empty, ErrorBox, Label, Modal, Pager, Pill, Spinner, Table, Td, act, btnGhost, btnPrimary, fmtDate, fmtNum, fmtToman, inputCls, useApi } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

interface U { id: string; phone: string | null; displayName: string | null; firstName: string | null; lastName: string | null }
const nm = (u: U) => u.displayName ?? ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.phone);
const WT: Record<string, string> = { admin_credit: "افزایش توسط ادمین", admin_debit: "کاهش توسط ادمین", order_payment: "پرداخت سفارش", order_cancel_restore: "بازگشت اعتبار لغو سفارش", refund_credit: "بازگشت وجه", credit: "افزایش", debit: "کاهش", refund: "بازگشت وجه", admin_adjustment: "اصلاح" };
const LT: Record<string, string> = { earn: "کسب", redeem: "مصرف", restore: "بازگشت مصرف", reverse: "کسر لغو/مرجوعی", admin_adjustment: "اصلاح ادمین", expire: "انقضا" };
const newKey = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function AdjustModal({ kind, user, canAdjust, onClose, onDone }: { kind: "wallet" | "loyalty"; user: U; canAdjust: boolean; onClose: () => void; onDone: () => void }) {
  const { data, loading, reload } = useApi<{ balance?: number; points?: number; items: { id: string; direction?: string; amount?: number; points?: number; type: string; balanceBefore?: number; balanceAfter?: number; pointsBefore?: number; pointsAfter?: number; reference: string | null; description: string | null; createdAt: string }[] }>(`/api/admin/${kind}/${user.id}`);
  const [dir, setDir] = useState<"in" | "out">("in"); const [amount, setAmount] = useState(""); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false);
  const [k, setK] = useState(newKey); // one key per form "session": a double-click or retry can never apply twice
  const unit = kind === "wallet" ? "تومان" : "امتیاز";
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const r = await act("POST", `/api/admin/${kind}/${user.id}/adjust`, { direction: dir, amount: Number(amount), reason, key: k }, "ثبت شد.");
    setBusy(false);
    if (r.ok) { setAmount(""); setReason(""); setK(newKey()); reload(); onDone(); }
  };
  return (
    <Modal title={`${kind === "wallet" ? "کیف پول" : "امتیاز"} — ${nm(user)}`} onClose={onClose} wide>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <div className="mb-3 text-sm">{kind === "wallet" ? "موجودی" : "امتیاز"} فعلی: <b className="text-lg">{loading ? "…" : kind === "wallet" ? fmtToman(data?.balance) : fmtNum(data?.points)}</b></div>
          {canAdjust ? (
            <form onSubmit={submit} className="space-y-3">
              <div className="flex gap-1 rounded-lg bg-surface-2 p-1">{([["in", "افزایش"], ["out", "کاهش"]] as const).map(([d, l]) => <button type="button" key={d} onClick={() => setDir(d)} className={cn("h-9 flex-1 cursor-pointer rounded-md text-sm font-bold", dir === d ? "bg-primary text-primary-fg" : "")}>{l}</button>)}</div>
              <Label label={`مقدار (${unit})`}><input dir="ltr" type="number" min={1} required className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} /></Label>
              <Label label="دلیل (الزامی، در تاریخچه ثبت می‌شود)"><input required minLength={3} maxLength={300} className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} /></Label>
              <button className={cn(btnPrimary, "w-full")} disabled={busy || !amount || reason.trim().length < 3}>{busy ? "…" : "ثبت"}</button>
            </form>
          ) : <p className="text-xs text-muted">شما مجوز تغییر ندارید.</p>}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-black">تراکنش‌ها</h3>
          {loading ? <Spinner /> : !data?.items.length ? <Empty text="تراکنشی نیست." /> : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto text-xs">{data.items.map((t) => {
              const delta = kind === "wallet" ? (t.direction === "in" ? t.amount! : -t.amount!) : t.points!;
              return <li key={t.id} className="py-2"><div className="flex items-center justify-between"><b dir="ltr" className={delta > 0 ? "text-success" : "text-error"}>{delta > 0 ? "+" : ""}{fmtNum(delta)}</b><span className="text-muted">{fmtNum(kind === "wallet" ? t.balanceBefore : t.pointsBefore)} ← {fmtNum(kind === "wallet" ? t.balanceAfter : t.pointsAfter)}</span><span className="text-muted">{fmtDate(t.createdAt)}</span></div><div className="text-muted">{(kind === "wallet" ? WT : LT)[t.type] ?? t.type}{t.description ? ` — ${t.description}` : ""}</div>{t.reference && <div dir="ltr" className="truncate text-start text-[10px] text-muted">{t.reference}</div>}</li>;
            })}</ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function FinanceClient({ kind, canAdjust }: { kind: "wallet" | "loyalty"; canAdjust: boolean }) {
  const [view, setView] = useState<"balances" | "transactions">("balances"); const [q, setQ] = useState(""); const [page, setPage] = useState(1); const [sel, setSel] = useState<U | null>(null);
  const url = useMemo(() => `/api/admin/${kind}?view=${view}&page=${page}${q ? `&q=${encodeURIComponent(q)}` : ""}`, [kind, view, page, q]);
  type Tx = { id: string; type: string; direction?: string; amount?: number; points?: number; balanceBefore?: number; balanceAfter?: number; pointsBefore?: number; pointsAfter?: number; reference: string | null; description: string | null; createdAt: string; wallet?: { user: U }; account?: { user: U } };
  const { data, error, loading, reload } = useApi<{ view: string; items: (U & { balance: number; points: number } & Tx)[]; total: number; page: number; pages: number; sum?: number; rules?: Record<string, number | boolean | string> }>(url);
  const unit = kind === "wallet" ? "تومان" : "امتیاز";
  return (
    <div className="space-y-4">
      {kind === "loyalty" && data?.rules && (
        <Card className="text-xs leading-7"><b>قوانین فعلی:</b> هر {fmtToman(data.rules.amountPerPoint as number)} کالا = ۱ امتیاز ({data.rules.earnOn === "payment" ? "پس از تأیید پرداخت" : "پس از تحویل"})، هر امتیاز {fmtToman(data.rules.pointValue as number)} تخفیف، حداقل {fmtNum(data.rules.minRedeemPoints as number)} امتیاز و حداکثر {fmtNum(data.rules.maxRedeemPercent as number)}٪ سفارش. {data.rules.enabled ? "" : <Pill tone="bad">غیرفعال</Pill>} — <a href="/admin/settings" className="font-bold text-primary">ویرایش قوانین در تنظیمات</a></Card>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-surface p-1 shadow-sm">{([["balances", "کاربران"], ["transactions", "همه تراکنش‌ها"]] as const).map(([v, l]) => <button key={v} onClick={() => { setView(v); setPage(1); }} className={cn("h-9 cursor-pointer rounded-md px-4 text-sm font-bold", view === v ? "bg-primary text-primary-fg" : "hover:bg-surface-2")}>{l}</button>)}</div>
        <input className={cn(inputCls, "max-w-64")} placeholder={view === "balances" ? "جستجوی کاربر (نام یا موبایل)…" : "موبایل، شناسه مرجع یا توضیح…"} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="جستجو" />
        {data?.sum != null && view === "balances" && <span className="ms-auto text-xs text-muted">جمع کل {kind === "wallet" ? "اعتبار کیف پول‌ها" : "امتیازها"}: <b className="text-foreground">{kind === "wallet" ? fmtToman(data.sum) : fmtNum(data.sum)}</b></span>}
      </div>
      {error ? <ErrorBox message={error} /> : loading ? <Spinner /> : !data?.items.length ? <Empty text={view === "balances" && !q ? "هنوز حسابی با اعتبار وجود ندارد. با جستجوی کاربر می‌توانید برای او اعتبار ثبت کنید." : "موردی نیست."} /> : (
        <>
          {view === "balances" ? (
            <Table head={["کاربر", "موبایل", kind === "wallet" ? "موجودی" : "امتیاز", ""]}>
              {data.items.map((u) => <tr key={u.id} className="hover:bg-surface-2/60"><Td className="font-bold">{nm(u)}</Td><Td><span dir="ltr">{u.phone}</span></Td><Td className="font-black">{kind === "wallet" ? fmtToman(u.balance) : fmtNum(u.points)}</Td><Td className="text-end"><button className={cn(btnGhost, "h-8 px-3 text-xs")} onClick={() => setSel(u)}>{canAdjust ? "مدیریت / تاریخچه" : "تاریخچه"}</button></Td></tr>)}
            </Table>
          ) : (
            <Table head={["زمان", "کاربر", "نوع", `مقدار (${unit})`, "قبل ← بعد", "مرجع / توضیح"]}>
              {data.items.map((t) => { const u: U = (t.wallet ?? t.account)!.user; const delta = (kind === "wallet" ? (t.direction === "in" ? t.amount : -(t.amount ?? 0)) : t.points) ?? 0; return (
                <tr key={t.id}><Td className="text-xs">{fmtDate(t.createdAt)}</Td><Td>{nm(u)}</Td><Td>{(kind === "wallet" ? WT : LT)[t.type] ?? t.type}</Td><Td><b dir="ltr" className={delta > 0 ? "text-success" : "text-error"}>{delta > 0 ? "+" : ""}{fmtNum(delta)}</b></Td><Td className="text-xs text-muted">{fmtNum(kind === "wallet" ? t.balanceBefore : t.pointsBefore)} ← {fmtNum(kind === "wallet" ? t.balanceAfter : t.pointsAfter)}</Td><Td className="max-w-56 truncate text-xs text-muted">{t.description}<div dir="ltr" className="text-start text-[10px]">{t.reference}</div></Td></tr>); })}
            </Table>
          )}
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
        </>
      )}
      {sel && <AdjustModal kind={kind} user={sel} canAdjust={canAdjust} onClose={() => setSel(null)} onDone={reload} />}
    </div>
  );
}
