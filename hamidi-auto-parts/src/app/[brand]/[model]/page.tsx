import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LandingHero } from "@/components/shop/landing-hero";
import { Listing } from "@/components/shop/listing";
import { Faq } from "@/components/shop/faq";
import { MODELS, getBrand, getModel, modelsOf } from "@/data/vehicles";
import { CATEGORIES } from "@/data/categories";
import { categoryFacets, countProducts, listProducts, modelPath, parseListingParams } from "@/lib/catalog";
import { listingMetadata } from "@/lib/seo";
import { toFa } from "@/lib/utils";

export function generateStaticParams() {
  return MODELS.map((m) => ({ brand: m.brand, model: m.id }));
}

async function resolve(params: PageProps<"/[brand]/[model]">["params"]) {
  const { brand, model } = await params;
  const b = getBrand(brand);
  const m = getModel(model);
  return b && m && m.brand === b.id ? { b, m } : null;
}

export async function generateMetadata({ params, searchParams }: PageProps<"/[brand]/[model]">): Promise<Metadata> {
  const r = await resolve(params);
  if (!r) notFound();
  const { b, m } = r;
  const p = parseListingParams(await searchParams);
  const n = countProducts({ brand: b.id, model: m.id });
  return listingMetadata({
    title: `لوازم یدکی ${b.nameFa} ${m.nameFa} ${m.from} تا ${m.to}`,
    description: `خرید ${toFa(n)} قطعه اصلی و OEM ${b.nameFa} ${m.nameFa} مدل ${toFa(m.from)} تا ${toFa(m.to)}: لنت و دیسک، کمک‌فنر، قطعات موتوری، برقی و بدنه با جدول سازگاری دقیق و ضمانت اصالت.`,
    path: modelPath(b.id, m.id),
    page: p.page,
    filtered: p.filtered,
  });
}

export default async function ModelPage({ params, searchParams }: PageProps<"/[brand]/[model]">) {
  const r = await resolve(params);
  if (!r) notFound();
  const { b, m } = r;
  const scope = { brand: b.id, model: m.id };
  const lp = parseListingParams(await searchParams);
  if (lp.page > listProducts(scope, lp).pages) notFound();
  const total = countProducts(scope);
  const cats = categoryFacets(scope);
  const topCats = CATEGORIES.filter((c) => cats.get(c.id)).sort((a, z) => (cats.get(z.id) ?? 0) - (cats.get(a.id) ?? 0));
  const siblings = modelsOf(b.id).filter((x) => x.id !== m.id);
  const fullName = `${b.nameFa} ${m.nameFa}`;
  const path = modelPath(b.id, m.id);

  return (
    <>
      <LandingHero
        crumbs={[{ href: "/shop", label: "فروشگاه" }, { href: `/${b.id}`, label: `لوازم یدکی ${b.nameFa}` }, { href: path, label: fullName }]}
        eyebrow={`${b.nameEn} ${m.nameEn}`}
        title={`لوازم یدکی ${fullName}`}
        intro={`قطعات اصلی و OEM ${fullName} (${m.body}) برای مدل‌های ${toFa(m.from)} تا ${toFa(m.to)}. سال ساخت خودروی خود را انتخاب کنید تا فقط قطعات سازگار نمایش داده شوند.`}
        watermark={m.nameEn.split(" ")[0]}
        image={topCats[0]?.image ?? "/images/parts/brake-disc.png"}
        stats={[
          { value: toFa(total), label: "قطعه سازگار" },
          { value: toFa(topCats.length), label: "دسته‌بندی" },
          { value: `${toFa(m.from)}–${toFa(m.to)}`, label: "سال‌های ساخت" },
        ]}
      />

      {topCats.length > 0 && (
        <nav className="container-x mt-8" aria-label={`دسته‌بندی قطعات ${fullName}`}>
          <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {topCats.map((c) => (
              <li key={c.id} className="shrink-0">
                <Link href={`${path}?cat=${c.id}`} rel="nofollow" prefetch={false} className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-xs font-semibold transition hover:border-neutral-950">
                  <c.icon className="size-3.5 text-primary" aria-hidden />
                  {c.nameFa} {fullName}
                  <span className="text-neutral-500">({toFa(cats.get(c.id) ?? 0)})</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <section className="container-x mt-8" aria-labelledby="products-title">
        <h2 id="products-title" className="sr-only">محصولات {fullName}</h2>
        <Listing basePath={path} scope={scope} params={lp} facets={{ modelsOf: b.id, yearsFor: m.id, categories: "param" }} listName={`لوازم یدکی ${fullName}`} />
      </section>

      <section className="container-x cv-auto mt-16 grid gap-10 lg:grid-cols-[1.4fr_1fr]" aria-labelledby="about-model-title">
        <div>
          <h2 id="about-model-title" className="text-xl font-black">خرید مطمئن لوازم یدکی {fullName}</h2>
          <p className="mt-4 leading-8 text-neutral-700">
            {fullName} ({b.nameEn} {m.nameEn}) یک {m.body} است که از سال {toFa(m.from)} تا {toFa(m.to)} تولید شده و در این بازه چند نسل و تیپ موتوری مختلف داشته است.
            به همین دلیل یک قطعه ممکن است فقط برای سال‌های مشخصی مناسب باشد. در فروشگاه حمیدی برای هر قطعه {fullName} بازه دقیق سال‌های سازگار، کد فنی فروشگاه و شماره OEM کارخانه درج شده است.
          </p>
          <p className="mt-4 leading-8 text-neutral-700">
            پرتقاضاترین قطعات این خودرو در فروشگاه ما {topCats.slice(0, 4).map((c) => c.nameFa).join("، ") || "قطعات مصرفی"} هستند.
            برای اطمینان صددرصدی، شماره شاسی (VIN) خودرو را از طریق واتساپ ارسال کنید تا قطعه از روی کاتالوگ رسمی تأیید شود.
          </p>
        </div>
        <nav aria-label={`سایر مدل‌های ${b.nameFa}`} className="rounded-3xl border border-neutral-200 bg-neutral-50 p-6">
          <h2 className="mb-4 font-black">سایر مدل‌های {b.nameFa}</h2>
          <ul className="grid grid-cols-2 gap-2">
            {siblings.map((s) => (
              <li key={s.id}><Link href={modelPath(b.id, s.id)} className="block rounded-xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-neutral-200 hover:bg-neutral-950 hover:text-white">لوازم یدکی {s.nameFa}</Link></li>
            ))}
          </ul>
        </nav>
      </section>

      <div className="container-x cv-auto mt-14">
        <Faq
          title={`سؤالات متداول قطعات ${fullName}`}
          items={[
            { q: `چطور مطمئن شوم قطعه با ${fullName} من سازگار است؟`, a: `سال ساخت را از فیلتر بالای صفحه انتخاب کنید؛ فقط قطعاتی نمایش داده می‌شوند که طبق کاتالوگ برای ${fullName} همان سال مناسب‌اند. برای اطمینان بیشتر شماره شاسی را در واتساپ ارسال کنید.` },
            { q: `قطعات ${fullName} اصلی هستند یا OEM؟`, a: "نوع هر قطعه (اصلی Genuine، OEM یا افترمارکت درجه یک) و نام سازنده به‌صورت شفاف روی صفحه محصول درج شده است." },
          ]}
        />
      </div>
    </>
  );
}
