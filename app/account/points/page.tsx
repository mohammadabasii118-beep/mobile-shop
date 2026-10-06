import type { Metadata } from "next";
import { Star } from "lucide-react";
import { db } from "@/lib/db";
import { AccountShell } from "@/components/account-shell";
import { requirePageUser } from "@/lib/server/auth/guard";
import { getLoyaltyRules } from "@/lib/server/finance/loyalty";
import { faDateTime } from "@/lib/account-format";
import { formatToman, toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "امتیاز باشگاه مشتریان | CaseLine", robots: { index: false } };
const LABEL: Record<string, string> = { earn: "کسب امتیاز", redeem: "استفاده از امتیاز", restore: "بازگشت امتیاز مصرف‌شده", reverse: "کسر امتیاز (لغو/مرجوعی)", admin_adjustment: "اصلاح توسط پشتیبانی", expire: "انقضا" };

export default async function PointsPage() {
  const user = await requirePageUser("/account/points");
  const [acc, rules] = await Promise.all([db.loyaltyAccount.findUnique({ where: { userId: user.id }, include: { transactions: { orderBy: { createdAt: "desc" }, take: 50 } } }), getLoyaltyRules()]);
  const points = acc?.points ?? 0;
  return (
    <AccountShell active="points">
      <div className="space-y-5">
        <section className="rounded-[16px] border border-border bg-surface-2 p-5">
          <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-[10px] bg-warning/15 text-warning"><Star className="size-5" /></span>
            <div><div className="text-xs text-muted">امتیاز شما</div><div className="text-2xl font-extrabold">{toFa(points)}</div></div>
            {rules.enabled && rules.redeemEnabled && <div className="ms-auto text-end text-xs text-muted">ارزش تقریبی<br /><b className="text-foreground">{formatToman(points * rules.pointValue)}</b></div>}</div>
          {rules.enabled ? (
            <ul className="mt-4 space-y-1.5 text-[12px] leading-6 text-muted">
              <li>• به ازای هر {formatToman(rules.amountPerPoint)} خرید کالا (بعد از تخفیف) ۱ امتیاز می‌گیرید{rules.minOrderTotal > 0 ? `؛ حداقل مبلغ کالا ${formatToman(rules.minOrderTotal)}` : ""}.</li>
              <li>• امتیاز {rules.earnOn === "payment" ? "پس از تأیید پرداخت سفارش" : "پس از تحویل سفارش"} اضافه می‌شود؛ در صورت لغو یا مرجوعی کامل، برگردانده می‌شود.</li>
              {rules.redeemEnabled && <li>• هر امتیاز {formatToman(rules.pointValue)} تخفیف دارد؛ حداقل {toFa(rules.minRedeemPoints)} امتیاز و حداکثر {toFa(rules.maxRedeemPercent)}٪ مبلغ کالا در صفحه پرداخت قابل استفاده است.</li>}
              <li>• امتیاز جدا از کیف پول است و به پول نقد تبدیل نمی‌شود.</li>
            </ul>
          ) : <p className="mt-3 text-xs text-muted">باشگاه مشتریان در حال حاضر غیرفعال است.</p>}
        </section>
        <section>
          <h2 className="mb-3 text-[15px] font-extrabold">تاریخچه امتیازها</h2>
          {!acc || acc.transactions.length === 0 ? <div className="rounded-[16px] border border-dashed border-primary/30 px-4 py-9 text-center text-xs text-muted">هنوز امتیازی ثبت نشده است.</div> : (
            <ul className="divide-y divide-border/60 rounded-[16px] border border-border">
              {acc.transactions.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3 text-[13px]">
                  <span className="min-w-0 flex-1"><b className="block">{LABEL[t.type] ?? t.type}</b><span className="block truncate text-[11px] text-muted">{t.description}</span><span className="block text-[11px] text-muted">{faDateTime(t.createdAt)} · مانده: {toFa(t.pointsAfter)}</span></span>
                  <b className={t.points > 0 ? "text-success" : "text-hot"} dir="ltr">{t.points > 0 ? "+" : "−"}{Math.abs(t.points).toLocaleString("fa-IR")}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AccountShell>
  );
}
