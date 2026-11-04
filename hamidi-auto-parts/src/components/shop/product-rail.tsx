import type { Product } from "@/data/products";
import { ProductCard } from "./product-card";
import { RailScroller } from "./rail-scroller";

/** Horizontally scrolling product list. Cards stay server-rendered; only the arrow buttons are a client island. */
export function ProductRail({ products, dark, label }: { products: Product[]; dark?: boolean; label: string }) {
  return (
    <RailScroller dark={dark} label={label}>
      {products.map((p) => (
        <li key={p.id} className="flex w-[78%] shrink-0 snap-start min-[480px]:w-[46%] md:w-[31%] xl:w-[calc(25%-12px)] [&>article]:w-full">
          <ProductCard product={p} />
        </li>
      ))}
    </RailScroller>
  );
}
