import { Suspense } from "react";
import { ProductExplorer } from "./product-explorer";
import type { BrandId } from "@/data/vehicles";

function Skeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      <div className="hidden h-[600px] animate-pulse rounded-2xl bg-neutral-100 lg:block" />
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[440px] animate-pulse rounded-2xl bg-neutral-100" />)}
      </div>
    </div>
  );
}

export function Explorer(props: { fixedBrand?: BrandId; fixedCategory?: string; showSearch?: boolean }) {
  return (
    <Suspense fallback={<Skeleton />}>
      <ProductExplorer {...props} />
    </Suspense>
  );
}
