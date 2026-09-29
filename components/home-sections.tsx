"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, Search, Send } from "lucide-react";
import { Button, Container, SectionHeader, Badge } from "@/components/ui";
import { ProductCard } from "@/components/product-card";
import { ProductVisual } from "@/components/product-visual";
import { blogPosts, brands, categories, categoryCounts, heroWords, phoneModels, products, quickChips } from "@/lib/data";
import { toFa } from "@/lib/utils";

export function Hero() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % heroWords.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="py-8 text-center sm:py-14">
      <Container className="max-w-3xl">
        <h1 className="text-3xl font-black leading-[1.5] sm:text-5xl sm:leading-[1.5]">
          <span className="text-primary" data-hero-word>{heroWords[i]}</span> اورجینال
          <br />سریع و مطمئن، با ضمانت بازگشت
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-8 text-muted sm:text-base">لوازم جانبی محبوب موبایل، قاب، گلس، شارژر، هندزفری و بیشتر، با تضمین سازگاری کامل با مدل گوشی شما.</p>
        <form role="search" className="glass relative mx-auto mt-6 flex h-14 items-center rounded-full px-5 shadow-md" onSubmit={(e) => e.preventDefault()}>
          <input id="hero-search" type="search" placeholder="اسم محصول یا مدل گوشی رو بنویس… مثلا iPhone 15" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted" />
          <Search className="size-5 text-primary" />
        </form>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="text-muted">پیشنهادها:</span>
          {quickChips.map((c) => <a key={c} href="#featured" className="glass rounded-full px-3 py-1.5 font-medium hover:border-primary">{c}</a>)}
        </div>
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted"><span className="h-px w-8 bg-border" />برندهای موجود در کیس‌لاین<span className="h-px w-8 bg-border" /></div>
        <div className="no-scrollbar mt-3 flex justify-center gap-2 overflow-x-auto">
          {brands.slice(0, 6).map((b) => <span key={b} dir="ltr" className="glass shrink-0 rounded-full px-4 py-2 text-sm font-bold">{b}</span>)}
        </div>
      </Container>
    </section>
  );
}

export function CategoryPills() {
  return (
    <section className="pb-2">
      <Container>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2">
          <a href="#featured" className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-fg shadow-md">همه محصولات</a>
          {categories.map((c) => (
            <a key={c.slug} id={c.slug} href="#featured" className="glass flex shrink-0 items-center gap-2 rounded-full py-1.5 pe-4 ps-1.5 text-sm font-medium hover:border-primary">
              <span className="grid size-8 place-items-center rounded-full bg-primary/12"><ProductVisual kind={c.kind} hue={210} className="size-6" /></span>{c.label}
            </a>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Carousel({ items }: { items: typeof products }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((p) => <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-auto"><ProductCard p={p} /></div>)}
    </div>
  );
}

export function ProductRow({ id, title, items }: { id?: string; title: string; items: typeof products }) {
  return (
    <section id={id} className="py-4"><Container><SectionHeader title={title} href="#" /><Carousel items={items} /></Container></section>
  );
}

export const Featured = () => <ProductRow id="featured" title="محصولات ویژه" items={products.slice(0, 5)} />;
export const Newest = () => <ProductRow title="تازه‌ترین محصولات" items={[...products].reverse().slice(0, 5)} />;
export const BestSellers = () => <ProductRow title="پرفروش‌ترین‌ها" items={[products[0], products[4], products[11], products[5], products[2]]} />;

export function CategoryGrid() {
  return (
    <section className="py-4">
      <Container>
        <SectionHeader title="دسته‌بندی‌ها" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((c) => (
            <a key={c.slug} href="#featured" className="glass flex flex-col items-center gap-2 rounded-lg p-4 text-center transition-shadow hover:shadow-md">
              <span className="flex h-12 items-center gap-1"><ProductVisual kind={c.kind} hue={210} className="size-11" /></span>
              <span className="text-sm font-bold">{c.label}</span>
              <span className="text-[11px] text-muted">{toFa(categoryCounts[c.kind])} محصول</span>
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
  const pill = "h-10 cursor-pointer rounded-full border border-border bg-surface px-4 text-sm font-medium transition-colors data-[active=true]:border-primary data-[active=true]:bg-primary data-[active=true]:text-primary-fg";
  return (
    <section id="phone-picker" className="py-6">
      <Container>
        <div className="glass rounded-lg p-5 shadow-md sm:p-8">
          <div className="grid gap-5 lg:grid-cols-[1fr_1.5fr] lg:items-center">
            <div>
              <Badge>ویژه CaseLine</Badge>
              <h2 className="mt-2 text-2xl font-black sm:text-3xl">گوشی‌ت چیه؟</h2>
              <p className="mt-2 text-sm leading-7 text-muted">مدل گوشی را انتخاب کنید تا فقط محصولات سازگار را ببینید.</p>
            </div>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {Object.keys(phoneModels).map((b) => <button key={b} data-active={brand === b} className={pill} onClick={() => { setBrand(b); setModel(null); }}>{b}</button>)}
              </div>
              <div className="flex flex-wrap gap-2">
                {phoneModels[brand].map((m) => <button key={m} dir="ltr" data-active={model === m} className={pill} onClick={() => setModel(m)}>{m}</button>)}
              </div>
              <Button disabled={!model} className="w-full sm:w-auto">{model ? `نمایش لوازم ${model}` : "یک مدل انتخاب کنید"}<ArrowLeft className="size-4" /></Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function TelegramBanner() {
  return (
    <section className="py-4">
      <Container>
        <a href="#" className="relative flex items-center gap-4 overflow-hidden rounded-lg p-5 text-white shadow-md sm:p-8" style={{ background: "linear-gradient(120deg,#1f9bea,#1465c0)" }}>
          <span className="grid size-16 shrink-0 place-items-center rounded-full bg-white/20 sm:size-20"><Send className="size-8 sm:size-10" /></span>
          <div>
            <h3 className="text-base font-black sm:text-2xl">دریافت کدهای تخفیف و پیشنهادهای ویژه</h3>
            <p className="mt-1 text-xs opacity-90 sm:text-sm">عضویت در کانال تلگرام کیس‌لاین</p>
            <span className="mt-3 inline-block rounded-full bg-white/20 px-4 py-1.5 text-xs font-bold">ورود به کانال</span>
          </div>
        </a>
      </Container>
    </section>
  );
}

export function Blog() {
  return (
    <section id="blog" className="py-4">
      <Container>
        <SectionHeader title="آخرین بلاگ‌ها" href="#" />
        <div className="grid gap-3 md:grid-cols-3">
          {blogPosts.map((b, i) => (
            <a key={b.title} href="#" className="glass rounded-lg p-4 transition-shadow hover:shadow-md">
              <Badge tone="muted">{b.tag}</Badge>
              <h3 className="mt-3 font-bold leading-7">{b.title}</h3>
              <p className="mt-2 text-xs leading-6 text-muted">راهنمای کامل و ساده برای انتخاب بهتر لوازم جانبی مناسب مدل گوشی شما.</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">ادامه مطلب · {b.read} {i === 0 && "★"}</span>
            </a>
          ))}
        </div>
      </Container>
    </section>
  );
}
