"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Headphones, PenLine, Search, ShoppingBag, Store, User } from "lucide-react";
import { Container } from "@/components/ui";
import { NightButton } from "@/components/theme";
import { CategoryMenu, MobileMenu } from "@/components/category-menu";
import { TopBar } from "@/components/top-bar";
import type { MenuCategory, SiteInfo, TopBarData } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Wordmark: a case outline crossed by one line, then CASE / LINE set apart by weight. An uploaded logo (admin) replaces it. */
export function Logo({ className, logo, name }: { className?: string; logo?: string; name?: string }) {
  if (logo) {
    return (
      <Link href="/" className={cn("flex items-center", className)} aria-label={name ?? "CaseLine"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt={name ?? "CaseLine"} className="h-9 w-auto max-w-40 object-contain" />
      </Link>
    );
  }
  return (
    <Link href="/" className={cn("group flex items-center gap-2.5 text-foreground", className)} aria-label="CaseLine">
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" fill="none" aria-hidden>
        <rect x="8" y="3" width="16" height="26" rx="5" className="stroke-primary" strokeWidth="2.2" />
        <circle cx="13" cy="8.4" r="1.4" className="fill-primary" />
        <path d="M3 22.5c5-.8 11-4.6 26-3.2" className="stroke-accent transition-[d] duration-300" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <span dir="ltr" className="text-[17px] font-extrabold leading-none tracking-[0.18em]">CASE<span className="font-medium text-primary">LINE</span></span>
    </Link>
  );
}

const iconBtn = "grid size-11 cursor-pointer place-items-center rounded-md border border-transparent text-foreground transition-colors duration-150 hover:border-border hover:bg-surface-2";
export interface HeaderProps { topBar?: TopBarData; menu: MenuCategory[]; info: SiteInfo; links: { label: string; link: string }[]; mobileLinks?: { label: string; link: string }[]; loggedIn?: boolean }
const navLink = "relative px-3 py-2 text-[14px] font-semibold text-foreground/80 transition-colors hover:text-foreground after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:origin-center after:scale-x-0 after:bg-primary after:transition-transform after:duration-200 hover:after:scale-x-100";

function CartBtn() {
  return (
    <button data-cart-btn className={cn(iconBtn, "relative")} aria-label="سبد خرید">
      <ShoppingBag className="size-[22px]" strokeWidth={1.7} />
      <span data-cart-count hidden className="absolute end-1 top-1 grid min-w-[18px] place-items-center rounded-[6px] bg-accent px-1 text-[11px] font-bold leading-[18px] text-accent-fg">0</span>
    </button>
  );
}

/** The search field is a real button that opens the existing search overlay (public/site.js), so search behaviour is untouched. */
function SearchField({ className }: { className?: string }) {
  return (
    <button type="button" data-search-btn aria-label="جستجو" className={cn("flex h-11 w-full cursor-pointer items-center gap-3 rounded-full border border-border-strong bg-card px-4 text-start text-[13.5px] text-muted transition-colors hover:border-foreground", className)}>
      <Search className="size-[18px] shrink-0 text-foreground" strokeWidth={1.8} />
      <span className="min-w-0 flex-1 truncate">جستجوی قاب، گلس، شارژر یا مدل گوشی…</span>
    </button>
  );
}

function AccountLink({ loggedIn }: { loggedIn?: boolean }) {
  return <Link href="/account/orders" className={cn(iconBtn, "relative hidden lg:grid")} aria-label="حساب کاربری"><User className="size-[22px]" strokeWidth={1.7} />{loggedIn && <i className="absolute end-2 top-2 size-2 rounded-full bg-primary ring-2 ring-background" />}</Link>;
}

/** Header 1: static, lives at the top of the page and scrolls away. */
export function TopHeader({ menu, info, links, mobileLinks, loggedIn, topBar }: HeaderProps) {
  return (
    <header className="border-b border-border bg-background">
      {/* Rotating announcements (managed in the admin). With no active items the original static line stays; switched off = no bar. */}
      {topBar && !topBar.settings.enabled ? null : topBar && topBar.items.length > 0 ? <TopBar items={topBar.items} settings={topBar.settings} /> : (
        <div className="bg-secondary text-center text-[11px] leading-8 text-secondary-fg/75 sm:text-xs">
          <span dir="ltr" className="font-bold text-accent">@Caseline_shop</span> {info.topBar}
        </div>
      )}
      <Container>
        {/* desktop: wordmark · navigation · search · tools */}
        <div className="hidden h-[76px] items-center gap-6 lg:flex">
          <Logo logo={info.logo} name={info.name} />
          <nav className="flex items-center" aria-label="منوی اصلی">
            <CategoryMenu menu={menu} />
            {links.map((l) => <Link key={l.link + l.label} href={l.link} className={navLink}>{l.label}</Link>)}
          </nav>
          <div className="ms-auto w-full max-w-[340px]"><SearchField /></div>
          <div className="flex items-center gap-0.5">
            <AccountLink loggedIn={loggedIn} />
            <NightButton iconOnly className={cn(iconBtn, "hidden lg:grid")} />
            <CartBtn />
          </div>
        </div>
        {/* mobile / tablet: menu · wordmark · cart, search below */}
        <div className="lg:hidden">
          <div className="flex h-14 items-center gap-2">
            <MobileMenu menu={menu} links={mobileLinks} loggedIn={loggedIn} logo={info.logo} name={info.name} />
            <Logo logo={info.logo} name={info.name} className="mx-auto" />
            <CartBtn />
          </div>
          <div className="pb-3"><SearchField /></div>
        </div>
      </Container>
    </header>
  );
}

/** Header 2: compact bar that slides in once the page is scrolled. */
export function FloatingHeader({ menu, links, mobileLinks, loggedIn, info }: HeaderProps) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 220);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div data-float-header data-show={show} aria-hidden={!show} inert={!show}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 -translate-y-full border-b border-border bg-background/98 opacity-0 shadow-[0_10px_28px_-18px_rgb(20_32_27/0.4)] transition-[transform,opacity] duration-300 data-[show=true]:pointer-events-auto data-[show=true]:translate-y-0 data-[show=true]:opacity-100">
      <Container>
        <div className="flex h-14 items-center gap-3">
          <MobileMenu menu={menu} links={mobileLinks} loggedIn={loggedIn} logo={info.logo} name={info.name} className="lg:hidden" />
          <Logo className="max-lg:mx-auto lg:me-2" logo={info.logo} name={info.name} />
          <nav className="hidden items-center lg:flex" aria-label="منوی اصلی">
            <CategoryMenu menu={menu} />
            {links.map((l) => <Link key={l.link + l.label} href={l.link} className={navLink}>{l.label}</Link>)}
          </nav>
          <div className="ms-auto flex items-center gap-0.5">
            <button data-search-btn className={iconBtn} aria-label="جستجو"><Search className="size-[22px]" strokeWidth={1.7} /></button>
            <AccountLink loggedIn={loggedIn} />
            <NightButton iconOnly className={cn(iconBtn, "hidden lg:grid")} />
            <CartBtn />
          </div>
        </div>
      </Container>
    </div>
  );
}

