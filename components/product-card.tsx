import { Plus } from "lucide-react";
import { Badge } from "@/components/ui";
import { ProductVisual } from "@/components/product-visual";
import { formatToman, toFa } from "@/lib/utils";
import { kindLabel, type Product } from "@/lib/data";

export function ProductCard({ p }: { p: Product }) {
  const discount = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  return (
    <article className="glass group flex h-full flex-col overflow-hidden rounded-lg shadow-sm transition-shadow hover:shadow-md">
      <div className="relative m-2 aspect-[4/4.2] overflow-hidden rounded-md" style={{ background: `linear-gradient(160deg, hsl(${p.hue} 75% 55%), hsl(${(p.hue + 40) % 360} 70% 32%))` }}>
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 30% 20%, #fff, transparent 60%)" }} />
        <ProductVisual kind={p.kind} hue={(p.hue + 180) % 360} className="absolute inset-0 size-full p-3 drop-shadow-xl transition-transform duration-300 group-hover:scale-105" />
        {(p.oldPrice || p.badge) && <Badge tone="hot" className="absolute end-2 top-2">{p.oldPrice ? "حراج" : p.badge}</Badge>}
        <span dir="ltr" className="absolute inset-x-0 bottom-1.5 text-center text-[9px] font-bold tracking-wide text-white/80">CaseLine.shop</span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-3 pb-3">
        <span className="text-[11px] text-muted">{kindLabel[p.kind]} · {p.brand}</span>
        <h3 className="line-clamp-2 min-h-[2.6rem] text-[13px] font-bold leading-[1.35rem]">خرید {p.name}{p.compat ? ` ${p.compat}` : ""} ⭐{toFa(p.rating)}</h3>
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div>
            {p.oldPrice && <div className="flex items-center gap-1 text-[11px]"><span className="text-muted line-through">{toFa(p.oldPrice)}</span><span className="font-bold text-hot">{toFa(discount)}٪</span></div>}
            <div className="text-[13px] font-extrabold text-primary">{formatToman(p.price)}</div>
          </div>
          <button aria-label="افزودن به سبد خرید" className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-primary text-primary-fg shadow-md transition-colors hover:bg-primary-hover"><Plus className="size-5" /></button>
        </div>
      </div>
    </article>
  );
}
