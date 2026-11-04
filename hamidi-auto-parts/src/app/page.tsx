import type { Metadata } from "next";
import Link from "next/link";
import { Flame, Sparkles, Zap } from "lucide-react";
import { Hero } from "@/components/home/hero";
import { TrustBar } from "@/components/home/trust-bar";
import { BrandShowcase } from "@/components/home/brand-showcase";
import { Countdown } from "@/components/home/countdown";
import { Expertise } from "@/components/home/expertise";
import { ContactStrip } from "@/components/home/contact-strip";
import { VehicleSelector } from "@/components/shop/vehicle-selector";
import { SectionHeading } from "@/components/shop/section-heading";
import { CategoryCard } from "@/components/shop/category-card";
import { ProductRail } from "@/components/shop/product-rail";
import { ProductGrid } from "@/components/shop/product-card";
import { CATEGORIES } from "@/data/categories";
import { bestsellers, categoryFacets, newest, specials } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";
import { SHOP } from "@/lib/utils";

// Static page, regenerated at most once an hour (ISR) so prices/stock stay fresh.
export const revalidate = 3600;

export const metadata: Metadata = {
  ...pageMetadata({
    title: `${SHOP.nameFa} | لوازم یدکی نیسان و هوندا — HAMIDI AUTO PARTS`,
    description:
      "خرید لوازم یدکی اصلی و OEM نیسان و هوندا برای مورانو، ماکسیما، تیانا، آکورد، سیویک و سی‌آر‌وی؛ لنت، کمک‌فنر، قطعات موتوری با ضمانت اصالت و ارسال سریع.",
    path: "/",
  }),
  title: { absolute: `${SHOP.nameFa} | لوازم یدکی نیسان و هوندا — HAMIDI AUTO PARTS` },
};

export default function HomePage() {
  const counts = categoryFacets({});
  return (
    <>
      <Hero />
      <TrustBar />

      <section className="container-x mt-14" id="vehicle" aria-label="انتخاب خودرو">
        <VehicleSelector />
      </section>

      <section className="container-x mt-20" aria-labelledby="cats-title">
        <SectionHeading id="cats-title" eyebrow="دسته‌بندی قطعات" title="هر قطعه‌ای که خودروی شما نیاز دارد" subtitle="۱۶ دسته تخصصی از موتور تا بدنه؛ قطعه مورد نظرتان را سریع‌تر پیدا کنید." href="/categories" linkLabel="همه دسته‌بندی‌ها" />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 xl:grid-cols-8">
          {CATEGORIES.map((c) => <li key={c.id} className="flex [&>a]:w-full"><CategoryCard c={c} count={counts.get(c.id) ?? 0} /></li>)}
        </ul>
      </section>

      <section className="container-x mt-20" aria-labelledby="best-title">
        <SectionHeading id="best-title" eyebrow="پرفروش‌ترین‌ها" title={<span className="flex items-center gap-2"><Flame className="size-7 text-primary" aria-hidden />محصولات پرفروش</span>} subtitle="قطعاتی که بیشترین سفارش را از سوی مشتریان و تعمیرکاران داشته‌اند." href="/shop" />
        <ProductRail products={bestsellers(8)} label="محصولات پرفروش" />
      </section>

      <section className="container-x mt-14" aria-label="برندها">
        <BrandShowcase />
      </section>

      <section className="container-x mt-20" aria-labelledby="deals-title">
        <div className="carbon relative overflow-hidden rounded-[2rem] p-6 sm:p-10">
          <div className="pointer-events-none absolute hidden sm:block -top-32 -right-32 size-96 rounded-full bg-primary/30 blur-[100px]" aria-hidden />
          <div className="relative mb-8 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-xs font-bold text-white"><Zap className="size-3.5" aria-hidden />پیشنهاد شگفت‌انگیز</p>
              <h2 id="deals-title" className="mt-3 text-3xl font-black text-white sm:text-4xl">پیشنهادهای ویژه امروز</h2>
              <p className="mt-2 text-sm text-neutral-300">تخفیف‌های محدود روی قطعات منتخب نیسان و هوندا — تا پایان امروز</p>
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <Countdown />
              <Link href="/shop?sort=discount" rel="nofollow" className="text-sm font-semibold text-white underline-offset-4 hover:underline">مشاهده همه تخفیف‌ها ←</Link>
            </div>
          </div>
          <div className="relative">
            <ProductRail products={specials(6)} dark label="پیشنهادهای ویژه" />
          </div>
        </div>
      </section>

      <section className="container-x mt-20" aria-labelledby="new-title">
        <SectionHeading id="new-title" eyebrow="تازه رسیده" title={<span className="flex items-center gap-2"><Sparkles className="size-7 text-primary" aria-hidden />جدیدترین محصولات</span>} subtitle="آخرین قطعاتی که به انبار فروشگاه حمیدی اضافه شده‌اند." href="/shop?sort=newest" />
        <ProductGrid products={newest(8)} className="lg:grid-cols-4" />
      </section>

      <div className="mt-24">
        <Expertise />
      </div>

      <section className="container-x cv-auto mt-20" aria-labelledby="contact-title">
        <SectionHeading id="contact-title" eyebrow="ارتباط با ما" title="همیشه در دسترس شما هستیم" subtitle="برای استعلام قیمت، موجودی یا تطابق قطعه، از هر راهی که راحت‌ترید با ما در تماس باشید." href="/contact" linkLabel="صفحه تماس" />
        <ContactStrip />
      </section>
    </>
  );
}
