import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Product } from "@/lib/products";
import ProductCard from "@/components/product/ProductCard";
import Reveal from "@/components/ui/Reveal";

export default function ProductRail({
  title,
  subtitle,
  products,
  href = "/products",
  accent,
}: {
  title: string;
  subtitle?: string;
  products: Product[];
  href?: string;
  accent?: string;
}) {
  if (!products.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <Reveal className="mb-6 flex items-end justify-between">
        <div>
          {accent && (
            <span className="mb-2 block text-xs font-bold tracking-widest text-accent">
              {accent}
            </span>
          )}
          <h2 className="text-2xl font-black text-silver-50 sm:text-3xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-2 text-sm text-silver-400">{subtitle}</p>
          )}
        </div>
        <Link
          href={href}
          className="flex items-center gap-1 text-sm text-silver-300 transition hover:text-white"
        >
          مشاهده همه
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Reveal>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {products.slice(0, 4).map((p, i) => (
          <Reveal key={p.id} delay={i * 0.05}>
            <ProductCard product={p} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
