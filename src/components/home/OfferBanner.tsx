import Link from "next/link";
import { ArrowLeft, Timer } from "lucide-react";
import Reveal from "@/components/ui/Reveal";

export default function OfferBanner() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-l from-ink-800 via-ink-850 to-ink-900 p-8 shadow-luxe sm:p-12">
          <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-accent-glow/15 blur-[100px]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_120%_at_90%_-10%,rgba(174,185,214,0.12),transparent)]" />

          <div className="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div className="max-w-xl">
              <span className="chip mb-4">
                <Timer className="h-3.5 w-3.5 text-accent" />
                پیشنهاد محدود
              </span>
              <h2 className="text-3xl font-black leading-tight text-silver-50 sm:text-4xl">
                تا <span className="text-metal num">۴۰٪</span> تخفیف
                <br />
                روی منتخب لوازم جانبی
              </h2>
              <p className="mt-3 text-sm leading-7 text-silver-400">
                فرصت محدود برای ارتقای تجربه‌ی موبایلت. کیفیت پریمیوم با قیمتی
                استثنایی.
              </p>

              {/* countdown (demo) */}
              <div className="mt-6 flex gap-3">
                {[
                  { v: "۰۲", l: "روز" },
                  { v: "۱۸", l: "ساعت" },
                  { v: "۴۵", l: "دقیقه" },
                ].map((t) => (
                  <div
                    key={t.l}
                    className="glass flex min-w-[64px] flex-col items-center rounded-xl px-3 py-2"
                  >
                    <span className="num text-xl font-black text-silver-50">
                      {t.v}
                    </span>
                    <span className="text-[11px] text-silver-500">{t.l}</span>
                  </div>
                ))}
              </div>
            </div>

            <Link href="/products?sort=discount" className="btn-luxe shrink-0">
              مشاهده تخفیف‌ها
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
