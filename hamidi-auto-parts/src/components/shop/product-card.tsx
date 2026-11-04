import Link from "next/link";
import { Eye, Star } from "lucide-react";
import type { Product } from "@/data/products";
import { discountPercent } from "@/data/products";
import { getModel, getBrand } from "@/data/vehicles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PartImage } from "./part-image";
import { Price } from "./price";
import { StockBadge } from "./stock-badge";
import { AddToCartButton } from "./add-to-cart-button";
import { cn, toFa } from "@/lib/utils";

export function ProductCard({ product: p, className }: { product: Product; className?: string }) {
  const off = discountPercent(p);
  const models = p.fitments.map((f) => getModel(f.model)?.nameFa).filter(Boolean) as string[];
  const out = p.stock === "out-of-stock";
  const href = `/product/${p.slug}`;
  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-neutral-300 hover:shadow-[0_24px_48px_-24px_rgba(11,11,13,.35)]",
        className,
      )}
    >
      <Link href={href} className="relative block" tabIndex={-1} aria-hidden>
        <PartImage
          src={p.image}
          alt={p.name}
          className="aspect-[4/3.4]"
          imgClassName={cn("group-hover:scale-[1.07] group-hover:-rotate-2", out && "opacity-50 grayscale")}
        />
        <div className="absolute top-3 right-3 flex flex-col items-start gap-1.5">
          {off > 0 && <Badge className="shadow-sm">٪{toFa(off)} تخفیف</Badge>}
          {p.badges.includes("new") && <Badge variant="dark">جدید</Badge>}
        </div>
        <span
          className={cn(
            "absolute top-3 left-3 rounded-md px-2 py-0.5 text-[10px] font-black tracking-wider",
            p.brand === "nissan" ? "bg-neutral-950 text-white" : "bg-white text-neutral-950 ring-1 ring-neutral-200",
          )}
          dir="ltr"
        >
          {getBrand(p.brand)?.nameEn}
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-500">
          <span className="ltr-nums rounded bg-neutral-100 px-1.5 py-0.5 font-mono font-semibold text-neutral-700">{p.sku}</span>
          <span className="flex items-center gap-0.5 font-semibold text-neutral-700">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            {toFa(p.rating.toFixed(1))}
          </span>
        </div>
        <h3 className="line-clamp-2 min-h-[2.75rem] text-[15px] leading-snug font-bold text-neutral-950">
          <Link href={href} className="after:absolute after:inset-0 after:z-0 hover:text-primary">
            {p.name}
          </Link>
        </h3>
        <p className="text-[11px] text-neutral-500">
          OEM: <span className="ltr-nums font-mono text-neutral-700">{p.oem}</span>
        </p>
        <p className="line-clamp-1 text-xs text-neutral-600">
          <span className="text-neutral-400">سازگار با: </span>
          {models.slice(0, 3).join("، ")}
          {models.length > 3 && <span className="text-neutral-400"> و {toFa(models.length - 3)} مدل دیگر</span>}
        </p>
        <StockBadge status={p.stock} qty={p.stockQty} />
        <div className="mt-auto flex items-end justify-between gap-2 border-t border-dashed border-neutral-200 pt-3">
          <Price value={p.price} old={p.oldPrice} />
        </div>
        <div className="relative z-10 grid grid-cols-[auto_1fr] gap-2">
          <Button variant="outline" size="sm" asChild className="px-3">
            <Link href={href} aria-label={`مشاهده ${p.name}`}>
              <Eye />
              <span className="hidden sm:inline">مشاهده</span>
            </Link>
          </Button>
          <AddToCartButton product={p} size="sm" label="افزودن به سبد" />
        </div>
      </div>
    </article>
  );
}
