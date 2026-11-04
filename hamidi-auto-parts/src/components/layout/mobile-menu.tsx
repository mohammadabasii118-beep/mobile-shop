"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeft, Menu, Phone } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { CATEGORIES } from "@/data/categories";
import { NAV_LINKS } from "./nav-links";
import { Logo } from "./logo";
import { SHOP, cn, whatsappLink } from "@/lib/utils";
import { WhatsAppIcon } from "./whatsapp-icon";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"menu" | "cats">("menu");
  const pathname = usePathname();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="grid size-12 cursor-pointer place-items-center rounded-2xl border border-neutral-200 text-neutral-900 transition hover:bg-neutral-100 lg:hidden" aria-label="باز کردن منو">
          <Menu className="size-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="gap-0 p-0" dir="rtl">
        <SheetTitle className="sr-only">منوی اصلی</SheetTitle>
        <SheetDescription className="sr-only">دسترسی سریع به صفحات و دسته‌بندی‌ها</SheetDescription>
        <div className="border-b p-5 pl-16" onClick={() => setOpen(false)}>
          <Logo />
        </div>
        <div className="grid grid-cols-2 gap-1 p-3">
          {(["menu", "cats"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("cursor-pointer rounded-xl py-2.5 text-sm font-semibold transition", tab === t ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-600")}>
              {t === "menu" ? "منوی سایت" : "دسته‌بندی قطعات"}
            </button>
          ))}
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {tab === "menu"
            ? NAV_LINKS.map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={cn("flex items-center justify-between rounded-xl px-4 py-3.5 text-[15px] font-semibold transition hover:bg-neutral-100", pathname === l.href && "bg-red-50 text-primary")}>
                  {l.label}
                  <ChevronLeft className="size-4 opacity-40" />
                </Link>
              ))
            : CATEGORIES.map((c) => (
                <Link key={c.id} href={`/categories/${c.id}`} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-neutral-100">
                  <span className="grid size-9 place-items-center rounded-lg bg-neutral-100 text-neutral-700"><c.icon className="size-4" /></span>
                  {c.nameFa}
                </Link>
              ))}
        </nav>
        <div className="grid grid-cols-2 gap-2 border-t p-4">
          <a href={`tel:${SHOP.phone}`} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 text-sm font-semibold text-white"><Phone className="size-4" />تماس</a>
          <a href={whatsappLink("سلام، برای استعلام قطعه پیام می‌دهم.")} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-semibold text-white"><WhatsAppIcon className="size-4" />واتساپ</a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
