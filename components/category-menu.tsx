"use client";
import Link from "next/link";
import { useEffect } from "react";
import { ArrowLeft, BatteryCharging, ChevronDown, Headphones, LayoutGrid, Menu, Smartphone, Sparkles, Watch, Zap } from "lucide-react";
import { Thumb } from "@/components/product-detail";
import { catalog, shopCats, type Product } from "@/lib/data";
import { formatToman } from "@/lib/utils";
import { cn } from "@/lib/utils";

const icons = { phone: Smartphone, headphones: Headphones, watch: Watch, zap: Zap, sparkles: Sparkles } as const;
const menu = shopCats.map((c) => ({
  ...c,
  Icon: icons[c.icon as keyof typeof icons],
  items: catalog.filter(c.test).sort((a, b) => b.reviews - a.reviews).slice(0, c.subs.length ? 4 : 6) as Product[],
}));

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
        <ul className="relative grid min-h-[330px] grid-cols-[210px_1fr] content-start gap-x-0 gap-y-1">
          {menu.map((c) => (
            <li key={c.slug} tabIndex={0} className="col-start-1">
              <Link href={`/shop#${c.slug}`} className="mega-item flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium">
                <span>{c.label}</span><c.Icon className="size-4 text-primary" />
              </Link>
              <div className="mega-panel absolute inset-y-0 end-0 hidden w-[calc(100%-210px)] flex-col ps-5">
                {c.subs.length > 0 && (
                  <>
                    <div className="mb-2 text-[11px] text-muted">زیرمجموعه‌ها</div>
                    <div className="mb-4 flex flex-wrap gap-2">
                      {c.subs.map((sb) => <Link key={sb.slug} href={`/shop#${sb.slug}`} className="rounded-full border border-border bg-surface-2 px-3.5 py-2 text-xs font-bold transition-colors hover:border-primary hover:text-primary">{sb.label}</Link>)}
                    </div>
                  </>
                )}
                <div className="mb-3 text-[11px] text-muted">محصولات پرطرفدار {c.label}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {c.items.map((p) => (
                    <Link key={p.id} href={`/product/${p.id}`} className="flex items-center gap-2.5">
                      <Thumb p={p} className="size-12 shrink-0 rounded-lg" />
                      <span className="min-w-0"><span className="line-clamp-2 block text-[11px] font-medium leading-5">{p.name} {p.compat}</span><span className="text-[10.5px] font-bold text-primary">{formatToman(p.price)}</span></span>
                    </Link>
                  ))}
                </div>
                <Link href={`/shop#${c.slug}`} className="mt-auto flex items-center gap-1 pt-3 text-xs font-bold text-primary"><ArrowLeft className="size-3.5" />همه محصولات {c.label}</Link>
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
      <div className="border border-border bg-surface fixed inset-x-3 top-20 max-h-[75vh] overflow-y-auto z-50 rounded-xl p-3 shadow-lg">
        <div className="mb-1 flex items-center gap-2 px-2 text-xs text-muted"><BatteryCharging className="size-4" />دسته‌بندی‌ها</div>
        {menu.map((c) => (
          <div key={c.slug} className="border-b border-border/60 py-1 last:border-0">
            <Link href={`/shop#${c.slug}`} className="flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-bold hover:bg-primary/10"><span>{c.label}</span><c.Icon className="size-4 text-primary" /></Link>
            {c.subs.length > 0 && <div className="flex flex-wrap gap-1.5 px-3 pb-2">{c.subs.map((sb) => <Link key={sb.slug} href={`/shop#${sb.slug}`} className="rounded-full bg-surface-2 px-3 py-1 text-[11px] font-medium">{sb.label}</Link>)}</div>}
          </div>
        ))}
      </div>
    </details>
  );
}
