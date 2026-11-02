import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { categories } from "@/lib/products";
import Reveal from "@/components/ui/Reveal";
import ProductArt from "@/components/ui/ProductArt";

export default function Categories() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6" id="categories">
      <Reveal className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-black text-silver-50 sm:text-3xl">
            دسته‌بندی محصولات
          </h2>
          <p className="mt-2 text-sm text-silver-400">
            هر آنچه موبایلت نیاز دارد، در یک نگاه
          </p>
        </div>
        <Link
          href="/products"
          className="hidden items-center gap-1 text-sm text-silver-300 transition hover:text-white sm:flex"
        >
          همه
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Reveal>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {categories.map((c, i) => (
          <Reveal key={c.slug} delay={i * 0.04}>
            <Link
              href={`/products?cat=${c.slug}`}
              className="group relative block aspect-[4/5] overflow-hidden rounded-2xl border border-white/[0.07] transition-all duration-500 hover:border-white/20 hover:shadow-luxe"
            >
              <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-110">
                <ProductArt hue={c.hue} categorySlug={c.slug} />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <h3 className="text-sm font-bold text-silver-50">{c.name}</h3>
                <p className="mt-0.5 text-[11px] text-silver-400">{c.tagline}</p>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
