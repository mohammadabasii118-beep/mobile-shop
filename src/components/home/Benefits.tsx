import { Truck, ShieldCheck, RefreshCw, Headset } from "lucide-react";
import Reveal from "@/components/ui/Reveal";

const items = [
  {
    icon: Truck,
    title: "ارسال سریع",
    desc: "تحویل اکسپرس در کمتر از ۲۴ ساعت در شهرهای بزرگ",
  },
  {
    icon: ShieldCheck,
    title: "ضمانت اصالت",
    desc: "تمام کالاها اصل و دارای گارانتی معتبر هستند",
  },
  {
    icon: RefreshCw,
    title: "۷ روز بازگشت",
    desc: "بازگشت آسان کالا بدون قید و شرط",
  },
  {
    icon: Headset,
    title: "پشتیبانی ۲۴/۷",
    desc: "همیشه و همه‌جا کنار شما هستیم",
  },
];

export default function Benefits() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {items.map((it, i) => (
          <Reveal key={it.title} delay={i * 0.06}>
            <div className="glass group flex h-full flex-col items-center gap-3 rounded-2xl p-6 text-center transition-all duration-500 hover:border-white/20">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-white/[0.04] text-accent transition-transform duration-500 group-hover:scale-110">
                <it.icon className="h-6 w-6" strokeWidth={1.5} />
              </span>
              <h3 className="text-sm font-bold text-silver-50">{it.title}</h3>
              <p className="text-xs leading-6 text-silver-400">{it.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
