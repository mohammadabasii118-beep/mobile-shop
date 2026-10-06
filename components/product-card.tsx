import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";
import { SiteImage } from "@/components/site-image";
import { ProductVisual } from "@/components/product-visual";
import { toFa } from "@/lib/utils";
import type { CardProduct } from "@/lib/types";

/**
 * Product card: photo on a quiet plate, then brand · name · price. No box around the text, no watermark strip over the photo.
 * The whole card is one link; sale, rating and stock come straight from the product record.
 */
export function ProductCard({ p, showCat }: { p: CardProduct; showCat?: boolean }) {
  const off = p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  return (
    <Link href={`/product/${p.slug}`} className="group flex h-full flex-col">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[10px] bg-surface-2" style={p.img ? undefined : { background: `color-mix(in srgb, hsl(${p.hue} 40% 52%) 16%, var(--surface-2))` }}>
        {p.img ? (
          <SiteImage src={p.img} alt={p.name} sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 46vw" className="transition-transform duration-[320ms] ease-out group-hover:scale-[1.03]" />
        ) : (
          <ProductVisual kind={p.kind} hue={(p.hue + 180) % 360} className="absolute inset-0 size-full p-[14%] drop-shadow-[0_14px_14px_rgb(20_32_27/0.22)] transition-transform duration-[320ms] ease-out group-hover:scale-[1.04]" />
        )}
        {off > 0 ? (
          <span className="absolute start-2 top-2 rounded-[6px] bg-hot px-2 py-0.5 text-[11px] font-bold leading-5 text-white num">{toFa(off)}٪ تخفیف</span>
        ) : p.badge ? (
          <span className="absolute start-2 top-2 rounded-[6px] bg-secondary px-2 py-0.5 text-[11px] font-bold leading-5 text-secondary-fg">{p.badge}</span>
        ) : null}
        {!p.inStock && <span className="absolute inset-0 grid place-items-center bg-background/70 text-[13px] font-bold text-foreground">ناموجود</span>}
        <span aria-hidden className="absolute bottom-2 end-2 grid size-9 translate-y-1 place-items-center rounded-[8px] bg-card text-foreground opacity-0 shadow-sm transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100"><ArrowLeft className="size-4" /></span>
      </div>
      <div className="flex flex-1 flex-col gap-1 pt-3">
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
          <span dir="ltr" className="truncate font-bold uppercase tracking-[0.12em]">{p.brand ?? "CaseLine"}</span>
          {showCat ? <span className="truncate">{p.categoryLabel}</span> : p.reviews > 0 && <span className="inline-flex shrink-0 items-center gap-0.5 num"><Star className="size-3 fill-accent text-accent" />{toFa(Math.round(p.rating * 10) / 10)}</span>}
        </div>
        <h3 className="line-clamp-2 min-h-[2.9rem] text-[13px] font-semibold leading-[1.45rem] text-foreground">خرید {p.name}{p.compat ? ` ${p.compat}` : ""} | {p.categoryLabel} اورجینال | ارسال فوری</h3>
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-1">
          <span className="text-[15px] font-extrabold num">{toFa(p.price)}<span className="ms-1 text-[11px] font-medium text-muted">تومان</span></span>
          {off > 0 && <s className="text-[12px] text-muted num">{toFa(p.oldPrice!)}</s>}
        </div>
      </div>
    </Link>
  );
}
