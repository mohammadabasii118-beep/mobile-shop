import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtToman } from "@/lib/format";
import SignOutButton from "@/components/SignOutButton";
import MyPhoneForm from "@/components/MyPhoneForm";
import { fa } from "@/lib/format";

const statusLabel: Record<string, string> = {
  PENDING_PAYMENT: "در انتظار پرداخت", PAID: "پرداخت شده", PROCESSING: "در حال آماده‌سازی",
  SHIPPED: "ارسال شده", DELIVERED: "تحویل داده شده", CANCELED: "لغو شده",
};

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [orders, brands, models, me] = await Promise.all([
    db.order.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.phoneModel.findMany({ where: { brandId: { not: null } }, orderBy: { name: "asc" }, select: { id: true, name: true, brandId: true } }),
    db.user.findUnique({
      where: { id: session.user.id as string },
      select: { myBrandId: true, myPhoneModelId: true, walletBalance: true, loyaltyPoints: true, isWholesale: true },
    }),
  ]);

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold">سلام {session.user.name} 👋</h1>
          <p className="muted text-sm">{session.user.email}</p>
        </div>
        <SignOutButton />
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <Link href="/account/orders" className="text-sm font-medium px-4 h-10 flex items-center rounded-full border line">سفارش‌های من</Link>
        <Link href="/account/wishlist" className="text-sm font-medium px-4 h-10 flex items-center rounded-full border line">علاقه‌مندی‌ها</Link>
        <Link href="/account/wallet" className="text-sm font-medium px-4 h-10 flex items-center rounded-full border line">کیف پول و امتیازات</Link>
        <Link href="/account/support" className="text-sm font-medium px-4 h-10 flex items-center rounded-full border line">پشتیبانی</Link>
        {me?.isWholesale && (
          <Link href="/partner-dashboard" className="text-sm font-medium px-4 h-10 flex items-center rounded-full border line">پنل همکاری</Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-8">
        <Link href="/account/wallet" className="surface2 rounded-2xl p-4">
          <p className="text-xs muted mb-1">موجودی کیف پول</p>
          <p className="font-extrabold">{fmtToman(me?.walletBalance || 0)}</p>
        </Link>
        <Link href="/account/wallet" className="surface2 rounded-2xl p-4">
          <p className="text-xs muted mb-1">امتیاز باشگاه مشتریان</p>
          <p className="font-extrabold">{fa(me?.loyaltyPoints || 0)} امتیاز</p>
        </Link>
      </div>

      <div className="mb-8">
        <MyPhoneForm
          brands={brands}
          models={models.filter((m) => m.brandId).map((m) => ({ id: m.id, name: m.name, brandId: m.brandId as string }))}
          current={{ brandId: me?.myBrandId ?? null, phoneModelId: me?.myPhoneModelId ?? null }}
        />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">سفارش‌های اخیر</h2>
        <Link href="/account/orders" className="text-sm font-medium" style={{ color: "#404040" }}>مشاهده همه</Link>
      </div>
      {orders.length === 0 ? (
        <p className="muted text-sm">هنوز سفارشی ثبت نکرده‌اید.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <Link key={o.id} href={`/account/orders/${o.id}`} className="flex justify-between items-center surface border line rounded-2xl p-4">
              <div>
                <div className="font-medium text-sm">{o.orderNumber}</div>
                <div className="text-xs muted">{statusLabel[o.status]}</div>
              </div>
              <div className="font-bold text-sm">{fmtToman(o.total)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
