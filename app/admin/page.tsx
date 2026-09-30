import Link from "next/link";
import { AlertTriangle, Banknote, Boxes, Clock, Package, PackageCheck, Percent, ShoppingBag, Store, Star, TrendingUp, UserPlus, Wallet, CalendarDays, ClipboardCheck } from "lucide-react";
import { Card, PageHead } from "@/components/admin/kit";
import { getCurrentUser } from "@/lib/server/auth/session";
import { redirect } from "next/navigation";
import { dashboardData } from "@/lib/server/admin/misc";
import { ADMIN_NAV, canSee } from "@/lib/admin/nav";
import { cn } from "@/lib/utils";

const fa = (n: number) => n.toLocaleString("fa-IR");
const toman = (n: number) => `${fa(n)} تومان`;
const STATUS: Record<string, string> = { PENDING_PAYMENT: "در انتظار پرداخت", PAYMENT_REVIEW: "بررسی پرداخت", PAID: "پرداخت شد", PROCESSING: "در حال پردازش", PREPARING: "آماده‌سازی", READY_TO_SHIP: "آماده ارسال", SHIPPED: "ارسال شد", IN_TRANSIT: "در مسیر", DELIVERED: "تحویل شد", CANCELLED: "لغو شد", REFUNDED: "مرجوع شد", REVIEW: "در بررسی" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/admin");
  const sp = await searchParams;
  if (!user.permissions.includes("dashboard.view")) {
    return (
      <>
        <PageHead title="به پنل مدیریت خوش آمدید" sub="بخش‌های در دسترس شما:" />
        <div className="grid gap-3 sm:grid-cols-3">{ADMIN_NAV.filter((n) => canSee(user.permissions, n) && n.href !== "/admin").map((n) => <Link key={n.href} href={n.href} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 font-bold hover:border-primary"><n.icon className="size-5 text-primary" />{n.label}</Link>)}</div>
      </>
    );
  }
  const d = await dashboardData();
  const max = Math.max(1, ...d.chart.map((c) => c.value));
  const tiles: { label: string; value: string; icon: typeof Clock; href?: string; tone?: string }[] = [
    { label: "کل سفارش‌ها", value: fa(d.totalOrders), icon: ShoppingBag, href: "/admin/orders" },
    { label: "در انتظار پرداخت", value: fa(d.pendingOrders), icon: Clock, href: "/admin/orders?status=PENDING_PAYMENT" },
    { label: "در انتظار بررسی پرداخت", value: fa(d.reviewOrders), icon: ClipboardCheck, href: "/admin/payments", tone: d.reviewOrders ? "text-hot" : "" },
    { label: "سفارش‌های پرداخت‌شده", value: fa(d.paidOrders), icon: PackageCheck, href: "/admin/orders?paymentStatus=PAID" },
    { label: "درآمد کل", value: toman(d.revenue), icon: Banknote },
    { label: "درآمد امروز", value: toman(d.revenueToday), icon: TrendingUp },
    { label: "درآمد این ماه", value: toman(d.revenueMonth), icon: CalendarDays },
    { label: "کالاهای کم‌موجودی", value: fa(d.lowStock), icon: AlertTriangle, href: "/admin/inventory?low=1", tone: d.lowStock ? "text-warning" : "" },
    { label: "درخواست همکاری در انتظار", value: fa(d.pendingWholesale), icon: Store, href: "/admin/wholesale" },
    { label: "نظرات در انتظار تأیید", value: fa(d.pendingReviews), icon: Star, href: "/admin/reviews" },
    { label: "مشتریان جدید (۳۰ روز)", value: fa(d.newCustomers), icon: UserPlus, href: "/admin/customers" },
    { label: "تعداد محصولات", value: fa(d.catalog.productCount), icon: Package, href: "/admin/products" },
    { label: "تعداد تنوع‌ها (Variant)", value: fa(d.catalog.variantCount), icon: Boxes, href: "/admin/products" },
    { label: "تنوع‌های ناموجود", value: fa(d.catalog.outOfStock), icon: AlertTriangle, href: "/admin/inventory", tone: d.catalog.outOfStock ? "text-hot" : "" },
    { label: "تخفیف‌های فعال", value: fa(d.catalog.activeDiscounts), icon: Percent, href: "/admin/discounts" },
  ];
  return (
    <>
      {sp.denied && <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">به آن بخش دسترسی ندارید.</div>}
      <PageHead title="داشبورد" sub="خلاصه وضعیت فروشگاه (داده‌ها مستقیم از پایگاه‌داده)" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => {
          const body = <Card className={cn("h-full transition-colors", t.href && "hover:border-primary")}><t.icon className={cn("mb-2 size-5 text-primary", t.tone)} /><div className="text-[11px] font-bold text-muted">{t.label}</div><div className={cn("mt-1 text-lg font-black", t.tone)}>{t.value}</div></Card>;
          return t.href ? <Link key={t.label} href={t.href}>{body}</Link> : <div key={t.label}>{body}</div>;
        })}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-black">فروش ۱۴ روز گذشته</h2>
          <div className="flex h-40 items-end gap-1.5" role="img" aria-label="نمودار فروش روزانه">
            {d.chart.map((c) => <div key={c.date} className="group relative flex h-full flex-1 items-end"><div className="w-full rounded-t bg-primary/80 transition-colors group-hover:bg-primary" style={{ height: `${Math.max(2, (c.value / max) * 100)}%` }} /><span className="pointer-events-none absolute -top-7 start-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-secondary px-2 py-0.5 text-[10px] text-secondary-fg group-hover:block">{new Date(c.date).toLocaleDateString("fa-IR", { day: "numeric", month: "short" })}: {toman(c.value)}</span></div>)}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted"><span>{new Date(d.chart[0]!.date).toLocaleDateString("fa-IR", { day: "numeric", month: "short" })}</span><span>امروز</span></div>
        </Card>
        <Card>
          <h2 className="mb-3 flex items-center justify-between text-sm font-black">کم‌موجودی<Link href="/admin/inventory?low=1" className="text-xs font-bold text-primary">همه</Link></h2>
          {d.lowList.length === 0 ? <p className="py-6 text-center text-sm text-muted">همه کالاها موجودی کافی دارند.</p> : <ul className="space-y-2 text-sm">{d.lowList.map((l) => <li key={l.variantId} className="flex items-center justify-between gap-2"><span className="truncate">{l.name} <span dir="ltr" className="text-xs text-muted">{l.sku}</span></span><b className={l.quantity === 0 ? "text-error" : "text-warning"}>{fa(l.quantity)}</b></li>)}</ul>}
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="mb-3 flex items-center justify-between text-sm font-black">سفارش‌های اخیر<Link href="/admin/orders" className="text-xs font-bold text-primary">همه</Link></h2>
          <ul className="divide-y divide-border text-sm">{d.recentOrders.map((o) => <li key={o.number}><Link href={`/admin/orders/${o.number}`} className="flex items-center justify-between gap-2 py-2 hover:text-primary"><span>#{o.number.toLocaleString("fa-IR", { useGrouping: false })} — {o.customerName}</span><span className="flex items-center gap-3 text-xs text-muted"><span>{STATUS[o.status]}</span><b className="text-foreground">{toman(o.total)}</b></span></Link></li>)}</ul>
          {d.recentOrders.length === 0 && <p className="py-6 text-center text-sm text-muted">هنوز سفارشی ثبت نشده.</p>}
        </Card>
        <Card>
          <h2 className="mb-3 flex items-center justify-between text-sm font-black">آخرین پرداخت‌ها<Link href="/admin/payments" className="text-xs font-bold text-primary">بررسی</Link></h2>
          <ul className="space-y-2 text-sm">{d.recentPayments.map((p) => <li key={p.id} className="flex items-center justify-between gap-2"><span className="flex items-center gap-1"><Wallet className="size-3.5 text-muted" />#{p.order.number.toLocaleString("fa-IR", { useGrouping: false })}</span><span className="text-xs text-muted">{STATUS[p.status]}</span><b>{toman(p.amount)}</b></li>)}</ul>
          {d.recentPayments.length === 0 && <p className="py-6 text-center text-sm text-muted">پرداختی ثبت نشده.</p>}
        </Card>
        <Card>
          <h2 className="mb-3 flex items-center justify-between text-sm font-black">تخفیف‌های در حال انقضا<Link href="/admin/discounts" className="text-xs font-bold text-primary">همه</Link></h2>
          {d.catalog.expiring.length === 0 ? <p className="py-6 text-center text-sm text-muted">تخفیفی در ۷ روز آینده منقضی نمی‌شود.</p> : <ul className="space-y-2 text-sm">{d.catalog.expiring.map((x) => <li key={x.id} className="flex items-center justify-between gap-2"><span className="truncate">{x.name}</span><span className="shrink-0 text-xs text-muted">{new Date(x.endsAt!).toLocaleDateString("fa-IR", { day: "numeric", month: "short" })}</span></li>)}</ul>}
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="mb-3 flex items-center justify-between text-sm font-black">آخرین تغییرات قیمت{user.permissions.includes("pricing.read") && <Link href="/admin/pricing?tab=history" className="text-xs font-bold text-primary">تاریخچه</Link>}</h2>
          {d.catalog.priceChanges.length === 0 ? <p className="py-6 text-center text-sm text-muted">تغییر قیمتی ثبت نشده.</p> : <ul className="divide-y divide-border text-sm">{d.catalog.priceChanges.map((c) => <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="min-w-0 truncate">{c.product.name}{c.variant ? <span dir="ltr" className="ms-1 text-[11px] text-muted">{c.variant.sku}</span> : null}</span><span className="text-xs"><s className="text-muted">{fa(c.oldPrice)}</s> ‹ <b>{fa(c.newPrice)}</b></span></li>)}</ul>}
        </Card>
      </div>
    </>
  );
}
