import Link from "next/link";
import { Badge } from "@/components/ui";
import { ProductVisual } from "@/components/product-visual";
import { formatToman } from "@/lib/utils";
import { kindLabel, type Product } from "@/lib/data";

export function ProductCard({ p, showCat }: { p: Product; showCat?: boolean }) {
  return (
    <Link href={`/product/${p.id}`} className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface p-2 transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/4.3] overflow-hidden rounded-[18px]" style={{ background: `linear-gradient(160deg, hsl(${p.hue} 80% 56%), hsl(${(p.hue + 40) % 360} 70% 30%))` }}>
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 30% 20%, #fff, transparent 60%)" }} />
        <ProductVisual kind={p.kind} hue={(p.hue + 180) % 360} className="absolute inset-x-0 top-0 h-[78%] w-full p-2 drop-shadow-xl transition-transform duration-300 group-hover:scale-105" />
        {(p.oldPrice || p.badge) && <Badge tone="hot" className="absolute start-2 top-2 !rounded-md px-2 py-1 text-[10px]">{p.oldPrice ? "حراج!" : p.badge}</Badge>}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-0.5 rounded-b-[18px] bg-black/85 py-1.5 text-white">
          <span dir="ltr" className="text-[13px] font-extrabold tracking-wide">{p.brand}</span>
          <span dir="ltr" className="text-[8px] font-bold tracking-[0.2em] text-accent">Caseline.ir</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-1 pb-1 pt-3">
        {showCat && <span className="text-[10px] text-muted">{kindLabel[p.kind]}</span>}
        <h3 className="line-clamp-3 min-h-[3.6rem] text-[11.5px] font-bold leading-[1.2rem]">خرید {p.name} {p.compat} | {kindLabel[p.kind]} اورجینال | ارسال فوری</h3>
        <div className="mt-auto text-[12px] font-extrabold">{formatToman(p.price)}</div>
      </div>
    </Link>
  );
}
