import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { pageMetadata } from "@/lib/seo";
import { ArrowLeft, Award, HeartHandshake, ShieldCheck, Target } from "lucide-react";
import { PageHeader } from "@/components/shop/breadcrumbs";
import { Expertise } from "@/components/home/expertise";
import { Button } from "@/components/ui/button";
import { SHOP } from "@/lib/utils";

export const metadata: Metadata = pageMetadata({
  title: "درباره ما — ۲۰ سال تخصص نیسان و هوندا",
  description: "داستان فروشگاه حمیدی از ۱۳۸۴ در بازار امین‌السلطان تهران تا مرجع تخصصی لوازم یدکی نیسان و هوندا؛ ارزش‌ها، مسیر رشد و دلایل اعتماد مشتریان.",
  path: "/about",
});

const TIMELINE = [
  { y: "۱۳۸۴", t: "شروع فعالیت", d: "آغاز کار با یک مغازه کوچک در بازار امین‌السلطان با تمرکز بر قطعات نیسان." },
  { y: "۱۳۹۰", t: "افزودن هوندا", d: "گسترش سبد محصولات به تمام مدل‌های هوندا و واردات مستقیم از امارات." },
  { y: "۱۳۹۷", t: "انبار مرکزی", d: "راه‌اندازی انبار ۶۰۰ متری و سیستم کدینگ فنی قطعات بر اساس OEM." },
  { y: "۱۴۰۵", t: "فروشگاه آنلاین", d: "ارائه خدمات آنلاین و ارسال سریع به سراسر ایران با استعلام هوشمند." },
];

const VALUES = [
  { icon: ShieldCheck, t: "اصالت", d: "هیچ قطعه‌ای بدون بررسی کد فنی و اصالت از انبار خارج نمی‌شود." },
  { icon: Target, t: "تخصص", d: "تمرکز روی دو برند یعنی دانش عمیق‌تر و پاسخ دقیق‌تر." },
  { icon: HeartHandshake, t: "صداقت", d: "نوع قطعه (اصلی، OEM یا افترمارکت) همیشه شفاف اعلام می‌شود." },
  { icon: Award, t: "کیفیت خدمات", d: "مشاوره رایگان، ارسال سریع و ضمانت بازگشت کالا." },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader title="درباره فروشگاه حمیدی" subtitle={`${SHOP.slogan} — بیش از دو دهه همراه مالکان و تعمیرکاران نیسان و هوندا.`} crumbs={[{ href: "/about", label: "درباره ما" }]} />

      <section className="container-x mt-14 grid items-center gap-10 lg:grid-cols-2">
        <div>
          <p className="text-xs font-bold text-primary">داستان ما</p>
          <h2 className="mt-2 text-3xl font-black leading-tight">از یک مغازه کوچک تا مرجع تخصصی قطعات ژاپنی</h2>
          <div className="mt-5 space-y-4 leading-8 text-neutral-600">
            <p>فروشگاه حمیدی در سال ۱۳۸۴ با یک هدف ساده شروع به کار کرد: تأمین قطعه درست، با قیمت منصفانه، برای خودروهای نیسان. با گذشت زمان و اعتماد مشتریان، هوندا نیز به تخصص ما اضافه شد.</p>
            <p>امروز با انباری متشکل از هزاران قطعه اصلی و OEM، همکاری مستقیم با تأمین‌کنندگان معتبر و تیمی از کارشناسان آشنا به کاتالوگ‌های فنی، به مرجعی برای مالکان و تعمیرکاران این دو برند در سراسر ایران تبدیل شده‌ایم.</p>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link href="/shop">مشاهده فروشگاه <ArrowLeft aria-hidden /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/contact">تماس با ما</Link></Button>
          </div>
        </div>
        <div className="relative grid grid-cols-2 gap-4">
          {["/images/parts/brake-disc.png", "/images/parts/piston.png", "/images/parts/shock-absorber.png", "/images/parts/water-pump.png"].map((src, i) => (
            <div key={src} className={`overflow-hidden rounded-3xl border border-neutral-200 bg-studio ${i % 2 ? "translate-y-8" : ""}`}>
              <Image src={src} alt="" width={1200} height={1200} sizes="(min-width:1024px) 280px, 45vw" className="aspect-square w-full object-contain p-6 transition duration-500 hover:scale-110" />
            </div>
          ))}
        </div>
      </section>

      <section className="container-x mt-24">
        <h2 className="mb-8 text-2xl font-black">مسیر رشد ما</h2>
        <ol className="relative grid gap-6 md:grid-cols-4">
          <span className="absolute top-6 right-0 left-0 hidden h-0.5 bg-gradient-to-l from-primary via-neutral-300 to-neutral-200 md:block" />
          {TIMELINE.map((t) => (
            <li key={t.y} className="relative">
              <span className="relative z-10 grid h-12 w-24 place-items-center rounded-full bg-neutral-950 text-sm font-black text-white ring-8 ring-white">{t.y}</span>
              <h3 className="mt-4 font-extrabold">{t.t}</h3>
              <p className="mt-1 text-sm leading-7 text-neutral-600">{t.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container-x mt-20 mb-20">
        <h2 className="mb-8 text-2xl font-black">ارزش‌های ما</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v) => (
            <div key={v.t} className="group rounded-3xl border border-neutral-200 bg-white p-6 transition hover:-translate-y-1 hover:border-neutral-950 hover:shadow-xl">
              <span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-primary transition group-hover:bg-primary group-hover:text-white" aria-hidden><v.icon className="size-6" /></span>
              <h3 className="mt-5 text-lg font-extrabold">{v.t}</h3>
              <p className="mt-2 text-sm leading-7 text-neutral-600">{v.d}</p>
            </div>
          ))}
        </div>
      </section>

      <Expertise />
    </>
  );
}
