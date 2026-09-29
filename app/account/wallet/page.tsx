import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtToman, fa } from "@/lib/format";

export const metadata = { title: "کیف پول و باشگاه مشتریان" };

export default async function WalletPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const userId = session.user.id as string;

  const [user, walletTx, loyaltyTx] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { walletBalance: true, loyaltyPoints: true } }),
    db.walletTransaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.loyaltyTransaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-extrabold">کیف پول و باشگاه مشتریان</h1>
        <Link href="/account" className="text-sm font-medium" style={{ color: "#404040" }}>بازگشت به حساب کاربری</Link>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        <div className="surface border line rounded-2xl p-5">
          <p className="text-xs muted mb-1">موجودی کیف پول</p>
          <p className="text-2xl font-extrabold">{fmtToman(user?.walletBalance || 0)}</p>
          <p className="text-xs muted mt-2">
            در حال حاضر امکان شارژ مستقیم کیف پول وجود ندارد — موجودی فقط از طریق بازگشت وجه سفارش (توسط مدیر) یا اصلاحیه‌ی دستی مدیر افزایش می‌یابد. از این موجودی می‌توانید هنگام تکمیل خرید (در صورت کافی‌بودن برای کل مبلغ سفارش) استفاده کنید.
          </p>
        </div>
        <div className="surface border line rounded-2xl p-5">
          <p className="text-xs muted mb-1">امتیاز باشگاه مشتریان</p>
          <p className="text-2xl font-extrabold">{fa(user?.loyaltyPoints || 0)} امتیاز</p>
          <p className="text-xs muted mt-2">به ازای هر ۱۰٬۰۰۰ تومان از سفارش‌های واقعاً پرداخت‌شده، ۱ امتیاز دریافت می‌کنید. در حال حاضر امکان تبدیل امتیاز به تخفیف هنوز فعال نشده است.</p>
        </div>
      </div>

      <h2 className="text-lg font-bold mb-3">تراکنش‌های کیف پول</h2>
      {walletTx.length === 0 ? (
        <p className="muted text-sm mb-8">هنوز تراکنشی در کیف پول شما ثبت نشده است.</p>
      ) : (
        <div className="flex flex-col gap-2 mb-8">
          {walletTx.map((t) => (
            <div key={t.id} className="flex justify-between items-center surface2 rounded-xl p-3 text-sm">
              <div>
                <p>{t.reason}</p>
                <p className="text-xs muted mt-0.5">{new Date(t.createdAt).toLocaleString("fa-IR")}</p>
              </div>
              <span className="font-bold" style={{ color: t.amount >= 0 ? "#2f6f4e" : "#a24e56" }}>
                {t.amount >= 0 ? "+" : ""}
                {fmtToman(t.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-lg font-bold mb-3">تاریخچه‌ی امتیاز</h2>
      {loyaltyTx.length === 0 ? (
        <p className="muted text-sm">هنوز امتیازی دریافت نکرده‌اید.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {loyaltyTx.map((t) => (
            <div key={t.id} className="flex justify-between items-center surface2 rounded-xl p-3 text-sm">
              <div>
                <p>{t.reason}</p>
                <p className="text-xs muted mt-0.5">{new Date(t.createdAt).toLocaleString("fa-IR")}</p>
              </div>
              <span className="font-bold" style={{ color: "#2f6f4e" }}>+{fa(t.points)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
