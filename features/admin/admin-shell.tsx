"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search, X } from "lucide-react";
import { ADMIN_NAV } from "./nav";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/hooks/use-dialog";
import { cn } from "@/lib/utils";


function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="مدیریت" className="flex flex-col gap-0.5">
      {ADMIN_NAV.map(({ slug, label, icon: Icon }) => {
        const href = slug ? `/admin/${slug}` : "/admin";
        const active = path === href;
        return (
          <a
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
              active ? "bg-secondary text-fg shadow-[inset_-2px_0_0_var(--accent)]" : "text-muted hover:bg-secondary/60 hover:text-fg",
            )}
          >
            <Icon className="size-[18px]" aria-hidden />
            {label}
          </a>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useDialog(open, () => setOpen(false));

  return (
    <div className="surface-dark min-h-dvh overflow-x-clip bg-bg text-fg">
      {/* Sidebar دسکتاپ — سمت start (راست) */}
      <aside className="fixed inset-y-0 start-0 hidden w-64 flex-col gap-6 border-e border-line bg-surface p-4 lg:flex">
        <div className="flex items-center justify-between"><Logo /><span className="t-caption rounded-full bg-secondary px-2 text-muted">ادمین</span></div>
        <Nav />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} aria-hidden />
          <div ref={ref} role="dialog" aria-modal="true" aria-label="منوی مدیریت" tabIndex={-1} className="absolute inset-y-0 start-0 w-72 overflow-auto bg-surface p-4 shadow-float">
            <div className="mb-4 flex items-center justify-between"><Logo /><Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="بستن"><X /></Button></div>
            <Nav onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="min-w-0 lg:ps-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-md md:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="باز کردن منو"><Menu /></Button>
          <label className="flex min-h-11 w-full max-w-sm items-center gap-2 rounded-full bg-secondary px-4 text-sm text-muted focus-within:shadow-[0_0_0_2px_var(--accent)]">
            <Search className="size-4" aria-hidden />
            <input placeholder="جستجوی سفارش، مشتری، محصول…" aria-label="جستجو در مدیریت" className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-muted" />
          </label>
          <div className="ms-auto flex items-center gap-3">
            <a href="/" className="hidden text-sm text-muted hover:text-fg sm:inline">مشاهدهٔ فروشگاه</a>
            <span className="grid size-10 place-items-center rounded-full bg-accent text-sm font-bold text-accent-fg" aria-label="حساب مدیر">م</span>
          </div>
        </header>
        <main id="main" className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
