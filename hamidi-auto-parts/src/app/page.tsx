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
import { ProductCard } from "@/components/shop/product-card";
import { CATEGORIES } from "@/data/categories";
import { bestsellers, newest, specials } from "@/lib/catalog";

export default function HomePage() {
  const best = bestsellers().slice(0, 10);
  const fresh = newest().slice(0, 8);
  const deals = specials().slice(0, 8);

  return (
    <>
      <Hero />
      <TrustBar />

      <section className="container-x mt-14" id="vehicle">
        <VehicleSelector variant="light" />
      </section>

      <section className="container-x mt-20">
        <SectionHeading eyebrow="دسته‌بندی قطعات" title="هر قطعه‌ای که خودروی شما نیاز دارد" subtitle="۱۶ دسته تخصصی از موتور تا بدنه؛ قطعه مورد نظرتان را سریع‌تر پیدا کنید." href="/categories" linkLabel="همه دسته‌بندی‌ها" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 xl:grid-cols-8">
          {CATEGORIES.map((c) => <CategoryCard key={c.id} c={c} />)}
        </div>
      </section>

      <section className="container-x mt-20">
        <SectionHeading eyebrow={"پرفروش‌ترین‌ها"} title={<span className="flex items-center gap-2"><Flame className="size-7 text-primary" />محصولات پرفروش</span>} subtitle="قطعاتی که بیشترین سفارش را از سوی مشتریان و تعمیرکاران داشته‌اند." href="/shop?sort=popular" />
        <ProductRail products={best} />
      </section>

      <section className="container-x mt-14">
        <BrandShowcase />
      </section>

      <section className="mt-20">
        <div className="container-x">
          <div className="carbon relative overflow-hidden rounded-[2rem] p-6 sm:p-10">
            <div className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-primary/30 blur-[100px]" />
            <div className="bg-grid absolute inset-0 opacity-50" />
            <div className="relative mb-8 flex flex-wrap items-end justify-between gap-6">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-xs font-bold text-white"><Zap className="size-3.5" />پیشنهاد شگفت‌انگیز</span>
                <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">پیشنهادهای ویژه امروز</h2>
                <p className="mt-2 text-sm text-neutral-400">تخفیف‌های محدود روی قطعات منتخب نیسان و هوندا — تا پایان امروز</p>
              </div>
              <div className="flex flex-col items-start gap-3 sm:items-end">
                <Countdown />
                <Link href="/shop?sort=discount" className="text-sm font-semibold text-white underline-offset-4 hover:text-primary hover:underline">مشاهده همه تخفیف‌ها ←</Link>
              </div>
            </div>
            <div className="relative">
              <ProductRail products={deals} dark />
            </div>
          </div>
        </div>
      </section>

      <section className="container-x mt-20">
        <SectionHeading eyebrow="تازه رسیده" title={<span className="flex items-center gap-2"><Sparkles className="size-7 text-primary" />جدیدترین محصولات</span>} subtitle="آخرین قطعاتی که به انبار فروشگاه حمیدی اضافه شده‌اند." href="/shop?sort=newest" />
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {fresh.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      <div className="mt-24">
        <Expertise />
      </div>

      <section className="container-x mt-20">
        <SectionHeading eyebrow="ارتباط با ما" title="همیشه در دسترس شما هستیم" subtitle="برای استعلام قیمت، موجودی یا تطابق قطعه، از هر راهی که راحت‌ترید با ما در تماس باشید." href="/contact" linkLabel="صفحه تماس" />
        <ContactStrip />
      </section>
    </>
  );
}
