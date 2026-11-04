import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, BadgeCheck, Headphones, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { whatsappLink } from "@/lib/utils";

const FLOATING = [
  { src: "/images/parts/shock-absorber.png", alt: "کمک‌فنر", href: "/categories/shocks", cls: "top-[2%] right-[-2%]" },
  { src: "/images/parts/piston.png", alt: "پیستون", href: "/categories/piston", cls: "bottom-[6%] left-[-2%] [animation-delay:-3s]" },
];

/**
 * Static, server-rendered hero. No carousel: a single preloaded hero image
 * keeps LCP fast and layout shift at zero. Motion is CSS-only.
 */
export function Hero() {
  return (
    <section className="carbon relative overflow-hidden text-white" aria-labelledby="hero-title">
      <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" aria-hidden />
      <div className="pointer-events-none absolute hidden sm:block top-1/2 left-[22%] size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/30 blur-[120px]" aria-hidden />
      <div className="pointer-events-none absolute -top-10 left-[38%] hidden h-[140%] w-24 rotate-[18deg] bg-gradient-to-b from-primary/0 via-primary/20 to-primary/0 lg:block" aria-hidden />

      <div className="container-x relative grid items-center gap-10 pt-10 pb-32 lg:min-h-[600px] lg:grid-cols-[1.05fr_1fr] lg:pt-16 lg:pb-40">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-neutral-200">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            مرجع تخصصی لوازم یدکی نیسان و هوندا
          </p>
          <h1 id="hero-title" className="mt-6 text-4xl leading-[1.3] font-black tracking-tight sm:text-5xl lg:text-[3.5rem]">
            لوازم یدکی اصلی
            <br />
            <span className="bg-gradient-to-l from-[#ff6a5f] to-[#ff2a1f] bg-clip-text text-transparent">نیسان و هوندا</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-neutral-300 sm:text-lg">
            قطعات Genuine و OEM برای مورانو، ماکسیما، تیانا، ایکس‌تریل، جوک، اکسل و تمام مدل‌های هوندا از ۱۹۹۰ تا ۲۰۱۷ — با ضمانت اصالت، استعلام با شماره شاسی و ارسال سریع به سراسر ایران.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild><Link href="/shop">مشاهده فروشگاه <ArrowLeft aria-hidden /></Link></Button>
            <Button size="lg" variant="outline" asChild className="border-white/20 bg-white/5 text-white hover:border-white hover:bg-white hover:text-neutral-950">
              <a href={whatsappLink("سلام، برای استعلام قیمت قطعه پیام می‌دهم.")} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="size-5 text-[#25D366]" />استعلام در واتساپ</a>
            </Button>
          </div>
          <ul className="mt-10 grid max-w-lg grid-cols-3 gap-3">
            {[
              { icon: BadgeCheck, v: "۱۰۰٪", l: "ضمانت اصالت" },
              { icon: Truck, v: "۲۴ ساعته", l: "ارسال تهران" },
              { icon: Headphones, v: "+۲۰ سال", l: "تجربه تخصصی" },
            ].map((f) => (
              <li key={f.l} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <f.icon className="size-5 text-[#ff5a4f]" aria-hidden />
                <p className="mt-2 text-lg font-black">{f.v}</p>
                <p className="text-[11px] text-neutral-300">{f.l}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-[300px] sm:max-w-[440px] lg:max-w-[520px]">
          <div className="absolute inset-[6%] rounded-full border border-white/10" aria-hidden />
          <div className="absolute inset-[16%] animate-spin-slow rounded-full border border-dashed border-white/15 motion-reduce:animate-none" aria-hidden />
          <Image
            src="/images/parts/brake-disc.png"
            alt="دیسک ترمز و کالیپر — قطعات اصلی سیستم ترمز نیسان و هوندا"
            width={1200}
            height={1200}
            sizes="(min-width: 1024px) 440px, (min-width: 640px) 370px, 260px"
            preload
            fetchPriority="high"
            className="absolute inset-[8%] size-[84%] object-contain drop-shadow-[0_40px_60px_rgba(0,0,0,.6)]"
          />
          {FLOATING.map((f) => (
            <Link key={f.src} href={f.href} className={`absolute hidden size-28 animate-float rounded-3xl border border-white/10 bg-white/90 p-2 shadow-2xl motion-reduce:animate-none sm:block ${f.cls}`} aria-label={f.alt}>
              <Image src={f.src} alt="" width={224} height={224} sizes="112px" className="size-full object-contain" />
            </Link>
          ))}
          <p className="absolute top-[42%] -left-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-extrabold shadow-[0_15px_40px_-10px_rgba(225,6,0,.9)] sm:left-4">تا ۱۵٪ تخفیف</p>
        </div>
      </div>
    </section>
  );
}
