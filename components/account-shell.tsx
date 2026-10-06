import Link from "next/link";
import { Bell, MessageCircle, MessageSquareText, Ticket, ShoppingBag, Star, Store, User, Wallet } from "lucide-react";
import { LogoutButton } from "@/components/account/logout-button";
import { BottomNav } from "@/components/header";
import { Header } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { Container } from "@/components/ui";
import { PartnerCard } from "@/components/account/partner-card";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/auth/session";
import { unreadCount } from "@/lib/server/notify";
import { cn } from "@/lib/utils";

// Order matches the three groups (orders & money, communication, my account). Shown as tiles so nothing is cut off on any screen.
const tabs = [
  { key: "orders", href: "/account/orders", label: "سفارش ها", Icon: ShoppingBag },
  { key: "wallet", href: "/account/wallet", label: "کیف پول", Icon: Wallet },
  { key: "points", href: "/account/points", label: "امتیاز باشگاه", Icon: Star },
  { key: "notifications", href: "/account/notifications", label: "اعلان‌ها", Icon: Bell },
  { key: "chat", href: "/account/chat", label: "چت آنلاین", Icon: MessageCircle },
  { key: "tickets", href: "/account/tickets", label: "تیکت‌های من", Icon: Ticket },
  { key: "reviews", href: "/account/reviews", label: "نظرات من", Icon: MessageSquareText },
  { key: "edit", href: "/account/edit", label: "اطلاعات حساب کاربری", Icon: User },
  { key: "wholesale", href: "/account/wholesale", label: "درخواست همکاری", Icon: Store },
];

/** Shared frame for the logged-in panel; redirects to the login page (via site.js) when there is no session. */
export async function AccountShell({ active, children }: { active: string; children: React.ReactNode }) {
  const user = await getCurrentUser();
  const [unread, chatUnread] = user ? await Promise.all([unreadCount(user.id), db.chatConversation.aggregate({ where: { userId: user.id, status: { not: "closed" } }, _sum: { unreadUser: true } }).then((r) => r._sum.unreadUser ?? 0)]) : [0, 0];
  // Approved partners see "همکاری عمده" (their portal); everyone else sees the application entry and, on the landing tab, the optional card.
  const partner = !!user?.wholesale;
  const appStatus = user && !partner ? (await db.wholesaleApplication.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { status: true } }))?.status ?? null : null;
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="py-6">
        <Container className="max-w-[790px]">
          <h1 className="sr-only">حساب کاربری</h1>
          <div className="rounded-[16px] border border-border bg-surface/90 p-3 shadow-md sm:p-4">
            <div className="flex justify-end"><LogoutButton /></div>
            <nav aria-label="پنل کاربری" className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5" data-testid="account-tiles">
              {tabs.map(({ key, href, label: base, Icon }) => {
                const label = key === "wholesale" && partner ? "همکاری عمده" : base;
                const badge = key === "notifications" ? unread : key === "chat" ? chatUnread : 0;
                return (
                  <Link key={key} href={href} aria-current={active === key ? "page" : undefined} className={cn("relative grid justify-items-center gap-1 rounded-[16px] border px-1.5 py-3 text-center text-[11px] leading-5 transition-all hover:-translate-y-0.5 sm:text-xs", active === key ? "border-transparent bg-primary font-bold text-primary-fg shadow-md" : "border-border bg-surface text-foreground hover:border-primary/40")}>
                    <Icon className={cn("size-5", active === key ? "" : "text-primary")} />{label}
                    {badge > 0 && <span className="absolute end-1.5 top-1.5 grid min-w-4 place-items-center rounded-md bg-hot px-1 text-[10px] font-bold leading-4 text-white" data-testid={`badge-${key}`}>{badge.toLocaleString("fa-IR")}</span>}
                  </Link>
                );
              })}
            </nav>
            <div className="p-1 pt-5 sm:p-2 sm:pt-6">{user?.mustChangePassword && <p role="alert" className="mb-4 rounded-[16px] border border-warning/40 bg-warning/10 p-3 text-xs leading-6" data-testid="must-change">رمز عبور شما موقت است. لطفاً در «اطلاعات حساب کاربری» یک رمز جدید انتخاب کنید{user.isStaff ? "؛ تا آن زمان پنل مدیریت بسته است" : ""}.</p>}{user && !partner && active === "orders" && <PartnerCard status={appStatus} />}{children}</div>
          </div>
        </Container>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
