import { Suspense } from "react";
import ProductsBrowser from "@/components/product/ProductsBrowser";

export const metadata = { title: "فروشگاه" };

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[50vh] place-items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-accent" />
        </div>
      }
    >
      <ProductsBrowser />
    </Suspense>
  );
}
