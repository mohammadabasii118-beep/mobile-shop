"use client";
import { useState } from "react";
import { ArrowLeft, BadgePercent, Headphones, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { Button, Container, SectionHeader, Badge, buttonVariants } from "@/components/ui";
import { ProductCard } from "@/components/product-card";
import { ProductVisual } from "@/components/product-visual";
import { blogPosts, brands, categories, phoneModels, products } from "@/lib/data";
import { cn } from "@/lib/utils";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <Container className="grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-2 lg:py-20">
        <div className="relative z-10">
          <Badge tone="dark" className="mb-4">کالکشن جدید ۱۴۰۵</Badge>
          <h1 className="text-4xl font-black leading-[1.25] sm:text-5xl lg:text-6xl">اکسسوری‌ای که <span className="text-primary">گوشی‌ت</span>ــو کامل می‌کنه</h1>
          <p className="mt-4 max-w-lg text-base leading-8 text-muted sm:text-lg">قاب، گلس، شارژر و هندزفری اورجینال؛ با تضمین سازگاری کامل با مدل گوشی شما.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#featured" className={buttonVariants({ size: "lg" })}>مشاهده محصولات <ArrowLeft className="size-5" /></a>
            <a href="#phone-picker" className={buttonVariants({ size: "lg", variant: "outline" })}>انتخاب بر اساس مدل گوشی</a>
          </div>
          <dl className="mt-9 flex gap-8 text-sm">
            {[["+۱۲٬۰۰۰", "مشتری راضی"], ["+۸۰۰", "محصول"], ["۷ روز", "ضمانت بازگشت"]].map(([n, l]) => (
              <div key={l}><dt className="text-xl font-extrabold">{n}</dt><dd className="text-muted">{l}</dd></div>
            ))}
          </dl>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-md lg:max-w-none">
          <div className="absolute inset-4 rounded-[40%_60%_55%_45%/50%_45%_55%_50%] bg-primary/15" />
          <div className="absolute inset-[18%] rounded-full bg-accent/15" />
          <ProductVisual kind="case" hue={14} className="absolute start-[6%] top-[8%] w-[58%] -rotate-6 drop-shadow-2xl" />
          <ProductVisual kind="earbuds" hue={280} className="absolute end-[2%] top-[38%] w-[42%] rotate-6 drop-shadow-xl" />
          <ProductVisual kind="charger" hue={40} className="absolute bottom-[2%] start-[26%] w-[36%] drop-shadow-xl" />
        </div>
      </Container>
    </section>
  );
}

