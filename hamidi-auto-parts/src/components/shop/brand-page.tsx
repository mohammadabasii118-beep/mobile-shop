import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { Breadcrumbs } from "./breadcrumbs";
import { Explorer } from "./explorer-boundary";
import { VehicleSelector } from "./vehicle-selector";
import { getBrand, modelsOf, type BrandId } from "@/data/vehicles";
import { countByModel } from "@/lib/catalog";
import { PRODUCTS } from "@/data/products";
import { toFa } from "@/lib/utils";

export function BrandPage({ brand, intro, image }: { brand: BrandId; intro: string; image: string }) {
  const b = getBrand(brand)!;
  const models = modelsOf(brand);
  const count = PRODUCTS.filter((p) => p.brand === brand).length;
  return (
    <>
      <section className="carbon relative overflow-hidden text-white">
        <div className="bg-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="pointer-events-none absolute top-0 left-1/4 size-[420px] rounded-full bg-primary/25 blur-[120px]" />
        <span className="pointer-events-none absolute -bottom-10 left-0 text-[10rem] leading-none font-black tracking-tighter text-white/[0.04] sm:text-[16rem]" dir="ltr">{b.nameEn}</span>
        <div className="container-x relative grid items-center gap-8 py-12 lg:grid-cols-[1.2fr_1fr] lg:py-16">
          <div>
            <Breadcrumbs items={[{ href: "/shop", label: "فروشگاه" }, { label: `قطعات ${b.nameFa}` }]} dark />
            <span className="mt-6 inline-block rounded-md bg-primary px-2.5 py-1 text-xs font-black tracking-[0.3em]" dir="ltr">{b.nameEn}</span>
            <h1 className="mt-4 text-4xl font-black sm:text-5xl">لوازم یدکی {b.nameFa}</h1>
            <p className="mt-4 max-w-xl leading-8 text-neutral-400">{intro}</p>
            <div className="mt-6 flex gap-6 text-sm">
              <div><p className="text-2xl font-black">{toFa(models.length)}</p><p className="text-neutral-400">مدل پشتیبانی‌شده</p></div>
              <div className="w-px bg-white/10" />
              <div><p className="text-2xl font-black">{toFa(count)}</p><p className="text-neutral-400">محصول در این دمو</p></div>
              <div className="w-px bg-white/10" />
              <div><p className="text-2xl font-black">{toFa(Math.min(...models.map((m) => m.from)))}–{toFa(Math.max(...models.map((m) => m.to)))}</p><p className="text-neutral-400">سال‌های ساخت</p></div>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="mx-auto hidden max-h-80 animate-float object-contain drop-shadow-[0_40px_50px_rgba(0,0,0,.6)] lg:block" />
        </div>
      </section>

      <section className="container-x mt-10">
        <h2 className="mb-5 text-xl font-black">انتخاب مدل {b.nameFa}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {models.map((m) => (
            <Link key={m.id} href={`/${brand}?model=${m.id}#products`} scroll={false} className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-neutral-950 hover:shadow-lg">
              <span className="absolute top-0 left-0 h-full w-1 origin-top scale-y-0 bg-primary transition group-hover:scale-y-100" />
              <p className="text-[11px] font-bold tracking-wider text-neutral-400" dir="ltr">{m.nameEn}</p>
              <p className="mt-1 text-lg font-black">{m.nameFa}</p>
              <p className="mt-2 flex items-center gap-1 text-[11px] text-neutral-500"><CalendarRange className="size-3" />{toFa(m.from)} تا {toFa(m.to)}</p>
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600">{m.body}</span>
                <span className="font-semibold text-primary">{toFa(countByModel(m.id))} قطعه</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-x mt-10">
        <VehicleSelector variant="light" defaultBrand={brand} />
      </section>

      <section id="products" className="container-x mt-12 scroll-mt-48">
        <h2 className="mb-5 text-xl font-black">محصولات {b.nameFa}</h2>
        <Explorer fixedBrand={brand} />
      </section>
    </>
  );
}
