"use client";
import Link from "next/link";
import { useEffect } from "react";
import { ArrowLeft, BatteryCharging, ChevronDown, Headphones, LayoutGrid, Menu, ShieldCheck, Smartphone, Sparkles, Zap } from "lucide-react";
import { Thumb } from "@/components/product-detail";
import { allProducts, rails, type Product } from "@/lib/data";
import { formatToman } from "@/lib/utils";
import { cn } from "@/lib/utils";

const pick = (kinds: Product["kind"][]) => allProducts.filter((p) => kinds.includes(p.kind)).slice(0, 6);

const menu = [
  { slug: "iphone", label: "قاب آیفون", icon: Smartphone, items: rails[0].items, chips: ["MagSafe", "ضدضربه", "شفاف", "چرمی", "رینگ‌دار"] },
  { slug: "samsung", label: "قاب سامسونگ", icon: Smartphone, items: rails[1].items, chips: ["Galaxy S24", "Galaxy A55", "شفاف", "Armor"] },
  { slug: "xiaomi", label: "قاب شیائومی", icon: Smartphone, items: rails[2].items, chips: ["Redmi Note 13", "Poco X6", "Xiaomi 14"] },
  { slug: "glass", label: "گلس و محافظ لنز", icon: ShieldCheck, items: pick(["glass", "lens"]), chips: ["آنتی‌استاتیک", "مات", "محافظ لنز"] },
  { slug: "charger", label: "شارژر و کابل", icon: Zap, items: pick(["charger", "cable"]), chips: ["GaN", "وایرلس", "Type-C", "Lightning"] },
  { slug: "audio", label: "هندزفری و پاوربانک", icon: Headphones, items: pick(["earbuds", "powerbank"]), chips: ["ایرپاد", "بلوتوثی", "۲۰۰۰۰ mAh"] },
  { slug: "other", label: "سایر لوازم جانبی", icon: Sparkles, items: pick(["holder", "flash"]), chips: ["هولدر", "فلش OTG"] },
];

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
export function CategoryMenu() {
  useCloseDetails();
  return (
    <details data-menu className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />دسته‌بندی‌ها<LayoutGrid className="size-4" />
      </summary>
      <div className="mega border border-border bg-surface absolute start-0 top-[calc(100%+1.1rem)] z-50 w-[min(92vw,760px)] rounded-xl p-4 shadow-lg">
        <ul className="relative grid min-h-[330px] grid-cols-[210px_1fr] content-start gap-1">
          {menu.map((c) => (
            <li key={c.slug} tabIndex={0} className="col-start-1">
              <a href={`#${c.slug}`} className="mega-item flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium">
                <span>{c.label}</span><c.icon className="size-4 text-primary" />
              </a>
              <div className="mega-panel absolute inset-y-0 end-0 hidden w-[calc(100%-226px)] flex-col">
                <div className="mb-3 text-[11px] text-muted">محصولات پرطرفدار {c.label}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {c.items.slice(0, 6).map((p) => (
                    <Link key={p.id} href={`/product/${p.id}`} className="flex items-center gap-2.5">
                      <Thumb p={p} className="size-12 shrink-0 rounded-lg" />
                      <span className="min-w-0"><span className="line-clamp-2 block text-[11px] font-medium leading-5">{p.name} {p.compat}</span><span className="text-[10.5px] font-bold text-primary">{formatToman(p.price)}</span></span>
                    </Link>
                  ))}
                </div>
                <a href={`#${c.slug}`} className="mt-auto flex items-center gap-1 pt-3 text-xs font-bold text-primary"><ArrowLeft className="size-3.5" />همه محصولات {c.label}</a>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs">
                  <span className="text-muted">پرطرفدار:</span>{c.chips.map((x) => <a key={x} href={`#${c.slug}`} className="hover:text-primary">{x}</a>)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

/** Mobile menu: hamburger opens a simple sheet of categories. */
export function MobileMenu({ className }: { className?: string }) {
  useCloseDetails();
  return (
    <details data-menu className={cn("group", className)}>
      <summary aria-label="منو" className="grid size-10 cursor-pointer list-none place-items-center rounded-full text-primary hover:bg-primary/10 [&::-webkit-details-marker]:hidden"><Menu className="size-5" /></summary>
      <div className="border border-border bg-surface fixed inset-x-3 top-20 z-50 rounded-xl p-3 shadow-lg">
        <div className="mb-1 flex items-center gap-2 px-2 text-xs text-muted"><BatteryCharging className="size-4" />دسته‌بندی‌ها</div>
        {menu.map((c) => <a key={c.slug} href={`#${c.slug}`} className="flex items-center justify-between rounded-md px-3 py-3 text-sm font-medium hover:bg-primary/10"><span>{c.label}</span><c.icon className="size-4 text-primary" /></a>)}
      </div>
    </details>
  );
}
