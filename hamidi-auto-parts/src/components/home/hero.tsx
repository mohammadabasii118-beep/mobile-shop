"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Truck, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { cn, toFa, whatsappLink } from "@/lib/utils";

const SLIDES = [
  {
    eyebrow: "سیستم ترمز · Brake System",
    title: ["توقف مطمئن،", "با قطعات اصلی"],
    text: "دیسک، لنت و کالیپر اصلی و OEM برای مورانو، ماکسیما، تیانا، آکورد و سیویک — با ضمانت اصالت و قیمت رقابتی.",
    image: "/parts/brake-disc.svg",
    side: ["/parts/brake-pads.svg", "/parts/sensor.svg"],
    href: "/categories/discs-pads",
    tag: "تا ۱۵٪ تخفیف",
  },
  {
    eyebrow: "جلوبندی و کمک‌فنر · Suspension",
    title: ["سواری نرم،", "مثل روز اول"],
    text: "کمک‌فنر KYB و Tokico، طبق و سیبک 555 ژاپن؛ هر آنچه برای جلوبندی نیسان و هوندا نیاز دارید.",
    image: "/parts/shock-absorber.svg",
    side: ["/parts/control-arm.svg", "/parts/ball-joint.svg"],
    href: "/categories/shocks",
    tag: "ارسال همان روز",
  },
  {
    eyebrow: "قطعات موتوری · Engine Parts",
    title: ["قلب خودرو،", "در دستان متخصص"],
    text: "تسمه و زنجیر تایم، پیستون و رینگ، واترپمپ و سرسیلندر — تأمین مستقیم از برندهای معتبر ژاپنی.",
    image: "/parts/piston.svg",
    side: ["/parts/timing-belt.svg", "/parts/water-pump.svg"],
    href: "/categories/engine",
    tag: "قطعات Genuine",
  },
];

export function Hero() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setI((x) => (x + 1) % SLIDES.length), 6500);
    return () => clearTimeout(t);
  }, [i, paused]);
  const s = SLIDES[i];

  return (
    <section className="carbon relative overflow-hidden text-white" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div className="pointer-events-none absolute top-1/2 left-[22%] size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/30 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 -bottom-40 size-96 rounded-full bg-white/5 blur-3xl" />
      {/* diagonal red stripe */}
      <div className="pointer-events-none absolute -top-10 left-[38%] hidden h-[140%] w-24 rotate-[18deg] bg-gradient-to-b from-primary/0 via-primary/20 to-primary/0 lg:block" />

      <div className="container-x relative grid min-h-[600px] items-center gap-10 pt-12 pb-40 lg:grid-cols-[1.05fr_1fr] lg:pt-16 lg:pb-44">
        <div key={`t-${i}`} className="animate-in fade-in slide-in-from-right-6 duration-700">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-neutral-300 backdrop-blur">
            <span className="size-1.5 rounded-full bg-primary" />
            {s.eyebrow}
          </span>
          <h1 className="mt-6 text-4xl leading-[1.25] font-black tracking-tight sm:text-5xl lg:text-[3.6rem]">
            {s.title[0]}
            <br />
            <span className="bg-gradient-to-l from-[#ff4d40] to-primary bg-clip-text text-transparent">{s.title[1]}</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-neutral-400 sm:text-lg">{s.text}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href={s.href}>مشاهده قطعات <ArrowLeft /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="border-white/15 bg-white/5 text-white hover:border-white hover:bg-white hover:text-neutral-950">
              <a href={whatsappLink("سلام، برای استعلام قیمت قطعه پیام می‌دهم.")} target="_blank" rel="noreferrer"><WhatsAppIcon className="size-5 text-[#25D366]" />استعلام در واتساپ</a>
            </Button>
          </div>
          <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
            {[
              { icon: BadgeCheck, v: "۱۰۰٪", l: "ضمانت اصالت" },
              { icon: Truck, v: "۲۴ ساعته", l: "ارسال تهران" },
              { icon: Headphones, v: "+۲۰ سال", l: "تجربه تخصصی" },
            ].map((f) => (
              <div key={f.l} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <f.icon className="size-5 text-primary" />
                <p className="mt-2 text-lg font-black">{f.v}</p>
                <p className="text-[11px] text-neutral-400">{f.l}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-[520px]">
          <div className="absolute inset-[6%] rounded-full border border-white/10" />
          <div className="absolute inset-[16%] animate-spin-slow rounded-full border border-dashed border-white/15" />
          <div className="absolute inset-[16%] rounded-full bg-gradient-to-br from-white/10 to-transparent" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={`m-${i}`} src={s.image} alt="" className="absolute inset-[8%] size-[84%] object-contain drop-shadow-[0_40px_60px_rgba(0,0,0,.6)] animate-in fade-in zoom-in-90 duration-700" />
          {s.side.map((src, k) => (
            <div
              key={`${i}-${src}`}
              className={cn(
                "absolute hidden size-28 animate-float rounded-3xl border border-white/10 bg-white/90 p-2 shadow-2xl backdrop-blur sm:block",
                k === 0 ? "top-[4%] right-[-2%]" : "bottom-[6%] left-[-2%] [animation-delay:-3s]",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="size-full object-contain" />
            </div>
          ))}
          <div className="absolute top-[42%] -left-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-extrabold shadow-[0_15px_40px_-10px_rgba(225,6,0,.9)] sm:left-4">
            {s.tag}
          </div>
        </div>
      </div>

      <div className="container-x absolute inset-x-0 bottom-28 z-10 flex items-center gap-3 lg:bottom-32">
        {SLIDES.map((_, k) => (
          <button key={k} onClick={() => setI(k)} aria-label={`اسلاید ${toFa(k + 1)}`} className="group relative h-1.5 w-12 cursor-pointer overflow-hidden rounded-full bg-white/15">
            <span className={cn("absolute inset-y-0 right-0 rounded-full bg-primary", k === i ? (paused ? "w-full" : "w-full animate-[grow_6.5s_linear]") : k < i ? "w-full opacity-40" : "w-0")} />
          </button>
        ))}
        <span className="mr-2 text-xs text-neutral-500 ltr-nums">{toFa(`0${i + 1}`)} / {toFa(`0${SLIDES.length}`)}</span>
      </div>
    </section>
  );
}
