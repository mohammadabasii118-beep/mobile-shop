import { Sparkles, Target, Gem, Users } from "lucide-react";
import Reveal from "@/components/ui/Reveal";

export const metadata = { title: "درباره ما" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <Reveal className="text-center">
        <span className="chip mb-4">
          <Sparkles className="h-3.5 w-3.5 text-accent" /> داستان ما
        </span>
        <h1 className="text-3xl font-black text-silver-50 sm:text-4xl">
          درباره‌ی <span className="text-metal">لوکس‌سل</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl leading-8 text-silver-400">
          لوکس‌سل با یک باور ساده متولد شد: لوازم جانبی موبایل هم می‌توانند
          تجربه‌ای لوکس باشند. ما مجموعه‌ای منتخب از بهترین محصولات را با طراحی
          مدرن، کیفیت پریمیوم و تجربه‌ی خریدی آینده‌نگر کنار هم آورده‌ایم.
        </p>
      </Reveal>

      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Target, t: "مأموریت", d: "ارتقای تجربه‌ی روزمره‌ی موبایل با محصولات برگزیده" },
          { icon: Gem, t: "کیفیت", d: "تعهد به اصالت و دوام در هر محصول" },
          { icon: Users, t: "مشتری", d: "پشتیبانی واقعی و همراهی پس از خرید" },
        ].map((c, i) => (
          <Reveal key={c.t} delay={i * 0.08}>
            <div className="glass h-full rounded-2xl p-6 text-center">
              <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-white/[0.04] text-accent">
                <c.icon className="h-6 w-6" strokeWidth={1.5} />
              </span>
              <h3 className="text-sm font-bold text-silver-50">{c.t}</h3>
              <p className="mt-2 text-xs leading-6 text-silver-400">{c.d}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-14">
        <div className="glass grid grid-cols-2 gap-6 rounded-3xl p-8 text-center sm:grid-cols-4">
          {[
            ["۱۲۰+", "محصول"],
            ["۵۰هزار+", "مشتری"],
            ["۹۸٪", "رضایت"],
            ["۲۴/۷", "پشتیبانی"],
          ].map(([v, l]) => (
            <div key={l}>
              <div className="num text-2xl font-black text-metal">{v}</div>
              <div className="mt-1 text-xs text-silver-500">{l}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-silver-600">
          اعداد نمایشی برای این دمو هستند.
        </p>
      </Reveal>
    </div>
  );
}
