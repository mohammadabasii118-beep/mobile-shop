import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminSignOut from "@/components/admin/AdminSignOut";
import AdminSearchBox from "@/components/admin/AdminSearchBox";
import AdminAlertBell from "@/components/admin/AdminAlertBell";
import AdminMobileNav from "@/components/admin/AdminMobileNav";

// `staffPermission`: undefined = ADMIN-only; "self" = any signed-in staff
// (self-service page, no other staff's data); a string = staff with that
// exact permission. Kept next to `middleware.ts`'s STAFF_ALLOWED list —
// changing one without the other means either a staff member sees a link
// they'll be redirected away from, or can reach a page with no link to it.
const nav: { href: string; label: string; icon: string; staffPermission?: string }[] = [
  { href: "/admin", label: "داشبورد", icon: "📊" },
  { href: "/admin/products", label: "محصولات", icon: "📦" },
  { href: "/admin/categories", label: "دسته‌بندی‌ها", icon: "🗂️" },
  { href: "/admin/attributes/brands", label: "برندهای گوشی", icon: "🍏" },
  { href: "/admin/attributes/models", label: "مدل‌های گوشی", icon: "📱" },
  { href: "/admin/attributes/colors", label: "رنگ‌ها", icon: "🎨" },
  { href: "/admin/orders", label: "سفارش‌ها", icon: "🧾" },
  { href: "/admin/card-transfers", label: "پرداخت‌های کارت‌به‌کارت", icon: "💳" },
  { href: "/admin/partners", label: "درخواست‌های همکاری", icon: "🤝" },
  { href: "/admin/users", label: "کاربران", icon: "👥" },
  { href: "/admin/staff", label: "حساب‌های کارمند", icon: "🧑‍💼" },
  { href: "/admin/discounts", label: "کدهای تخفیف", icon: "🏷️" },
  { href: "/admin/wholesale-tiers", label: "پله‌های تخفیف عمده", icon: "📶" },
  { href: "/admin/support", label: "پشتیبانی (تیکت‌ها)", icon: "🎫", staffPermission: "SUPPORT" },
  { href: "/admin/contact-messages", label: "پیام‌های تماس با ما", icon: "✉️", staffPermission: "SUPPORT" },
  { href: "/admin/questions", label: "پرسش‌های محصولات", icon: "❓", staffPermission: "SUPPORT" },
  { href: "/admin/pages", label: "صفحات محتوایی", icon: "📄" },
  { href: "/admin/pricing-rules", label: "قوانین قیمت‌گذاری", icon: "⚙️" },
  { href: "/admin/homepage", label: "صفحه اصلی", icon: "🏠" },
  { href: "/admin/inventory", label: "انبار (موجودی کم)", icon: "📉" },
  { href: "/admin/reports", label: "گزارش‌های مالی", icon: "📈" },
  { href: "/admin/automation", label: "اتوماسیون", icon: "🤖" },
  { href: "/admin/alerts", label: "هشدارها", icon: "🔔" },
  { href: "/admin/security", label: "امنیت حساب (۲FA)", icon: "🔐", staffPermission: "self" },
  { href: "/admin/settings", label: "تنظیمات کارت بانکی", icon: "🏦" },
];

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const role = session && (session.user as any).role;
  if (!session || (role !== "ADMIN" && role !== "STAFF")) redirect("/admin/login");
  const isStaff = role === "STAFF";
  const permissions: string[] = isStaff ? (session.user as any).permissions || [] : [];
  const visibleNav = nav.filter((n) => {
    if (!isStaff) return true; // ADMIN sees everything
    if (n.staffPermission === "self") return true;
    return !!n.staffPermission && permissions.includes(n.staffPermission);
  });
  const unreadAlerts = !isStaff ? await db.adminAlert.count({ where: { isRead: false } }) : 0;

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }} dir="rtl">
      <aside className="w-60 shrink-0 border-l line surface hidden md:flex flex-col">
        <div className="h-16 flex items-center gap-2 px-5 border-b line">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: "var(--ink)" }}>CL</span>
          <span className="font-extrabold">پنل مدیریت</span>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {visibleNav.map((n) => (
            <Link key={n.href} href={n.href} className="flex items-center gap-2 px-3 h-10 rounded-lg text-sm hover:bg-[var(--surface-2)]">
              <span>{n.icon}</span>{n.label}
              {n.href === "/admin/alerts" && unreadAlerts > 0 && (
                <span className="mr-auto text-xs font-bold px-2 rounded-full text-white" style={{ background: "#a24e56" }}>{unreadAlerts}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t line">
          <AdminSignOut />
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        <div className="hidden md:flex h-16 items-center gap-4 px-8 border-b line surface">
          <AdminSearchBox />
          {!isStaff && <AdminAlertBell count={unreadAlerts} />}
        </div>
        <div className="md:hidden flex flex-col gap-2 px-4 py-3 border-b line surface">
          <div className="flex items-center justify-between gap-2">
            <AdminMobileNav
              items={visibleNav.map((n) => ({ href: n.href, label: n.label, icon: n.icon }))}
              unreadAlerts={unreadAlerts}
            />
            <span className="font-extrabold text-sm flex-1 min-w-0 truncate text-center">پنل مدیریت کیس لاین</span>
            {!isStaff && <AdminAlertBell count={unreadAlerts} />}
            <AdminSignOut />
          </div>
          <AdminSearchBox />
        </div>
        <div className="p-4 md:p-8">{children}</div>
      </div>
    </div>
  );
}
