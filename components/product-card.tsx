import { Heart, ShoppingBag, Star } from "lucide-react";
import { Badge } from "@/components/ui";
import { ProductVisual } from "@/components/product-visual";
import { formatToman, toFa } from "@/lib/utils";
import type { Product } from "@/lib/data";

export function ProductCard({ p }: { p: Product }) {
  const discount = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition-shadow hover:shadow-md">
      <div className="relative aspect-square" style={{ background: `linear-gradient(160deg, hsl(${p.hue} 60% 92% / .9), var(--surface-2))` }}>
        <ProductVisual kind={p.kind} hue={p.hue} className="absolute inset-0 size-full p-4 transition-transform duration-300 group-hover:scale-105" />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between">
          {p.badge ? <Badge>{p.badge}</Badge> : <span />}
          <button aria-label="افزودن به علاقه‌مندی‌ها" className="grid size-9 place-items-center rounded-full bg-surface/90 text-muted shadow-sm backdrop-blur hover:text-primary">
            <Heart className="size-[18px]" />
          </button>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{p.brand}</span>
          <span className="inline-flex items-center gap-1"><Star className="size-3.5 fill-warning text-warning" />{toFa(p.rating)} <span>({toFa(p.reviews)})</span></span>
        </div>
        <h3 className="line-clamp-2 min-h-[2.75rem] text-sm font-semibold leading-snug sm:text-[15px]">{p.name}</h3>
        {p.compat && <p className="text-xs text-accent">سازگار با {p.compat}</p>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            {p.oldPrice && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted line-through">{toFa(p.oldPrice)}</span>
                <span className="rounded bg-primary/12 px-1.5 font-bold text-primary">{toFa(discount)}٪</span>
              </div>
            )}
            <div className="text-sm font-extrabold sm:text-base">{formatToman(p.price)}</div>
          </div>
          <button aria-label="افزودن به سبد خرید" className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-secondary-fg transition-colors hover:bg-primary hover:text-primary-fg">
            <ShoppingBag className="size-[18px]" />
          </button>
        </div>
      </div>
    </article>
  );
}
