"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, ChevronLeft, ExternalLink, LogOut, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme";
import { ADMIN_NAV, BREADCRUMB, canSee } from "@/lib/admin/nav";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/admin/kit";

export interface Notice { label: string; count: number; href: string }
export interface ShellProps { user: { name: string; phone: string; roles: string[] }; perms: string[]; notices: Notice[]; children: React.ReactNode }

export function AdminShell({ user, perms, notices, children }: ShellProps) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [bell, setBell] = useState(false);
  const [menu, setMenu] = useState(false);
  const items = ADMIN_NAV.filter((n) => canSee(perms, n));
  const isActive = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));
  const segs = path.split("/").filter(Boolean).slice(1);
  const crumbs = [{ href: "/admin", label: "مدیریت" }, ...segs.map((s, i) => { const href = "/admin/" + segs.slice(0, i + 1).join("/"); return { href, label: BREADCRUMB[href] ?? (decodeURIComponent(s).length > 14 ? "جزئیات" : decodeURIComponent(s)) }; })];
  const total = notices.reduce((s, n) => s + n.count, 0);

  // Full navigation on purpose: drops all client state after signing out.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  const logout = async () => { await api("POST", "/api/auth/logout"); window.location.href = "/account"; };

  const nav = (
    <nav aria-label="منوی مدیریت" className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
      {items.map((n) => (
        <Link key={n.href} href={n.href} onClick={() => setOpen(false)} aria-current={isActive(n.href) ? "page" : undefined}
          className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-bold transition-colors", isActive(n.href) ? "bg-primary text-primary-fg shadow-sm" : "text-foreground/80 hover:bg-primary/10 hover:text-primary")}>
          <n.icon className="size-[18px] shrink-0" />{n.label}
          {n.href === "/admin/payments" && notices.find((x) => x.href === "/admin/payments")?.count ? <span className="ms-auto rounded-full bg-hot px-1.5 text-[10px] text-white">{notices.find((x) => x.href === "/admin/payments")!.count.toLocaleString("fa-IR")}</span> : null}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-surface-2 text-foreground">
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-60 flex-col border-e border-border bg-surface lg:flex">
        <div className="flex h-16 items-center px-5 text-xl font-black text-primary"><span dir="ltr">Case<span className="text-foreground">line</span></span><span className="ms-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px]">مدیریت</span></div>
        {nav}
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-lg">
            <div className="flex h-16 items-center justify-between px-5"><b className="text-lg text-primary">CaseLine مدیریت</b><button onClick={() => setOpen(false)} aria-label="بستن منو"><X className="size-5" /></button></div>
            {nav}
          </aside>
        </div>
      )}
      <div className="lg:ps-60">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
          <button className="grid size-10 cursor-pointer place-items-center rounded-md hover:bg-surface-2 lg:hidden" onClick={() => setOpen(true)} aria-label="باز کردن منو"><Menu className="size-5" /></button>
          <ol className="hidden min-w-0 items-center gap-1 text-xs text-muted sm:flex" aria-label="مسیر">
            {crumbs.map((c, i) => <li key={c.href} className="flex items-center gap-1">{i > 0 && <ChevronLeft className="size-3" />}{i === crumbs.length - 1 ? <b className="text-foreground">{c.label}</b> : <Link href={c.href} className="hover:text-primary">{c.label}</Link>}</li>)}
          </ol>
          <div className="ms-auto flex items-center gap-2">
            <Link href="/" target="_blank" className="hidden h-9 items-center gap-1 rounded-md px-3 text-xs font-bold hover:bg-surface-2 sm:flex"><ExternalLink className="size-3.5" />مشاهده سایت</Link>
            <ThemeToggle />
            <div className="relative">
              <button onClick={() => { setBell((b) => !b); setMenu(false); }} className="relative grid size-10 cursor-pointer place-items-center rounded-full hover:bg-surface-2" aria-label="اعلان‌ها">
                <Bell className="size-5" />{total > 0 && <span className="absolute end-1 top-1 grid min-w-4 place-items-center rounded-full bg-hot px-1 text-[10px] font-bold text-white">{total.toLocaleString("fa-IR")}</span>}
              </button>
              {bell && (
                <div className="absolute end-0 top-12 z-50 w-72 rounded-xl border border-border bg-surface p-2 shadow-lg">
                  <div className="px-2 py-1 text-xs font-black">نیازمند اقدام</div>
                  {notices.length === 0 && <div className="px-2 py-4 text-center text-xs text-muted">مورد جدیدی نیست 🎉</div>}
                  {notices.map((n) => <Link key={n.href} href={n.href} onClick={() => setBell(false)} className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-surface-2"><span>{n.label}</span><b className="rounded-full bg-hot px-2 text-xs text-white">{n.count.toLocaleString("fa-IR")}</b></Link>)}
                </div>
              )}
            </div>
            <div className="relative">
              <button onClick={() => { setMenu((m) => !m); setBell(false); }} className="flex h-10 cursor-pointer items-center gap-2 rounded-full bg-surface-2 px-2 pe-3 text-sm font-bold">
                <span className="grid size-7 place-items-center rounded-full bg-primary text-xs text-primary-fg">{user.name.slice(0, 1)}</span><span className="hidden max-w-28 truncate sm:block">{user.name}</span>
              </button>
              {menu && (
                <div className="absolute end-0 top-12 z-50 w-56 rounded-xl border border-border bg-surface p-2 shadow-lg">
                  <div className="px-2 py-1.5"><div className="text-sm font-black">{user.name}</div><div dir="ltr" className="text-start text-xs text-muted">{user.phone}</div><div className="mt-1 text-[11px] text-primary">{user.roles.join("، ")}</div></div>
                  <Link href="/account" className="block rounded-lg px-2 py-2 text-sm hover:bg-surface-2">حساب کاربری</Link>
                  <button onClick={logout} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-error hover:bg-error/10"><LogOut className="size-4" />خروج</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="p-4 sm:p-6">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
