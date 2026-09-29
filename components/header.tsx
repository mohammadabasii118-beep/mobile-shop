"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Search, ShoppingBag, Smartphone, Headphones, PenLine, Store, User, MessageCircle } from "lucide-react";
import { Container } from "@/components/ui";
import { NightButton } from "@/components/theme";
import { CategoryMenu, MobileMenu } from "@/components/category-menu";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-1.5 text-2xl font-black tracking-tight text-primary", className)} aria-label="CaseLine">
      <Smartphone className="size-6" strokeWidth={2.6} />
      <span dir="ltr">Case<span className="text-foreground">line</span></span>
    </Link>
  );
}

const iconBtn = "grid size-10 cursor-pointer place-items-center rounded-full text-primary hover:bg-primary/10";

function CartBtn() {
  return (
    <button className={cn(iconBtn, "relative")} aria-label="سبد خرید">
      <ShoppingBag className="size-5" />
      <span className="absolute end-1 top-1 grid size-4 place-items-center rounded-full bg-hot text-[10px] font-bold text-white">۱</span>
    </button>
  );
}

/** Header 1: static, lives at the top of the page and scrolls away. */
export function TopHeader() {
  return (
    <header>
      <div className="bg-primary/10 text-center text-[11px] leading-7 text-muted sm:text-xs">
        <span dir="ltr" className="font-bold text-primary">@Caseline_shop</span> در تلگرام | کد تخفیف خرید اول: <b className="text-foreground">CASE10</b>
      </div>
      <Container className="py-2 sm:py-4">
        <div className="flex h-12 items-center gap-3 sm:glass sm:h-14 sm:rounded-full sm:px-5 sm:shadow-sm">
          <Logo />
          <nav className="hidden items-center gap-5 text-sm font-medium sm:ms-6 sm:flex" aria-label="منوی اصلی">
            <CategoryMenu />
            <Link href="/shop" className="hover:text-primary">فروشگاه</Link>
            <Link href="/blog" className="hover:text-primary">وبلاگ</Link>
            <Link href="/support" className="hover:text-primary">پشتیبانی</Link>
          </nav>
          <div className="ms-auto flex items-center gap-1">
            <button className={iconBtn} aria-label="جستجو"><Search className="size-5" /></button>
            <NightButton iconOnly className={cn(iconBtn, "hidden sm:grid")} />
            <CartBtn />
            <MobileMenu className="sm:hidden" />
          </div>
        </div>
      </Container>
    </header>
  );
}

/** Header 2: floating pill that slides in once the page is scrolled. */
export function FloatingHeader() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 140);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div data-float-header data-show={show} aria-hidden={!show}
      className="pointer-events-none fixed inset-x-0 top-3 z-50 -translate-y-24 opacity-0 transition-all duration-300 data-[show=true]:pointer-events-auto data-[show=true]:translate-y-0 data-[show=true]:opacity-100">
      <Container>
        <div className="glass flex h-14 items-center gap-2 rounded-full px-3 shadow-md sm:px-5">
          <Logo className="text-xl sm:text-2xl" />
          <nav className="hidden items-center gap-5 text-sm font-medium sm:flex sm:ms-6" aria-label="منوی اصلی">
            <CategoryMenu />
            <Link href="/shop" className="hover:text-primary">فروشگاه</Link>
            <Link href="/blog" className="hover:text-primary">وبلاگ</Link>
            <Link href="/support" className="hover:text-primary">پشتیبانی</Link>
          </nav>
          <div className="ms-auto flex items-center">
            <button className={cn(iconBtn, "hidden sm:grid")} aria-label="حساب کاربری"><User className="size-5" /></button>
            <CartBtn />
            <NightButton iconOnly className={cn(iconBtn, "hidden sm:grid")} />
            <button className={iconBtn} aria-label="جستجو"><Search className="size-5" /></button>
            <MobileMenu className="sm:hidden" />
          </div>
        </div>
      </Container>
    </div>
  );
}

export function Header() {
  return (
    <>
      <TopHeader />
      <FloatingHeader />
    </>
  );
}

/** Floating glass bar + chat bubble, like a mobile app. */
export function BottomNav() {
  const item = "flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-full py-2 text-[10px] font-medium text-muted";
  return (
    <>
      <Link href="/support" aria-label="گفتگوی آنلاین" className="fixed bottom-24 start-4 z-40 grid size-12 place-items-center rounded-full bg-accent text-white shadow-lg md:bottom-6"><MessageCircle className="size-6" /></Link>
      <nav aria-label="منوی اصلی" className="glass fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md rounded-full px-2 shadow-lg md:hidden">
        <Link href="/support" className={item}><Headphones className="size-5" />پشتیبانی</Link>
        <Link href="/blog" className={item}><PenLine className="size-5" />بلاگ</Link>
        <NightButton className={item} />
        <Link href="/shop" className={item}><Store className="size-5" />فروشگاه</Link>
        <a href="#" className={item}><User className="size-5" />داشبورد</a>
      </nav>
    </>
  );
}