export function HeaderView(props: HeaderProps) {
  return (
    <>
      <TopHeader {...props} />
      <FloatingHeader {...props} />
    </>
  );
}

/** Mobile: flat tab bar fixed to the bottom edge with a marker on the current section, plus the chat button. */
export function BottomNav() {
  const path = usePathname() ?? "/";
  const item = "relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 pb-2 pt-3 text-[11px] font-semibold text-muted transition-colors";
  const tabs = [
    { href: "/shop", label: "فروشگاه", Icon: Store },
    { href: "/blog", label: "بلاگ", Icon: PenLine },
    { href: "/support", label: "پشتیبانی", Icon: Headphones },
    { href: "/account/orders", label: "حساب من", Icon: User },
  ];
  return (
    <>
      <button data-chat-btn aria-label="گفتگوی آنلاین" className="chat-fab fixed bottom-24 start-4 z-[60] grid size-12 cursor-pointer place-items-center rounded-md lg:bottom-6">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden>
          <path d="M4 5.5h16v10H10l-4 3.5v-3.5H4v-10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="9" cy="10.5" r="1" fill="currentColor" /><circle cx="12" cy="10.5" r="1" fill="currentColor" /><circle cx="15" cy="10.5" r="1" fill="currentColor" />
        </svg>
      </button>
      <nav aria-label="منوی اصلی" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_24px_-18px_rgb(20_32_27/0.45)] lg:hidden">
        {tabs.slice(0, 2).map(({ href, label, Icon }) => { const on = path.startsWith(href); return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined} className={cn(item, on && "text-foreground")}>
            <span aria-hidden className={cn("absolute inset-x-5 top-0 h-0.5 bg-primary transition-opacity", on ? "opacity-100" : "opacity-0")} />
            <Icon className="size-[22px]" strokeWidth={on ? 2 : 1.6} />{label}
          </Link>
        ); })}
        <NightButton tab className={item} />
        {tabs.slice(2).map(({ href, label, Icon }) => { const on = path.startsWith(href); return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined} className={cn(item, on && "text-foreground")}>
            <span aria-hidden className={cn("absolute inset-x-5 top-0 h-0.5 bg-primary transition-opacity", on ? "opacity-100" : "opacity-0")} />
            <Icon className="size-[22px]" strokeWidth={on ? 2 : 1.6} />{label}
          </Link>
        ); })}
      </nav>
    </>
  );
}
