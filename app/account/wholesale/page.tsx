import type { Metadata } from "next";
import Link from "next/link";
import { Store } from "lucide-react";
import { AccountShell } from "@/components/account-shell";
import { WholesaleForm } from "@/components/account/wholesale-form";
import { requirePageUser } from "@/lib/server/auth/guard";
import { myApplication, partnerOverview } from "@/lib/server/wholesale-portal";
import { ORDER_STATUS_LABEL } from "@/lib/server/orders";
import { faDate, orderNo } from "@/lib/account-format";
import { formatToman, toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "همکاری با CaseLine | CaseLine", robots: { index: false } };
const STATUS: Record<string, [string, string]> = { PENDING: ["در حال بررسی", "bg-warning/15 text-warning"], CHANGES_REQUESTED: ["نیازمند اصلاح", "bg-primary/15 text-primary"], APPROVED: ["تأیید شده", "bg-success/15 text-success"], REJECTED: ["رد شده", "bg-hot/10 text-hot"] };

export default async function WholesalePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePageUser("/account/wholesale");
  const { q = "" } = await searchParams;
  const [app, ov] = await Promise.all([myApplication(user.id), partnerOverview(user, q.slice(0, 60))]);

  if (ov) {
    return (
      <AccountShell active="wholesale">
        <div className="space-y-5">
          <section className="rounded-2xl border border-border bg-surface-2 p-5">
            <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-success/15 text-success"><Store className="size-5" /></span>
              <div><div className="text-xs text-muted">همکار عمده — {ov.storeName}</div><div className="text-lg font-black">سطح {ov.tier.name}</div></div></div>
            <ul className="mt-3 space-y-1 text-[12px] leading-6 text-muted">
              <li>• حداقل مبلغ سفارش عمده: <b className="text-foreground">{formatToman(ov.tier.minOrder)}</b></li>
              <li>• قیمت عمده فقط وقتی اعمال می‌شود که تعداد هر کالا به «حداقل تعداد عمده» همان کالا برسد.</li>
              {ov.tier.extraDiscountPercent > 0 && <li>• تخفیف اضافه سطح شما: {toFa(ov.tier.extraDiscountPercent)}٪ روی قیمت عمده</li>}
            </ul>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
              <div className="rounded-xl bg-surface p-3"><dt className="text-[11px] text-muted">صرفه‌جویی از قیمت عمده (سفارش‌های پرداخت‌شده)</dt><dd className="mt-1 font-black text-success">{formatToman(ov.savings.wholesale)}</dd></div>
              <div className="rounded-xl bg-surface p-3"><dt className="text-[11px] text-muted">تخفیف کوپن و امتیاز دریافت‌شده</dt><dd className="mt-1 font-black text-success">{formatToman(ov.savings.couponAndPoints)}</dd></div>
            </dl>
          </section>
          <section>
            <div className="mb-2 flex items-center justify-between gap-2"><h2 className="text-[15px] font-black">قیمت‌های عمده مجاز شما</h2>
              <form className="flex gap-2"><input name="q" defaultValue={q} placeholder="جستجوی محصول" className="h-9 w-40 rounded-lg border border-border bg-surface px-3 text-xs" /><button className="h-9 cursor-pointer rounded-lg bg-surface-2 px-3 text-xs font-bold">جستجو</button></form></div>
            <div className="overflow-x-auto rounded-2xl border border-border"><table className="w-full min-w-[480px] text-[12px]"><thead><tr className="bg-surface-2 text-muted"><th className="p-2.5 text-start">محصول</th><th className="p-2.5 text-start">قیمت خرده</th><th className="p-2.5 text-start">قیمت عمده شما</th><th className="p-2.5 text-start">حداقل تعداد</th></tr></thead>
              <tbody className="divide-y divide-border/60">{ov.prices.map((p) => <tr key={p.slug}><td className="p-2.5"><Link href={`/product/${p.slug}`} className="font-bold hover:text-primary">{p.name}</Link></td><td className="p-2.5">{formatToman(p.retail)}</td><td className="p-2.5 font-black text-success">{p.wholesale != null ? formatToman(p.wholesale) : "—"}</td><td className="p-2.5">{toFa(p.minQty)}</td></tr>)}</tbody></table></div>
            {ov.prices.length === 0 && <p className="py-6 text-center text-xs text-muted">محصولی پیدا نشد.</p>}
          </section>
          <section>
            <h2 className="mb-2 text-[15px] font-black">سفارش‌های عمده</h2>
            {ov.orders.length === 0 ? <p className="rounded-2xl border border-dashed border-primary/30 px-4 py-8 text-center text-xs text-muted">هنوز سفارش عمده‌ای ثبت نکرده‌اید.</p> : (
              <ul className="divide-y divide-border/60 rounded-2xl border border-border text-[13px]">{ov.orders.map((o) => <li key={o.number}><Link href={`/account/orders/${o.number}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-surface-2"><b>#{orderNo(o.number)}</b><span className="text-[11px] text-muted">{faDate(o.createdAt)}</span><span className="text-[11px]">{ORDER_STATUS_LABEL[o.status]}</span><b>{formatToman(o.total)}</b></Link></li>)}</ul>
            )}
          </section>
        </div>
      </AccountShell>
    );
  }

  const st = app ? STATUS[app.status] : null;
  const canEdit = !app || app.status === "CHANGES_REQUESTED" || app.status === "REJECTED";
  const initial = { name: app?.name ?? user.displayName ?? "", phone: app?.phone ?? user.phone ?? "", province: app?.province ?? "", storeName: app?.storeName ?? "", businessType: app?.businessType ?? "online_shop", instagram: app?.instagram ?? "", website: app?.website ?? "", city: app?.city ?? "", address: app?.address ?? "", description: app?.description ?? "" };
  return (
    <AccountShell active="wholesale">
      <div className="space-y-4">
        <div><h2 className="text-base font-black">درخواست همکاری</h2><p className="mt-1 text-xs leading-6 text-muted">فروشندگان می‌توانند با ثبت درخواست و ارسال مدارک، پس از تأیید از قیمت‌های عمده و سطوح همکاری استفاده کنند. قیمت‌ها همیشه سمت سرور و بر اساس سطح تأییدشده شما محاسبه می‌شود.</p></div>
        {app && st && (
          <section className="rounded-2xl border border-border p-4 text-[13px]">
            <div className="flex items-center justify-between"><b>{app.storeName}</b><span className={`rounded-full px-3 py-1 text-[11px] font-bold ${st[1]}`}>{st[0]}</span></div>
            <p className="mt-1 text-[11px] text-muted">ثبت‌شده در {faDate(app.createdAt)}</p>
            {app.adminNote && <p className="mt-3 rounded-xl bg-primary/8 p-3 text-xs leading-6"><b>پیام بررسی‌کننده: </b>{app.adminNote}</p>}
            {app.status === "PENDING" && <p className="mt-3 text-xs text-muted">درخواست شما در صف بررسی است. نتیجه در بخش اعلان‌ها اطلاع داده می‌شود.</p>}
            {!canEdit && app.files.length > 0 && <ul className="mt-3 space-y-1 text-xs">{app.files.map((f) => <li key={f.id}><a href={`/api/wholesale/documents/${f.id}`} target="_blank" rel="noopener noreferrer" className="text-primary">{f.originalName}</a></li>)}</ul>}
          </section>
        )}
        {canEdit && <WholesaleForm key={app?.id ?? "new"} initial={initial} applicationId={app?.id ?? null} docs={app?.status === "CHANGES_REQUESTED" ? app.files.map((f) => ({ id: f.id, originalName: f.originalName })) : []} editing={app?.status === "CHANGES_REQUESTED"} />}
      </div>
    </AccountShell>
  );
}
