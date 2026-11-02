import { Star, Quote } from "lucide-react";
import Reveal from "@/components/ui/Reveal";

const reviews = [
  {
    name: "سارا محمدی",
    role: "خریدار ساعت هوشمند نوا",
    text: "کیفیت ساخت فوق‌العاده‌ست و بسته‌بندی حس یک برند لوکس رو منتقل می‌کنه. ارسال هم خیلی سریع بود.",
    rating: 5,
  },
  {
    name: "امیر رضایی",
    role: "خریدار هندزفری آئورا",
    text: "نویز کنسلینگ واقعاً عالی کار می‌کنه. تجربه‌ی خرید از سایت هم روون و حرفه‌ای بود.",
    rating: 5,
  },
  {
    name: "نگار کریمی",
    role: "خریدار پاوربانک اوربیت",
    text: "دقیقاً همون چیزی بود که می‌خواستم. نمایشگر درصد شارژ خیلی کاربردیه و طراحیش شیکه.",
    rating: 4,
  },
];

export default function Testimonials() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <Reveal className="mb-8 text-center">
        <h2 className="text-2xl font-black text-silver-50 sm:text-3xl">
          مشتریان چه می‌گویند
        </h2>
        <p className="mt-2 text-sm text-silver-400">
          نظرات نمایشی برای این دمو
        </p>
      </Reveal>

      <div className="grid gap-4 md:grid-cols-3">
        {reviews.map((r, i) => (
          <Reveal key={r.name} delay={i * 0.08}>
            <figure className="glass flex h-full flex-col rounded-2xl p-6">
              <Quote className="mb-3 h-7 w-7 text-accent/40" />
              <blockquote className="flex-1 text-sm leading-7 text-silver-200">
                {r.text}
              </blockquote>
              <div className="mt-4 flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, k) => (
                  <Star
                    key={k}
                    className={`h-4 w-4 ${
                      k < r.rating
                        ? "fill-amber-300 text-amber-300"
                        : "text-silver-600"
                    }`}
                  />
                ))}
              </div>
              <figcaption className="mt-4 flex items-center gap-3 border-t border-white/[0.06] pt-4">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-metal text-sm font-bold text-ink-900">
                  {r.name.charAt(0)}
                </span>
                <div>
                  <div className="text-sm font-semibold text-silver-50">
                    {r.name}
                  </div>
                  <div className="text-[11px] text-silver-500">{r.role}</div>
                </div>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
