import Link from "next/link";
import { ChevronDown, ChevronLeft, Clock, LayoutGrid, Phone, ShieldCheck, Truck } from "lucide-react";
import { Logo } from "./logo";
import { SearchAutocomplete } from "./search-autocomplete";
import { CartButton } from "./cart-button";
import { MobileMenu } from "./mobile-menu";
import { NavLink } from "./nav-link";
import { NAV_LINKS } from "./nav-links";
import { WhatsAppIcon } from "./whatsapp-icon";
import { CATEGORIES } from "@/data/categories";
import { BRANDS, modelsOf } from "@/data/vehicles";
import { SHOP, toFa, whatsappLink } from "@/lib/utils";

/** Server component: only search, cart badge, active link and the mobile drawer hydrate. */
export function Header() {
  return (
    <>
      <div className="carbon text-[12px] text-neutral-300">
        <div className="container-x flex h-9 items-center justify-between gap-4">
          <ul className="flex items-center gap-5">
            <li className="flex items-center gap-1.5"><Truck className="size-3.5 text-primary" aria-hidden />ارسال سریع به سراسر ایران</li>
            <li className="hidden items-center gap-1.5 md:flex"><ShieldCheck className="size-3.5 text-primary" aria-hidden />ضمانت اصالت کالا</li>
            <li className="hidden items-center gap-1.5 lg:flex"><Clock className="size-3.5 text-primary" aria-hidden />{SHOP.hours}</li>
          </ul>
          <div className="flex items-center gap-4">
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="hidden items-center gap-1.5 transition hover:text-white sm:flex"><WhatsAppIcon className="size-3.5 text-[#25D366]" />واتساپ</a>
            <a href={`tel:${SHOP.phone}`} className="flex items-center gap-1.5 font-semibold text-white transition hover:text-primary"><Phone className="size-3.5" aria-hidden /><span className="ltr-nums">{toFa(SHOP.phone)}</span></a>
          </div>
        </div>
      </div>

      <header className="header-elevate sticky top-0 z-40 border-b border-neutral-200/70 bg-white lg:bg-white/95 lg:backdrop-blur-xl">
        <div className="container-x flex items-center gap-3 py-3 lg:gap-8 lg:py-4">
          <MobileMenu>
            <MobileNav />
          </MobileMenu>
          <Logo className="ml-auto lg:ml-0" />
          <SearchAutocomplete className="hidden max-w-2xl flex-1 lg:block" />
          <div className="flex items-center gap-2 lg:mr-auto">
            <a href={`tel:${SHOP.phone}`} className="hidden items-center gap-3 rounded-2xl px-3 py-1.5 transition hover:bg-neutral-100 xl:flex">
              <span className="grid size-10 place-items-center rounded-xl bg-red-50 text-primary" aria-hidden><Phone className="size-[18px]" /></span>
              <span className="flex flex-col text-right leading-tight">
                <span className="text-[11px] text-neutral-600">مشاوره و استعلام</span>
                <span className="ltr-nums text-sm font-bold">{toFa(SHOP.phone)}</span>
              </span>
            </a>
            <CartButton />
          </div>
        </div>
        <div className="container-x pb-3 lg:hidden">
          <SearchAutocomplete />
        </div>

        <nav aria-label="منوی اصلی" className="hidden bg-neutral-950 text-white lg:block">
          <div className="container-x flex h-12 items-center gap-1">
            <div className="group relative h-full">
              <Link href="/categories" className="flex h-full items-center gap-2 bg-primary px-5 text-sm font-bold" aria-haspopup="true">
                <LayoutGrid className="size-4" aria-hidden />
                دسته‌بندی قطعات
                <ChevronDown className="size-4 transition group-hover:rotate-180" aria-hidden />
              </Link>
              {/* CSS-only mega menu (hover / keyboard focus) */}
              <div className="invisible absolute top-full right-0 z-50 w-[780px] translate-y-2 rounded-b-2xl border border-t-0 border-neutral-200 bg-white p-5 text-neutral-900 opacity-0 shadow-2xl transition-all duration-200 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                <ul className="grid grid-cols-3 gap-1">
                  {CATEGORIES.map((c) => (
                    <li key={c.id}>
                      <Link href={`/categories/${c.id}`} className="group/item flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-neutral-50">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-700 transition group-hover/item:bg-primary group-hover/item:text-white" aria-hidden><c.icon className="size-[18px]" /></span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{c.nameFa}</span>
                          <span className="block truncate text-[11px] text-neutral-600">{c.description}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-neutral-950 px-4 py-3 text-sm text-white">
                  <span>قطعه مورد نظرتان را پیدا نکردید؟ کارشناسان ما کمک می‌کنند.</span>
                  <Link href="/contact" className="font-bold text-[#ff5a4f]">استعلام قطعه ←</Link>
                </div>
              </div>
            </div>
            <ul className="flex h-full items-center">
              {NAV_LINKS.map((l) => (
                <li key={l.href} className="h-full">
                  <NavLink
                    href={l.href}
                    className="relative flex h-full items-center px-4 text-sm font-medium text-neutral-300 transition after:absolute after:inset-x-4 after:bottom-0 after:h-[3px] after:scale-x-0 after:rounded-t after:bg-primary after:transition-transform hover:text-white hover:after:scale-x-100"
                    activeClassName="text-white after:scale-x-100"
                  >
                    {l.label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <Link href="/shop?sort=discount" rel="nofollow" className="mr-auto flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
              پیشنهادهای ویژه این هفته
            </Link>
          </div>
        </nav>
      </header>
    </>
  );
}

function MobileNav() {
  return (
    <>
      <div className="border-b p-5 pl-16"><Logo /></div>
      <nav aria-label="منوی موبایل" className="flex-1 overflow-y-auto p-3">
        <ul>
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <NavLink href={l.href} className="flex items-center justify-between rounded-xl px-4 py-3.5 text-[15px] font-semibold transition hover:bg-neutral-100" activeClassName="bg-red-50 text-primary">
                {l.label}
                <ChevronLeft className="size-4 opacity-50" aria-hidden />
              </NavLink>
            </li>
          ))}
        </ul>
        {BRANDS.map((b) => (
          <details key={b.id} className="group mt-2 rounded-xl bg-neutral-50">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
              مدل‌های {b.nameFa}
              <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
            </summary>
            <ul className="grid grid-cols-2 gap-1 px-2 pb-3">
              {modelsOf(b.id).map((m) => (
                <li key={m.id}><Link href={`/${b.id}/${m.id}`} className="block rounded-lg px-3 py-2 text-sm hover:bg-white">{m.nameFa}</Link></li>
              ))}
            </ul>
          </details>
        ))}
        <details className="group mt-2 rounded-xl bg-neutral-50">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
            دسته‌بندی قطعات
            <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="px-2 pb-3">
            {CATEGORIES.map((c) => (
              <li key={c.id}>
                <Link href={`/categories/${c.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-white">
                  <c.icon className="size-4 text-neutral-600" aria-hidden />
                  {c.nameFa}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </nav>
      <div className="grid grid-cols-2 gap-2 border-t p-4">
        <a href={`tel:${SHOP.phone}`} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 text-sm font-semibold text-white"><Phone className="size-4" aria-hidden />تماس</a>
        <a href={whatsappLink("سلام، برای استعلام قطعه پیام می‌دهم.")} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-semibold text-white"><WhatsAppIcon className="size-4" />واتساپ</a>
      </div>
    </>
  );
}
