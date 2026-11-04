import Link from "next/link";
import { Eye, Star } from "lucide-react";
import { discountPercent, type Product } from "@/data/products";
import { getBrand, getModel } from "@/data/vehicles";
import { productPath, toCartItem } from "@/lib/catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PartImage } from "./part-image";
import { Price } from "./price";
import { StockBadge } from "./stock-badge";
import { AddToCartButton } from "./add-to-cart-button";
import { cn, toFa } from "@/lib/utils";

export const CARD_SIZES = "(min-width: 1280px) 300px, (min-width: 768px) 33vw, (min-width: 420px) 50vw, 90vw";

export function ProductCard({ product: p, className, headingLevel = "h3", preload }: { product: Product; className?: string; headingLevel?: "h2" | "h3"; preload?: boolean }) {
  const off = discountPercent(p);
  const models = p.fitments.map((f) => getModel(f.model)?.nameFa).filter(Boolean) as string[];
  const out = p.stock === "out-of-stock";
  const href = productPath(p);
  const H = headingLevel;
  return (
    <article className={cn("group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-neutral-300 hover:shadow-[0_24px_48px_-24px_rgba(11,11,13,.35)]", className)}>
      <div className="relative">
        <PartImage src={p.image} alt={p.name} sizes={CARD_SIZES} preload={preload} className="aspect-[4/3.4]" imgClassName={cn("group-hover:scale-[1.07] group-hover:-rotate-2", out && "opacity-50 grayscale")} />
        <div className="absolute top-3 right-3 flex flex-col items-start gap-1.5">
          {off > 0 && <Badge className="shadow-sm">٪{toFa(off)} تخفیف</Badge>}
          {p.badges.includes("new") && <Badge variant="dark">جدید</Badge>}
        </div>
        <span className={cn("absolute top-3 left-3 rounded-md px-2 py-0.5 text-[10px] font-black tracking-wider", p.brand === "nissan" ? "bg-neutral-950 text-white" : "bg-white text-neutral-950 ring-1 ring-neutral-200")} dir="ltr">
          {getBrand(p.brand)?.nameEn}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-600">
          <span className="ltr-nums rounded bg-neutral-100 px-1.5 py-0.5 font-mono font-semibold text-neutral-700">{p.sku}</span>
          <span className="flex items-center gap-0.5 font-semibold text-neutral-700">
            <Star className="size-3 fill-amber-400 text-amber-500" aria-hidden />
            <span className="sr-only">امتیاز</span>
            {toFa(p.rating.toFixed(1))}
          </span>
        </div>
        <H className="line-clamp-2 min-h-[2.75rem] text-[15px] leading-snug font-bold text-neutral-950">
          {/* stretched link: the whole card is clickable with a single focusable anchor */}
          <Link href={href} className="after:absolute after:inset-0 after:z-0 hover:text-primary focus-visible:outline-none focus-visible:after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-primary">
            {p.name}
          </Link>
        </H>
        <p className="text-[11px] text-neutral-600">OEM: <span className="ltr-nums font-mono text-neutral-800">{p.oem}</span></p>
        <p className="line-clamp-1 text-xs text-neutral-700">
          <span className="text-neutral-500">سازگار با: </span>
          {models.slice(0, 3).join("، ")}
          {models.length > 3 && <span className="text-neutral-500"> و {toFa(models.length - 3)} مدل دیگر</span>}
        </p>
        <StockBadge status={p.stock} qty={p.stockQty} />
        <div className="mt-auto border-t border-dashed border-neutral-200 pt-3">
          <Price value={p.price} old={p.oldPrice} />
        </div>
        <div className="relative z-10 grid grid-cols-[auto_1fr] gap-2">
          <Button variant="outline" size="sm" asChild className="px-3">
            <Link href={href} tabIndex={-1} aria-hidden>
              <Eye />
              <span className="hidden sm:inline">مشاهده</span>
            </Link>
          </Button>
          <AddToCartButton item={toCartItem(p)} size="sm" />
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, className, headingLevel, preloadFirst }: { products: Product[]; className?: string; headingLevel?: "h2" | "h3"; preloadFirst?: boolean }) {
  return (
    <ul className={cn("grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3", className)} role="list">
      {products.map((p, i) => (
        <li key={p.id} className="flex [&>article]:w-full">
          <ProductCard product={p} headingLevel={headingLevel} preload={preloadFirst && i === 0} />
        </li>
      ))}
    </ul>
  );
}
