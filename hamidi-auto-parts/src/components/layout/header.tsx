"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, Clock, LayoutGrid, Phone, Truck, ShieldCheck } from "lucide-react";
import { Logo } from "./logo";
import { SearchBox } from "./search-box";
import { CartButton } from "./cart-button";
import { MobileMenu } from "./mobile-menu";
import { NAV_LINKS } from "./nav-links";
import { CATEGORIES } from "@/data/categories";
import { SHOP, cn, toFa } from "@/lib/utils";
import { WhatsAppIcon } from "./whatsapp-icon";
import { whatsappLink } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <>
      {/* top bar */}
      <div className="carbon text-[12px] text-neutral-300">
        <div className="container-x flex h-9 items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5"><Truck className="size-3.5 text-primary" />ارسال سریع به سراسر ایران</span>
            <span className="hidden items-center gap-1.5 md:flex"><ShieldCheck className="size-3.5 text-primary" />ضمانت اصالت کالا</span>
            <span className="hidden items-center gap-1.5 lg:flex"><Clock className="size-3.5 text-primary" />{SHOP.hours}</span>
          </div>
          <div className="flex items-center gap-4">
            <a href={whatsappLink()} target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 transition hover:text-white sm:flex"><WhatsAppIcon className="size-3.5 text-[#25D366]" />واتساپ</a>
            <a href={`tel:${SHOP.phone}`} className="flex items-center gap-1.5 font-semibold text-white transition hover:text-primary"><Phone className="size-3.5" /><span className="ltr-nums">{toFa(SHOP.phone)}</span></a>
          </div>
        </div>
      </div>

      <header className={cn("sticky top-0 z-40 bg-white/95 backdrop-blur-xl transition-shadow", scrolled && "shadow-[0_10px_30px_-18px_rgba(0,0,0,.35)]")}>
        <div className="container-x flex items-center gap-3 py-3 lg:gap-8 lg:py-4">
          <MobileMenu />
          <Logo className="ml-auto lg:ml-0" />
          <SearchBox className="hidden max-w-2xl flex-1 lg:block" />
          <div className="flex items-center gap-2 lg:mr-auto">
            <a href={`tel:${SHOP.phone}`} className="hidden items-center gap-3 rounded-2xl px-3 py-1.5 transition hover:bg-neutral-100 xl:flex">
              <span className="grid size-10 place-items-center rounded-xl bg-red-50 text-primary"><Phone className="size-[18px]" /></span>
              <span className="flex flex-col text-right leading-tight">
                <span className="text-[11px] text-neutral-500">مشاوره و استعلام</span>
                <span className="ltr-nums text-sm font-bold">{toFa(SHOP.phone)}</span>
              </span>
            </a>
            <CartButton />
          </div>
        </div>
        <div className="container-x pb-3 lg:hidden">
          <SearchBox />
        </div>

        {/* nav bar */}
        <nav className="hidden bg-neutral-950 text-white lg:block">
          <div className="container-x flex h-12 items-center gap-1">
            <div className="group relative h-full">
              <button className="flex h-full cursor-pointer items-center gap-2 bg-primary px-5 text-sm font-bold">
                <LayoutGrid className="size-4" />
                دسته‌بندی قطعات
                <ChevronDown className="size-4 transition group-hover:rotate-180" />
              </button>
              <div className="invisible absolute top-full right-0 z-50 w-[760px] translate-y-2 rounded-b-2xl border border-t-0 border-neutral-200 bg-white p-5 text-neutral-900 opacity-0 shadow-2xl transition-all duration-200 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                <div className="grid grid-cols-3 gap-1">
                  {CATEGORIES.map((c) => (
                    <Link key={c.id} href={`/categories/${c.id}`} className="group/item flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-neutral-50">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-700 transition group-hover/item:bg-primary group-hover/item:text-white">
                        <c.icon className="size-[18px]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{c.nameFa}</span>
                        <span className="block truncate text-[11px] text-neutral-500">{c.description}</span>
                      </span>
                    </Link>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-neutral-950 px-4 py-3 text-sm text-white">
                  <span>قطعه مورد نظرتان را پیدا نکردید؟ کارشناسان ما کمک می‌کنند.</span>
                  <Link href="/contact" className="font-bold text-primary">استعلام قطعه ←</Link>
                </div>
              </div>
            </div>
            {NAV_LINKS.map((l) => {
              const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "relative flex h-full items-center px-4 text-sm font-medium text-neutral-300 transition hover:text-white",
                    "after:absolute after:inset-x-4 after:bottom-0 after:h-[3px] after:origin-center after:scale-x-0 after:rounded-t after:bg-primary after:transition-transform hover:after:scale-x-100",
                    active && "text-white after:scale-x-100",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
            <Link href="/shop?sort=discount" className="mr-auto flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" />
              پیشنهادهای ویژه این هفته
            </Link>
          </div>
        </nav>
      </header>
    </>
  );
}
