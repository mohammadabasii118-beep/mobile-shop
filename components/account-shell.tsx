import Link from "next/link";
import { MessagesSquare, ShoppingBag, User } from "lucide-react";
import { LogoutButton } from "@/components/account/logout-button";
import { BottomNav } from "@/components/header";
import { Header } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { Container } from "@/components/ui";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "orders", href: "/account/orders", label: "سفارش ها", Icon: ShoppingBag },
  { key: "tickets", href: "/account/tickets", label: "تیکت‌های پشتیبانی", Icon: MessagesSquare },
  { key: "edit", href: "/account/edit", label: "اطلاعات حساب کاربری", Icon: User },
];

/** Shared frame for the logged-in panel; redirects to the login page (via site.js) when there is no session. */
export function AccountShell({ active, children }: { active: string; children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="py-6">
        <Container className="max-w-[790px]">
          <div className="rounded-[28px] border border-border bg-surface/90 p-3 shadow-md sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <nav aria-label="پنل کاربری" className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-surface-2 p-1">
                {tabs.map(({ key, href, label, Icon }) => (
                  <Link key={key} href={href} className={cn("flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-medium text-muted transition-colors sm:text-[13px]", active === key ? "bg-surface font-bold text-primary shadow-sm" : "hover:text-foreground")}>
                    <Icon className="size-4" />{label}
                  </Link>
                ))}
              </nav>
              <LogoutButton />
            </div>
            <div className="p-1 pt-5 sm:p-2 sm:pt-6">{children}</div>
          </div>
        </Container>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
