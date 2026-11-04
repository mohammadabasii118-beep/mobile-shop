import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shop/breadcrumbs";
import { Listing } from "@/components/shop/listing";
import { CATEGORIES, getCategory } from "@/data/categories";
import { BRANDS } from "@/data/vehicles";
import { categoryPath, countProducts, listProducts, modelFacets, modelPath, parseListingParams } from "@/lib/catalog";
import { getModel } from "@/data/vehicles";
import { listingMetadata } from "@/lib/seo";
import { cn, toFa } from "@/lib/utils";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.id }));
}

export async function generateMetadata({ params, searchParams }: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const c = getCategory((await params).slug);
  if (!c) notFound();
  const p = parseListingParams(await searchParams);
  return listingMetadata({
    title: `خرید ${c.nameFa} نیسان و هوندا`,
    description: `خرید ${c.nameFa} اصلی و OEM برای خودروهای نیسان و هوندا: ${c.description}. ${toFa(countProducts({ category: c.id }))} قطعه با کد فنی و جدول سازگاری.`,
    path: categoryPath(c.id),
    page: p.page,
    filtered: p.filtered,
  });
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/categories/[slug]">) {
  const c = getCategory((await params).slug);
  if (!c) notFound();
  const lp = parseListingParams(await searchParams);
  if (lp.page > listProducts({ category: c.id }, lp).pages) notFound();
  const models = [...modelFacets({ category: c.id }).entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

  return (
    <>
      <PageHeader title={`${c.nameFa} نیسان و هوندا`} subtitle={`${c.description} — قطعات اصلی و OEM با ضمانت اصالت برای تمام مدل‌های نیسان و هوندا.`} crumbs={[{ href: "/categories", label: "دسته‌بندی‌ها" }, { href: categoryPath(c.id), label: c.nameFa }]}>
        <nav aria-label="سایر دسته‌بندی‌ها" className="mt-8">
          <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {CATEGORIES.map((x) => (
              <li key={x.id} className="shrink-0">
                <Link href={categoryPath(x.id)} aria-current={x.id === c.id ? "page" : undefined} className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition", x.id === c.id ? "bg-primary text-white" : "bg-white/10 text-neutral-200 hover:bg-white/20 hover:text-white")}>
                  <x.icon className="size-3.5" aria-hidden />
                  {x.nameFa}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </PageHeader>

      <div className="container-x mt-8">
        <Listing basePath={categoryPath(c.id)} scope={{ category: c.id }} params={lp} facets={{ brands: "param" }} listName={c.nameFa} />
      </div>

      {models.length > 0 && (
        <section className="container-x cv-auto mt-16" aria-labelledby="by-car-title">
          <h2 id="by-car-title" className="mb-5 text-xl font-black">{c.nameFa} بر اساس خودرو</h2>
          <ul className="flex flex-wrap gap-2">
            {models.map(([id, n]) => {
              const m = getModel(id)!;
              const b = BRANDS.find((x) => x.id === m.brand)!;
              return (
                <li key={id}>
                  <Link href={modelPath(m.brand, m.id)} className="block rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold transition hover:border-neutral-950">
                    لوازم یدکی {b.nameFa} {m.nameFa} <span className="text-xs font-normal text-neutral-600">({toFa(n)} {c.nameFa})</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-6 max-w-3xl leading-8 text-neutral-700">
            همه {c.nameFa} موجود در فروشگاه حمیدی دارای کد فنی فروشگاه، شماره OEM کارخانه و جدول سازگاری با مدل و سال ساخت هستند. اگر قطعه مورد نظر خود را پیدا نکردید، کد فنی یا شماره شاسی خودرو را برای کارشناسان ما ارسال کنید.
          </p>
        </section>
      )}
    </>
  );
}
