"use client";
import Link from "next/link";
import { useEffect } from "react";
import { BatteryCharging, ChevronDown, Headphones, LayoutGrid, Menu, Smartphone, Sparkles, Watch, Zap } from "lucide-react";
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

/** Mobile menu: hamburger opens a simple sheet of categories. */
export function MobileMenu({ menu, className }: { menu: MenuCategory[]; className?: string }) {
  useCloseDetails();
  return (
    <details data-menu className={cn("group", className)}>
      <summary aria-label="منو" className="grid size-10 cursor-pointer list-none place-items-center rounded-full bg-surface text-foreground/80 shadow-sm ring-1 ring-transparent transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:shadow-md hover:ring-primary/35 [&::-webkit-details-marker]:hidden"><Menu className="size-5" /></summary>
      <div className="border border-border bg-surface fixed inset-x-3 top-20 max-h-[75vh] overflow-y-auto z-50 rounded-xl p-3 shadow-lg">
        <div className="mb-1 flex items-center gap-2 px-2 text-xs text-muted"><BatteryCharging className="size-4" />دسته‌بندی‌ها</div>
        {menu.map((c) => (
          <div key={c.slug} className="border-b border-border/60 py-1 last:border-0">
            <Link href={`/shop#${c.slug}`} className="flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-bold hover:bg-primary/10"><span>{c.label}</span>{(() => { const I = iconFor(c.slug); return <I className="size-4 text-primary" />; })()}</Link>
            {c.subs.length > 0 && <div className="flex flex-wrap gap-1.5 px-3 pb-2">{c.subs.map((sb) => <Link key={sb.slug} href={`/shop#${sb.slug}`} className="rounded-full bg-surface-2 px-3 py-1 text-[11px] font-medium">{sb.label}</Link>)}</div>}
          </div>
        ))}
      </div>
    </details>
  );
}
