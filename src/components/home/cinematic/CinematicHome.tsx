"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowLeft, Sparkles, ChevronDown } from "lucide-react";
import { scrollState } from "@/lib/scroll";
import { AD } from "@/lib/media";
import { productsByBadge, products } from "@/lib/products";
import ProductCard from "@/components/product/ProductCard";
import AdBackdrop from "@/components/ui/AdBackdrop";

const CinematicScene = dynamic(() => import("./CinematicScene"), {
  ssr: false,
  loading: () => null,
});

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(mq.matches);
  }, []);
  return r;
}

/* ------------------------------------------------------------------ */

export default function CinematicHome() {
  const reduce = useReducedMotion();
  const mobile = useIsMobile();

  if (reduce) return <StaticHero />;
  return <Cinematic mobile={mobile} />;
}

/* ------------------------------------------------------------------ */

function Cinematic({ mobile }: { mobile: boolean }) {
  const section = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const s1 = useRef<HTMLDivElement>(null);
  const s2 = useRef<HTMLDivElement>(null);
  const s3 = useRef<HTMLDivElement>(null);
  const s4 = useRef<HTMLDivElement>(null);
  const s5 = useRef<HTMLDivElement>(null);

  // Only mount the Canvas while the section is near the viewport (frees GPU).
  const [active, setActive] = useState(true);

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setActive(e.isIntersecting),
      { rootMargin: "200px 0px 200px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const overlays = [
      s1.current,
      s2.current,
      s3.current,
      s4.current,
      s5.current,
    ];

    const ctx = gsap.context(() => {
      // single scroll engine: ScrollTrigger scrubs the whole timeline and
      // feeds scrollState.progress to the R3F render loop.
      const proxy = { v: 0 };
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 1,
          onUpdate: (self) => {
            scrollState.progress = self.progress;
          },
        },
      });

      tl.to(proxy, { v: 1, duration: 1 }, 0); // spine → total duration = 1

      gsap.set([s2.current, s3.current, s4.current, s5.current], {
        opacity: 0,
        y: 36,
      });
      gsap.set(s1.current, { opacity: 1, y: 0 });

      // scene 1 out
      tl.to(s1.current, { opacity: 0, y: -24, duration: 0.03 }, 0.16);
      // scene 2
      tl.to(s2.current, { opacity: 1, y: 0, duration: 0.035 }, 0.21)
        .to(s2.current, { opacity: 0, y: -24, duration: 0.03 }, 0.36);
      // scene 3
      tl.to(s3.current, { opacity: 1, y: 0, duration: 0.035 }, 0.41)
        .to(s3.current, { opacity: 0, y: -24, duration: 0.03 }, 0.56);
      // scene 4
      tl.to(s4.current, { opacity: 1, y: 0, duration: 0.035 }, 0.61)
        .to(s4.current, { opacity: 0, y: -24, duration: 0.03 }, 0.76);
      // scene 5 (stays)
      tl.to(s5.current, { opacity: 1, y: 0, duration: 0.04 }, 0.82);
    }, section);

    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);
    const t = setTimeout(refresh, 300);

    return () => {
      clearTimeout(t);
      window.removeEventListener("load", refresh);
      ctx.revert();
      overlays.forEach((o) => o && gsap.set(o, { clearProps: "all" }));
    };
  }, [mobile]);

  const featured = productsByBadge("featured").slice(0, mobile ? 2 : 4);
  const grid = featured.length ? featured : products.slice(0, 4);

  return (
    <section
      ref={section}
      className="relative h-[500vh] bg-ink-950"
      aria-label="تجربه سینمایی فروشگاه"
    >
      {/* pinned stage (native sticky — no layout shift) */}
      <div
        ref={stage}
        className="sticky top-0 h-screen w-full overflow-hidden"
      >
        {/* optional cinematic advertising backdrop (behind the transparent 3D
            canvas). Falls back to the dark scene if the file is absent. */}
        <AdBackdrop src={AD.hero} opacity={0.5} />

        {/* 3D canvas — never blocks interaction */}
        <div className="pointer-events-none absolute inset-0 z-0">
          {active && <CinematicScene mobile={mobile} />}
        </div>

        {/* ambient vignette */}
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(70%_70%_at_50%_30%,transparent,rgba(5,5,6,0.55))]" />

        {/* overlays layer — container passes clicks through, children don't */}
        <div className="pointer-events-none absolute inset-0 z-10">
          {/* scene 1 */}
          <SceneLayer refEl={s1} align="center">
            <span className="chip pointer-events-auto mb-5">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              وارد دنیای تکنولوژی شو
            </span>
            <h1 className="text-4xl font-black leading-[1.15] tracking-tight sm:text-6xl lg:text-7xl">
              <span className="text-silver-50">تجربه‌ای فراتر از</span>
              <br />
              <span className="text-metal">یک اکسسوری</span>
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-sm leading-8 text-silver-400 sm:text-base">
              گوشی، قاب، شارژر، پاوربانک و هندزفری — در یک روایت سه‌بعدی پیوسته.
              اسکرول کن تا داستان آغاز شود.
            </p>
            <div className="pointer-events-auto mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/products" className="btn-luxe">
                ورود به فروشگاه
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <Link href="/products?sort=bestseller" className="btn-ghost">
                پرفروش‌ترین‌ها
              </Link>
            </div>
            <div className="mt-10 flex flex-col items-center gap-1 text-silver-500">
              <span className="text-[11px]">برای شروع روایت، اسکرول کن</span>
              <ChevronDown className="h-5 w-5 animate-bounce" />
            </div>
          </SceneLayer>

          {/* scene 2 */}
          <SceneLayer refEl={s2} align="start">
            <SceneKicker>صحنه ۲ — محافظت</SceneKicker>
            <h2 className="text-3xl font-black text-silver-50 sm:text-5xl">
              قاب و <span className="text-metal">محافظ صفحه</span>
            </h2>
            <p className="mt-4 max-w-md text-sm leading-8 text-silver-400">
              قاب از بدنه جدا می‌شود، مدل‌های مختلف حول گوشی می‌چرخند و یکی روی آن
              می‌نشیند؛ گلس محافظ بلند و دوباره روی صفحه قرار می‌گیرد.
            </p>
            <SceneCta href="/products?cat=cases" label="دیدن قاب‌ها" />
          </SceneLayer>

          {/* scene 3 */}
          <SceneLayer refEl={s3} align="end">
            <SceneKicker>صحنه ۳ — انرژی</SceneKicker>
            <h2 className="text-3xl font-black text-silver-50 sm:text-5xl">
              قدرت و <span className="text-metal">شارژ</span>
            </h2>
            <p className="mt-4 max-w-md text-sm leading-8 text-silver-400">
              شارژر می‌چرخد، خطوط نوری نقره‌ای جریان انرژی را به گوشی می‌رسانند و
              صفحه‌ی نمایش روشن می‌شود.
            </p>
            <SceneCta href="/products?cat=chargers" label="محصولات شارژ" />
          </SceneLayer>

          {/* scene 4 */}
          <SceneLayer refEl={s4} align="center">
            <SceneKicker>صحنه ۴ — صدا</SceneKicker>
            <h2 className="text-3xl font-black text-silver-50 sm:text-5xl">
              دنیای <span className="text-metal">صدا</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm leading-8 text-silver-400">
              درِ کیس باز می‌شود، ایربادها بیرون می‌آیند و موج‌های صوتی در فضای
              تاریک و سینمایی شکل می‌گیرند.
            </p>
            <div className="pointer-events-auto mt-6 flex justify-center">
              <SceneCta href="/products?cat=headphones" label="محصولات صوتی" />
            </div>
          </SceneLayer>

          {/* scene 5 — real, clickable product grid */}
          <div
            ref={s5}
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4"
          >
            <div className="pointer-events-auto mb-5 text-center">
              <SceneKicker center>ویترین فروشگاه</SceneKicker>
              <h2 className="text-3xl font-black text-silver-50 sm:text-4xl">
                محصولات <span className="text-metal">ویژه</span>
              </h2>
            </div>
            <div className="pointer-events-auto grid w-full max-w-5xl grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
              {grid.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            <Link
              href="/products"
              className="btn-ghost pointer-events-auto mt-6"
            >
              مشاهده همه‌ی محصولات
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- overlay helpers ---------- */

function SceneLayer({
  refEl,
  align,
  children,
}: {
  refEl: React.RefObject<HTMLDivElement>;
  align: "center" | "start" | "end";
  children: React.ReactNode;
}) {
  const justify =
    align === "center"
      ? "items-center text-center"
      : align === "start"
        ? "items-center text-center lg:items-start lg:text-right"
        : "items-center text-center lg:items-end lg:text-left";
  const pos =
    align === "start"
      ? "lg:pr-[8%]"
      : align === "end"
        ? "lg:pl-[8%]"
        : "";
  return (
    <div
      ref={refEl}
      className={`absolute inset-0 flex flex-col justify-center px-6 ${justify} ${pos}`}
    >
      <div className="w-full max-w-2xl">{children}</div>
    </div>
  );
}

function SceneKicker({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <span
      className={`mb-3 block text-xs font-bold tracking-[0.3em] text-accent ${
        center ? "" : ""
      }`}
    >
      {children}
    </span>
  );
}

function SceneCta({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="btn-luxe pointer-events-auto mt-6">
      {label}
      <ArrowLeft className="h-4 w-4" />
    </Link>
  );
}

/* ---------- reduced-motion fallback ---------- */

function StaticHero() {
  const featured = productsByBadge("featured").slice(0, 4);
  const grid = featured.length ? featured : products.slice(0, 4);
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-radial-fade" />
      <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6">
        <span className="chip mb-5">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          فروشگاه لوکس لوازم جانبی موبایل
        </span>
        <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-6xl">
          <span className="text-silver-50">تجربه‌ای فراتر از</span>{" "}
          <span className="text-metal">یک اکسسوری</span>
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-base leading-8 text-silver-400">
          گوشی، قاب، شارژر، پاوربانک و هندزفری — با طراحی مینیمال و کیفیت پریمیوم.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/products" className="btn-luxe">
            ورود به فروشگاه
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Link href="/products?sort=bestseller" className="btn-ghost">
            پرفروش‌ترین‌ها
          </Link>
        </div>
        <div className="mt-14 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {grid.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
