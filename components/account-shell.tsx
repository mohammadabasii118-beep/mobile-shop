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

const tabs = [
  { key: "orders", href: "/account/orders", label: "سفارش ها", Icon: ShoppingBag },
  { key: "wallet", href: "/account/wallet", label: "کیف پول", Icon: Wallet },
  { key: "points", href: "/account/points", label: "امتیاز باشگاه", Icon: Star },
  { key: "reviews", href: "/account/reviews", label: "نظرات من", Icon: MessageSquareText },
  { key: "notifications", href: "/account/notifications", label: "اعلان‌ها", Icon: Bell },
  { key: "chat", href: "/account/chat", label: "چت آنلاین", Icon: MessageCircle },
  { key: "tickets", href: "/account/tickets", label: "تیکت‌های من", Icon: Ticket },
  { key: "wholesale", href: "/account/wholesale", label: "درخواست همکاری", Icon: Store },
  { key: "edit", href: "/account/edit", label: "اطلاعات حساب کاربری", Icon: User },
];

/** Shared frame for the logged-in panel; redirects to the login page (via site.js) when there is no session. */
export async function AccountShell({ active, children }: { active: string; children: React.ReactNode }) {
  const user = await getCurrentUser();
  const unread = user ? await unreadCount(user.id) : 0;
  // Approved partners see "همکاری عمده" (their portal); everyone else sees the application entry and, on the landing tab, the optional card.
  const partner = !!user?.wholesale;
  const appStatus = user && !partner ? (await db.wholesaleApplication.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { status: true } }))?.status ?? null : null;
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="py-6">
        <Container className="max-w-[790px]">
          <h1 className="sr-only">حساب کاربری</h1>
          <div className="rounded-[28px] border border-border bg-surface/90 p-3 shadow-md sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <nav aria-label="پنل کاربری" className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-surface-2 p-1">
                {tabs.map(({ key, href, label: base, Icon }) => { const label = key === "wholesale" && partner ? "همکاری عمده" : base; return (
                  <Link key={key} href={href} className={cn("flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-medium text-muted transition-colors sm:text-[13px]", active === key ? "bg-surface font-bold text-primary shadow-sm" : "hover:text-foreground")}>
                    <Icon className="size-4" />{label}{key === "notifications" && unread > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-hot px-1 text-[10px] font-bold text-white">{unread.toLocaleString("fa-IR")}</span>}
                  </Link>
                ); })}
              </nav>
              <LogoutButton />
            </div>
            <div className="p-1 pt-5 sm:p-2 sm:pt-6">{user?.mustChangePassword && <p role="alert" className="mb-4 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-xs leading-6" data-testid="must-change">رمز عبور شما موقت است. لطفاً در «اطلاعات حساب کاربری» یک رمز جدید انتخاب کنید{user.isStaff ? "؛ تا آن زمان پنل مدیریت بسته است" : ""}.</p>}{user && !partner && active === "orders" && <PartnerCard status={appStatus} />}{children}</div>
          </div>
        </Container>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
