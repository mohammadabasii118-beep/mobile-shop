import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { LandingHero } from "@/components/shop/landing-hero";
import { Listing } from "@/components/shop/listing";
import { VehicleSelector } from "@/components/shop/vehicle-selector";
import { Faq } from "@/components/shop/faq";
import { BRANDS, getBrand, modelsOf, type BrandId } from "@/data/vehicles";
import { BRAND_CONTENT } from "@/data/brand-content";
import { CATEGORIES } from "@/data/categories";
import { categoryFacets, countProducts, listProducts, modelFacets, modelPath, parseListingParams } from "@/lib/catalog";
import { listingMetadata } from "@/lib/seo";
import { toFa } from "@/lib/utils";

export function generateStaticParams() {
  return BRANDS.map((b) => ({ brand: b.id }));
}

export async function generateMetadata({ params, searchParams }: PageProps<"/[brand]">): Promise<Metadata> {
  const b = getBrand((await params).brand);
  if (!b) notFound();
  const p = parseListingParams(await searchParams);
  const models = modelsOf(b.id).slice(0, 6).map((m) => m.nameFa).join("، ");
  return listingMetadata({
    title: `لوازم یدکی ${b.nameFa} — قطعات اصلی و OEM ${b.nameEn}`,
    description: `خرید لوازم یدکی اصلی ${b.nameFa} برای ${models} و سایر مدل‌ها. ${toFa(countProducts({ brand: b.id }))} قطعه با کد فنی، جدول سازگاری و ضمانت اصالت.`,
    path: `/${b.id}`,
    page: p.page,
    filtered: p.filtered,
  });
}

export default async function BrandPage({ params, searchParams }: PageProps<"/[brand]">) {
  const b = getBrand((await params).brand);
  if (!b) notFound();
  const brand = b.id as BrandId;
  const lp = parseListingParams(await searchParams);
  if (lp.page > listProducts({ brand }, lp).pages) notFound();
  const content = BRAND_CONTENT[brand];
  const models = modelsOf(brand);
  const modelCounts = modelFacets({ brand });
  const catCounts = categoryFacets({ brand });

  return (
    <>
      <LandingHero
        crumbs={[{ href: "/shop", label: "فروشگاه" }, { href: `/${brand}`, label: `لوازم یدکی ${b.nameFa}` }]}
        eyebrow={b.nameEn}
        title={`لوازم یدکی ${b.nameFa}`}
        intro={content.intro}
        watermark={b.nameEn}
        image={content.image}
        stats={[
          { value: toFa(models.length), label: "مدل پشتیبانی‌شده" },
          { value: toFa(countProducts({ brand })), label: "قطعه موجود" },
          { value: `${toFa(Math.min(...models.map((m) => m.from)))}–${toFa(Math.max(...models.map((m) => m.to)))}`, label: "سال‌های ساخت" },
        ]}
      />

      <section className="container-x mt-10" aria-labelledby="models-title">
        <h2 id="models-title" className="mb-5 text-xl font-black">مدل خودروی {b.nameFa} خود را انتخاب کنید</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {models.map((m) => (
            <li key={m.id} className="flex [&>a]:w-full">
              <Link href={modelPath(brand, m.id)} className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-neutral-950 hover:shadow-lg">
                <span className="absolute top-0 left-0 h-full w-1 origin-top scale-y-0 bg-primary transition group-hover:scale-y-100" aria-hidden />
                <span className="block text-[11px] font-bold tracking-wider text-neutral-600" dir="ltr">{b.nameEn} {m.nameEn}</span>
                <span className="mt-1 block text-lg font-black">{b.nameFa} {m.nameFa}</span>
                <span className="mt-2 flex items-center gap-1 text-[11px] text-neutral-600"><CalendarRange className="size-3" aria-hidden />{toFa(m.from)} تا {toFa(m.to)}</span>
                <span className="mt-3 flex items-center justify-between text-[11px]">
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700">{m.body}</span>
                  <span className="font-semibold text-primary">{toFa(modelCounts.get(m.id) ?? 0)} قطعه</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-x mt-10" aria-label="جستجو بر اساس خودرو">
        <VehicleSelector defaultBrand={brand} />
      </section>

      <section id="products" className="container-x mt-12 scroll-mt-48" aria-labelledby="products-title">
        <h2 id="products-title" className="mb-5 text-xl font-black">محصولات {b.nameFa}</h2>
        <Listing basePath={`/${brand}`} scope={{ brand }} params={lp} facets={{ modelsOf: brand, categories: "param" }} listName={`لوازم یدکی ${b.nameFa}`} />
      </section>

      <section className="container-x cv-auto mt-16 grid gap-10 lg:grid-cols-[1.4fr_1fr]" aria-labelledby="about-brand-title">
        <div>
          <h2 id="about-brand-title" className="text-xl font-black">درباره لوازم یدکی {b.nameFa} در فروشگاه حمیدی</h2>
          {content.body.map((t) => <p key={t.slice(0, 20)} className="mt-4 leading-8 text-neutral-700">{t}</p>)}
        </div>
        <nav aria-label={`دسته‌بندی قطعات ${b.nameFa}`} className="rounded-3xl border border-neutral-200 bg-neutral-50 p-6">
          <h2 className="mb-4 font-black">قطعات {b.nameFa} بر اساس دسته‌بندی</h2>
          <ul className="flex flex-wrap gap-2">
            {CATEGORIES.filter((c) => catCounts.get(c.id)).map((c) => (
              <li key={c.id}><Link href={`/categories/${c.id}`} className="block rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold ring-1 ring-neutral-200 hover:bg-neutral-950 hover:text-white">{c.nameFa}</Link></li>
            ))}
          </ul>
        </nav>
      </section>

      <div className="container-x cv-auto mt-14">
        <Faq items={content.faq} title={`سؤالات متداول قطعات ${b.nameFa}`} />
      </div>
    </>
  );
}
