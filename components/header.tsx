"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Search, ShoppingBag, Smartphone, Headphones, PenLine, Store, User } from "lucide-react";
import { Container } from "@/components/ui";
import { NightButton } from "@/components/theme";
import { CategoryMenu, MobileMenu } from "@/components/category-menu";
import type { MenuCategory, SiteInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

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
    <Link href="/" className={cn("flex items-center gap-1.5 text-2xl font-black tracking-tight text-primary", className)} aria-label="CaseLine">
      <Smartphone className="size-6" strokeWidth={2.6} />
      <span dir="ltr">Case<span className="text-foreground">line</span></span>
    </Link>
  );
}

const iconBtn = "grid size-10 cursor-pointer place-items-center rounded-full bg-surface text-foreground/80 shadow-sm ring-1 ring-transparent transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:shadow-md hover:ring-primary/35";
export interface HeaderProps { menu: MenuCategory[]; info: SiteInfo; links: { label: string; link: string }[]; mobileLinks?: { label: string; link: string }[]; loggedIn?: boolean }
const navLink = "rounded-full px-3.5 py-2 transition-colors hover:bg-primary/10 hover:text-primary";

function CartBtn() {
  return (
    <button data-cart-btn className={cn(iconBtn, "relative")} aria-label="سبد خرید">
      <ShoppingBag className="size-5" />
      <span data-cart-count hidden className="absolute end-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-hot px-1 text-[10px] font-bold leading-4 text-white">0</span>
    </button>
  );
}

/** Header 1: static, lives at the top of the page and scrolls away. */
export function TopHeader({ menu, info, links, mobileLinks, loggedIn }: HeaderProps) {
  return (
    <header>
      <div className="bg-primary/10 text-center text-[11px] leading-7 text-muted sm:text-xs">
        <span dir="ltr" className="font-bold text-primary">@Caseline_shop</span> {info.topBar}
      </div>
      <Container className="py-2 sm:py-4">
        <div className="flex h-12 items-center gap-3 sm:glass sm:h-14 sm:rounded-full sm:px-5 sm:shadow-sm">
          <Logo logo={info.logo} name={info.name} />
          <nav className="hidden items-center gap-1 text-sm font-medium sm:ms-6 sm:flex" aria-label="منوی اصلی">
            <CategoryMenu menu={menu} />
            {links.map((l) => <Link key={l.link + l.label} href={l.link} className={navLink}>{l.label}</Link>)}
          </nav>
          <div className="ms-auto flex items-center gap-1">
            <button data-search-btn className={iconBtn} aria-label="جستجو"><Search className="size-5" /></button>
            <Link href="/account/orders" className={cn(iconBtn, "relative hidden sm:grid")} aria-label="حساب کاربری"><User className="size-5" />{loggedIn && <i className="absolute end-2 top-2 size-2 rounded-full bg-accent" />}</Link>
            <NightButton iconOnly className={cn(iconBtn, "hidden sm:grid")} />
            <CartBtn />
            <MobileMenu menu={menu} links={mobileLinks} loggedIn={loggedIn} logo={info.logo} name={info.name} className="sm:hidden" />
          </div>
        </div>
      </Container>
    </header>
  );
}

/** Header 2: floating pill that slides in once the page is scrolled. */
export function FloatingHeader({ menu, links, mobileLinks, loggedIn, info }: HeaderProps) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 140);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div data-float-header data-show={show} aria-hidden={!show} inert={!show}
      className="pointer-events-none fixed inset-x-0 top-3 z-50 -translate-y-24 opacity-0 transition-all duration-300 data-[show=true]:pointer-events-auto data-[show=true]:translate-y-0 data-[show=true]:opacity-100">
      <Container>
        <div className="glass flex h-14 items-center gap-2 rounded-full px-3 shadow-md sm:px-5">
          <Logo className="text-xl sm:text-2xl" logo={info.logo} name={info.name} />
          <nav className="hidden items-center gap-1 text-sm font-medium sm:flex sm:ms-6" aria-label="منوی اصلی">
            <CategoryMenu menu={menu} />
            {links.map((l) => <Link key={l.link + l.label} href={l.link} className={navLink}>{l.label}</Link>)}
          </nav>
          <div className="ms-auto flex items-center">
            <Link href="/account/orders" className={cn(iconBtn, "relative hidden sm:grid")} aria-label="حساب کاربری"><User className="size-5" />{loggedIn && <i className="absolute end-2 top-2 size-2 rounded-full bg-accent" />}</Link>
            <CartBtn />
            <NightButton iconOnly className={cn(iconBtn, "hidden sm:grid")} />
            <button data-search-btn className={iconBtn} aria-label="جستجو"><Search className="size-5" /></button>
            <MobileMenu menu={menu} links={mobileLinks} loggedIn={loggedIn} logo={info.logo} name={info.name} className="sm:hidden" />
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

/** Floating glass bar + chat bubble, like a mobile app. */
export function BottomNav() {
  const item = "flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-full py-2 text-[10px] font-medium text-muted";
  return (
    <>
      <button data-chat-btn aria-label="گفتگوی آنلاین" className="chat-fab fixed bottom-24 start-4 z-[60] grid size-12 cursor-pointer place-items-center rounded-full md:bottom-6">
        <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden>
          <circle cx="12" cy="11" r="6.6" stroke="#fff" strokeWidth="3" />
          <path d="M14.6 16.2 17.9 20.4 12.6 18.4Z" fill="#fff" stroke="#fff" strokeWidth="1" strokeLinejoin="round" />
          <circle cx="9.3" cy="11" r="1" fill="#fff" /><circle cx="12" cy="11" r="1" fill="#fff" /><circle cx="14.7" cy="11" r="1" fill="#fff" />
        </svg>
      </button>
      <nav aria-label="منوی اصلی" className="glass fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md rounded-full px-2 shadow-lg md:hidden">
        <Link href="/support" className={item}><Headphones className="size-5" />پشتیبانی</Link>
        <Link href="/blog" className={item}><PenLine className="size-5" />بلاگ</Link>
        <NightButton tab className={item} />
        <Link href="/shop" className={item}><Store className="size-5" />فروشگاه</Link>
        <Link href="/account/orders" className={item}><User className="size-5" />داشبورد</Link>
      </nav>
    </>
  );
}