export function Categories() {
  return (
    <section className="py-8">
      <Container>
        <SectionHeader title="دسته‌بندی محصولات" />
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0 lg:grid-cols-9">
          {categories.map((c) => (
            <a key={c.slug} id={c.slug} href="#featured" className="group flex w-24 shrink-0 flex-col items-center gap-2 sm:w-auto">
              <span className="grid aspect-square w-full place-items-center rounded-lg border border-border bg-surface transition-all group-hover:-translate-y-1 group-hover:border-primary group-hover:shadow-md" style={{ background: `linear-gradient(160deg, hsl(${c.hue} 60% 92% / .7), var(--surface))` }}>
                <ProductVisual kind={c.kind} hue={c.hue} className="size-[78%]" />
              </span>
              <span className="text-center text-xs font-semibold sm:text-sm">{c.label}</span>
            </a>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function PhonePicker() {
  const [brand, setBrand] = useState("Apple");
  const [model, setModel] = useState<string | null>("iPhone 15 Pro Max");
  return (
    <section id="phone-picker" className="py-8">
      <Container>
        <div className="overflow-hidden rounded-lg bg-secondary p-6 text-secondary-fg sm:p-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-center">
            <div>
              <h2 className="text-2xl font-black sm:text-3xl">گوشی‌ت چیه؟</h2>
              <p className="mt-2 text-sm leading-7 opacity-75">مدل گوشی را انتخاب کنید تا فقط محصولات سازگار را ببینید؛ بدون نگرانی از اشتباه در خرید.</p>
            </div>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {Object.keys(phoneModels).map((b) => (
                  <button key={b} onClick={() => { setBrand(b); setModel(null); }} className={cn("h-10 cursor-pointer rounded-full px-5 text-sm font-semibold transition-colors", brand === b ? "bg-primary text-primary-fg" : "bg-secondary-fg/10 hover:bg-secondary-fg/20")}>{b}</button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {phoneModels[brand].map((m) => (
                  <button key={m} dir="ltr" onClick={() => setModel(m)} className={cn("h-10 cursor-pointer rounded-md border px-4 text-sm transition-colors", model === m ? "border-primary bg-primary/20" : "border-secondary-fg/20 hover:border-secondary-fg/50")}>{m}</button>
                ))}
              </div>
              <Button disabled={!model} className="w-full sm:w-auto">{model ? `نمایش لوازم ${model}` : "یک مدل انتخاب کنید"}<ArrowLeft className="size-4" /></Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function ProductGrid({ items }: { items: typeof products }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {items.map((p) => <ProductCard key={p.id} p={p} />)}
    </div>
  );
}

export function Featured() {
  return (
    <section id="featured" className="py-8">
      <Container>
        <SectionHeader title="محصولات ویژه" sub="منتخب تیم CaseLine" href="#" />
        <ProductGrid items={products.slice(0, 8)} />
      </Container>
    </section>
  );
}

export function PromoBanners() {
  return (
    <section className="py-8">
      <Container className="grid gap-4 md:grid-cols-2">
        <a href="#" className="relative flex min-h-48 items-center overflow-hidden rounded-lg bg-primary p-7 text-primary-fg">
          <div className="relative z-10 max-w-[62%]">
            <Badge tone="dark">تا ۳۰٪ تخفیف</Badge>
            <h3 className="mt-3 text-2xl font-black">جشنواره قاب و گلس</h3>
            <p className="mt-1 text-sm opacity-90">برای همه مدل‌های آیفون و سامسونگ</p>
          </div>
          <ProductVisual kind="case" hue={14} className="absolute -end-4 -bottom-6 w-40 sm:w-52 rotate-12 opacity-90" />
        </a>
        <a href="#" className="relative flex min-h-48 items-center overflow-hidden rounded-lg bg-secondary p-7 text-secondary-fg">
          <div className="relative z-10 max-w-[62%]">
            <Badge>جدید</Badge>
            <h3 className="mt-3 text-2xl font-black">شارژر GaN ۶۵ وات</h3>
            <p className="mt-1 text-sm opacity-75">موبایل، تبلت و لپ‌تاپ با یک شارژر</p>
          </div>
          <ProductVisual kind="charger" hue={40} className="absolute -end-2 -bottom-4 w-36 sm:w-48 -rotate-6" />
        </a>
      </Container>
    </section>
  );
}

export function BestSellers() {
  return (
    <section className="py-8">
      <Container>
        <SectionHeader title="پرفروش‌ترین‌ها" href="#" />
        <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {[...products].reverse().slice(0, 4).map((p) => <div key={p.id} className="w-44 shrink-0 snap-start sm:w-auto"><ProductCard p={p} /></div>)}
        </div>
      </Container>
    </section>
  );
}

export function BrandsStrip() {
  return (
    <section id="brands" className="py-8">
      <Container>
        <SectionHeader title="برندهای معتبر" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {brands.map((b) => (
            <a key={b} href="#" dir="ltr" className="grid h-16 place-items-center rounded-md border border-border bg-surface text-lg font-extrabold text-muted transition-colors hover:border-primary hover:text-foreground">{b}</a>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function Benefits() {
  const items = [
    { icon: ShieldCheck, t: "ضمانت اصالت کالا", d: "همه محصولات اورجینال" },
    { icon: Truck, t: "ارسال سریع", d: "تحویل در تهران همان روز" },
    { icon: RotateCcw, t: "۷ روز بازگشت", d: "بدون قید و شرط" },
    { icon: Headphones, t: "پشتیبانی واقعی", d: "پاسخ‌گویی هر روز هفته" },
  ];
  return (
    <section className="py-8">
      <Container className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map(({ icon: I, t, d }) => (
          <div key={t} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary/12 text-primary"><I className="size-6" /></span>
            <div><div className="text-sm font-bold">{t}</div><div className="text-xs text-muted">{d}</div></div>
          </div>
        ))}
      </Container>
    </section>
  );
}

export function Recommended() {
  return (
    <section className="py-8">
      <Container>
        <SectionHeader title="پیشنهاد برای شما" sub="بر اساس محصولات پرطرفدار" href="#" />
        <ProductGrid items={products.slice(4, 12).filter((p) => p.oldPrice || p.badge).slice(0, 4)} />
      </Container>
    </section>
  );
}

export function Blog() {
  return (
    <section className="py-8">
      <Container>
        <SectionHeader title="مجله CaseLine" href="#" />
        <div className="grid gap-4 md:grid-cols-3">
          {blogPosts.map((b, i) => (
            <a key={b.title} href="#" className="group overflow-hidden rounded-lg border border-border bg-surface transition-shadow hover:shadow-md">
              <div className="grid h-36 place-items-center" style={{ background: `linear-gradient(135deg, hsl(${i * 90 + 20} 70% 60%), hsl(${i * 90 + 60} 70% 40%))` }}>
                <BadgePercent className="size-10 text-white/70" />
              </div>
              <div className="p-4"><Badge tone="muted">{b.tag}</Badge><h3 className="mt-2 font-bold leading-7 group-hover:text-primary">{b.title}</h3><p className="mt-1 text-xs text-muted">زمان مطالعه: {b.read}</p></div>
            </a>
          ))}
        </div>
      </Container>
    </section>
  );
}
