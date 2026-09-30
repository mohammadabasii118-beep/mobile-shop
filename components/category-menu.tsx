"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Headphones, LayoutGrid, Menu, PenLine, Smartphone, Sparkles, Store, User, Watch, X, Zap } from "lucide-react";
import { NightButton } from "@/components/theme";
import type { MenuCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const icons = { cases: Smartphone, airpods: Headphones, watch: Watch, electric: Zap, accessories: Sparkles } as const;
const iconFor = (slug: string) => icons[slug as keyof typeof icons] ?? Sparkles;

export function useCloseDetails() {
  useEffect(() => {
    const close = (e: Event) => {
      document.querySelectorAll<HTMLDetailsElement>("details[data-menu][open]").forEach((d) => {
        if (!d.contains(e.target as Node)) d.open = false;
      });
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close(e);
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", esc); };
  }, []);
}

/** Desktop mega menu: category list on the right, popular products for the hovered category on the left. */
export function CategoryMenu({ menu }: { menu: MenuCategory[] }) {
  useCloseDetails();
  return (
    <details data-menu className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full bg-primary/10 px-3.5 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15 [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />دسته‌بندی‌ها<LayoutGrid className="size-4" />
      </summary>
      <div className="mega border border-border bg-surface absolute start-0 top-[calc(100%+1.1rem)] z-50 w-[min(92vw,520px)] rounded-xl p-4 shadow-lg">
        <ul className="relative grid min-h-[250px] grid-cols-[210px_1fr] content-start gap-x-0 gap-y-1">
          {menu.map((c) => (
            <li key={c.slug} tabIndex={0} className="col-start-1">
              <Link href={`/shop#${c.slug}`} className="mega-item flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium">
                <span>{c.label}</span>{(() => { const I = iconFor(c.slug); return <I className="size-4 text-primary" />; })()}
              </Link>
              <div className="mega-panel absolute inset-y-0 end-0 hidden w-[calc(100%-210px)] flex-col border-s border-border ps-4">
                <div className="flex flex-col gap-0.5">
                  {c.subs.map((sb) => <Link key={sb.slug} href={`/shop#${sb.slug}`} className="rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-primary/10 hover:text-primary">{sb.label}</Link>)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

/** Mobile menu: hamburger opens a glass side sheet — categories, then account / shop / blog / support and the night-mode switch. */
export function MobileMenu({ menu, links = [], loggedIn, logo, name, className }: { menu: MenuCategory[]; links?: { label: string; link: string }[]; loggedIn?: boolean; logo?: string; name?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [open]);
  const close = () => setOpen(false);
  const row = "flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-medium transition-colors hover:bg-primary/10 hover:text-primary";
  const chip = "grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary";
  const extra = links.length ? links : [{ label: "فروشگاه", link: "/shop" }, { label: "وبلاگ", link: "/blog" }, { label: "پشتیبانی", link: "/support" }];
  const extraIcon = (l: string) => (l.startsWith("/blog") ? PenLine : l.startsWith("/support") ? Headphones : l.startsWith("/shop") ? Store : Sparkles);
  return (
    <div className={className}>
      <button type="button" aria-label="منو" aria-expanded={open} onClick={() => setOpen(true)} className="grid size-10 cursor-pointer place-items-center rounded-full bg-surface text-foreground/80 shadow-sm ring-1 ring-transparent transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:shadow-md hover:ring-primary/35"><Menu className="size-5" /></button>
      {open && createPortal( // portal: the floating header is transformed, which would otherwise trap a fixed overlay
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="منوی سایت" data-mobile-menu>
          <button type="button" aria-label="بستن منو" className="cl-fade-in absolute inset-0 cursor-default bg-black/35 backdrop-blur-[2px]" onClick={close} />
          <aside className="glass cl-slide-from-right absolute inset-y-3 right-3 flex w-[80vw] max-w-[360px] flex-col overflow-y-auto rounded-[28px] p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <Link href="/" onClick={close} aria-label={name ?? "CaseLine"}><img src={logo} alt={name ?? "CaseLine"} className="h-9 w-auto max-w-40 object-contain" /></Link>
              ) : (
                <Link href="/" onClick={close} aria-label="CaseLine" className="flex items-center gap-1.5 text-2xl font-black tracking-tight text-primary"><Smartphone className="size-6" strokeWidth={2.6} /><span dir="ltr">Case<span className="text-foreground">line</span></span></Link>
              )}
              <button type="button" aria-label="بستن" onClick={close} className="grid size-11 cursor-pointer place-items-center rounded-full bg-surface text-foreground ring-2 ring-primary/50 transition-colors hover:bg-primary/10"><X className="size-5" /></button>
            </div>
            {menu.length > 0 && (
              <>
                <div className="mt-6 px-3 text-sm text-muted">دسته‌بندی‌ها</div>
                <ul className="mt-2 space-y-1" data-mobile-cats>
                  {menu.map((c) => { const I = iconFor(c.slug); return (
                    <li key={c.slug}><Link href={`/shop#${c.slug}`} onClick={close} className={row}><span className={chip}><I className="size-5" /></span><span className="flex-1 text-start">{c.label}</span></Link></li>
                  ); })}
                </ul>
              </>
            )}
            <div className="my-3 border-t border-border" />
            <ul className="space-y-1">
              <li><Link href={loggedIn ? "/account/orders" : "/account"} onClick={close} className={row}><span className={chip}><User className="size-5" /></span><span className="flex-1 text-start">{loggedIn ? "حساب کاربری" : "ورود / ثبت‌نام"}</span></Link></li>
              {extra.map((l) => { const I = extraIcon(l.link); return <li key={l.link + l.label}><Link href={l.link} onClick={close} className={row}><span className={chip}><I className="size-5" /></span><span className="flex-1 text-start">{l.label}</span></Link></li>; })}
              <li><NightButton withSwitch className={cn(row, "w-full cursor-pointer")} /></li>
            </ul>
          </aside>
        </div>, document.body)}
    </div>
  );
}
