import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { AccountShell } from "@/components/account-shell";
import { requirePageUser } from "@/lib/server/auth/guard";
import { WALLET_TYPE_LABEL, walletHistory } from "@/lib/server/finance/wallet";
import { faDateTime, orderNo } from "@/lib/account-format";
import { formatToman } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "کیف پول | CaseLine", robots: { index: false } };

export default async function WalletPage() {
  const user = await requirePageUser("/account/wallet");
  const [w, pending] = await Promise.all([
    walletHistory(user.id, 50),
    db.refund.findMany({ where: { method: "wallet", status: "AWAITING_CUSTOMER", order: { userId: user.id } }, include: { order: { select: { number: true } } } }),
  ]);
  return (
    <AccountShell active="wallet">
      <div className="space-y-5">
        <section className="rounded-[16px] border border-border bg-surface-2 p-5">
          <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-[10px] bg-primary/12 text-primary"><Wallet className="size-5" /></span>
            <div><div className="text-xs text-muted">موجودی کیف پول</div><div className="text-2xl font-extrabold text-primary">{formatToman(w.balance)}</div></div></div>
          <p className="mt-3 text-[11px] leading-6 text-muted">اعتبار کیف پول از بازگشت وجه سفارش‌ها یا شارژ توسط پشتیبانی به‌دست می‌آید و هنگام پرداخت سفارش قابل استفاده است. این اعتبار جدا از امتیاز باشگاه است.</p>
        </section>

        {pending.length > 0 && (
          <section className="rounded-[16px] border border-primary/40 bg-primary/5 p-4 text-[13px]">
            <h2 className="mb-2 font-extrabold">بازگشت وجه در انتظار تأیید شما</h2>
            {pending.map((r) => <p key={r.id} className="py-1">{formatToman(r.amount)} برای سفارش <b>#{orderNo(r.order.number)}</b> — <Link href={`/account/orders/${r.order.number}`} className="font-bold text-primary">مشاهده و تأیید</Link></p>)}
          </section>
        )}

        <section>
          <h2 className="mb-3 text-[15px] font-extrabold">تاریخچه تراکنش‌ها</h2>
          {w.items.length === 0 ? <div className="rounded-[16px] border border-dashed border-primary/30 px-4 py-9 text-center text-xs text-muted">هنوز تراکنشی ثبت نشده است.</div> : (
            <ul className="divide-y divide-border/60 rounded-[16px] border border-border">
              {w.items.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3 text-[13px]">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full ${t.direction === "in" ? "bg-success/15 text-success" : "bg-hot/10 text-hot"}`}>{t.direction === "in" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}</span>
                  <span className="min-w-0 flex-1"><b className="block">{WALLET_TYPE_LABEL[t.type] ?? t.type}</b><span className="block truncate text-[11px] text-muted">{t.description}</span><span className="block text-[11px] text-muted">{faDateTime(t.createdAt)} · موجودی پس از تراکنش: {formatToman(t.balanceAfter)}</span></span>
                  <b className={t.direction === "in" ? "text-success" : "text-hot"} dir="ltr">{t.direction === "in" ? "+" : "−"}{t.amount.toLocaleString("fa-IR")}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AccountShell>
  );
}
