"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { ArrowLeft, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CanvasShell } from "@/components/product/canvas-shell";
import { ProductArt } from "@/components/product/product-art";
import { formatNumber } from "@/lib/format";

// three.js فقط وقتی Hero نزدیک viewport است و دستگاه توان دارد دانلود می‌شود
const HeroScene = dynamic(() => import("@/3d/hero-scene"), { ssr: false });

const ease = [0.22, 1, 0.36, 1] as const;
const item = (i: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay: 0.08 * i, ease },
});

function Poster() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <ProductArt kind="case" color="#cdbfa6" className="size-[78%] max-h-[520px]" label="قاب Aura، نمای ثابت" />
    </div>
  );
}

export function Hero() {
  return (
    <section id="top" className="surface-dark relative isolate overflow-hidden bg-bg text-fg">
      <div className="glow pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div className="container-x grid min-h-[calc(100dvh-64px)] items-center gap-6 py-10 md:min-h-[min(820px,calc(100dvh-72px))] lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        <div className="order-2 lg:order-1">
          <motion.p {...item(0)} className="mb-6 inline-flex items-center gap-2 rounded-full bg-secondary py-1 pe-4 ps-3 text-sm">
            <span className="relative grid size-2.5 place-items-center" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:hidden" />
              <span className="relative size-2 rounded-full bg-accent" />
            </span>
            جدید · سری Aura برای <bdi>iPhone 17</bdi>
          </motion.p>

          <motion.h1 {...item(1)} className="t-display">
            قاب‌هایی که با گوشی‌ات
            <br />
            <span className="text-accent">یکی می‌شوند.</span>
          </motion.h1>

          <motion.p {...item(2)} className="t-body mt-6 max-w-lg text-lg text-muted">
            سیلیکون نرم، حلقهٔ مگنتی هم‌محور و لبهٔ محافظ لنز. ببین، بچرخان، رنگش را انتخاب کن — بعد سفارش بده.
          </motion.p>

          <motion.div {...item(3)} className="mt-9 flex flex-wrap gap-3">
            <Button asChild variant="accent" size="lg">
              <a href="#showcase">
                <Box /> طراحی قاب خودت
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#best-sellers">
                مشاهدهٔ پرفروش‌ها <ArrowLeft />
              </a>
            </Button>
          </motion.div>

          <motion.dl {...item(4)} className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-line pt-6">
            {[
              [`${formatNumber(2)} ساعته`, "ارسال در تهران"],
              [`${formatNumber(7)} روز`, "بازگشت بی‌قیدوشرط"],
              ["۱۰۰٪", "ضمانت اصالت"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="price text-xl">{v}</dt>
                <dd className="t-caption text-muted">{l}</dd>
              </div>
            ))}
          </motion.dl>
        </div>

        <motion.div
          className="relative order-1 h-[42vh] min-h-[320px] lg:order-2 lg:h-[min(680px,78dvh)]"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease }}
        >
          <CanvasShell className="size-full" label="قاب Aura، نمای سه‌بعدی تعاملی" fallback={<Poster />}>
            {(cap) => <HeroScene quality={cap.quality} reducedMotion={cap.reducedMotion} />}
          </CanvasShell>
          <span className="t-caption pointer-events-none absolute inset-x-0 bottom-2 mx-auto w-fit rounded-full bg-secondary/80 px-3 py-1 text-muted">
            <bdi>iPhone 17 Pro</bdi> · Aura · ماسه
          </span>
        </motion.div>
      </div>
    </section>
  );
}
