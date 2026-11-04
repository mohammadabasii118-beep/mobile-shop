import { Award, Boxes, Cpu, Wrench } from "lucide-react";
import { toFa } from "@/lib/utils";

const STATS = [
  { v: 20, s: "+", l: "سال تجربه در بازار قطعات" },
  { v: 12000, s: "+", l: "قطعه متنوع در انبار" },
  { v: 35000, s: "+", l: "مشتری راضی در سراسر کشور" },
  { v: 98, s: "٪", l: "رضایت از تطابق قطعه" },
];

const FEATURES = [
  { icon: Cpu, t: "استعلام با شماره شاسی (VIN)", d: "قطعه دقیق خودروی شما را با شماره شاسی و کاتالوگ رسمی EPC پیدا می‌کنیم؛ بدون حدس و خطا." },
  { icon: Award, t: "فقط قطعات اصلی و OEM", d: "تأمین مستقیم از نمایندگی‌های امارات و ژاپن و برندهای OEM مانند Aisin، KYB، NGK و Denso." },
  { icon: Boxes, t: "انبار تخصصی نیسان و هوندا", d: "تمرکز روی دو برند یعنی موجودی عمیق‌تر، قیمت بهتر و تحویل سریع‌تر برای شما." },
  { icon: Wrench, t: "پشتیبانی فنی برای تعمیرکاران", d: "همکاران و تعمیرگاه‌ها از قیمت عمده و مشاوره فنی اختصاصی بهره‌مند می‌شوند." },
];

export function Expertise() {
  return (
    <section className="carbon cv-auto relative overflow-hidden py-20 text-white" aria-labelledby="expertise-title">
      <div className="bg-grid absolute inset-0 opacity-60 [mask-image:linear-gradient(to_left,black,transparent)]" />
      <div className="pointer-events-none absolute hidden sm:block top-0 right-1/3 size-96 rounded-full bg-primary/20 blur-[120px]" />
      <div className="container-x relative grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold text-[#ff5a4f]"><span className="h-[3px] w-6 rounded-full bg-primary" />چرا فروشگاه حمیدی؟</p>
          <h2 id="expertise-title" className="mt-3 text-3xl leading-tight font-black sm:text-4xl">
            متخصص <span className="text-[#ff5a4f]">نیسان</span> و <span className="text-[#ff5a4f]">هوندا</span>،
            <br />نه یک فروشگاه همه‌چیز فروش
          </h2>
          <p className="mt-5 max-w-lg leading-8 text-neutral-300">
            فروشگاه حمیدی از سال ۱۳۸۴ در بازار امین‌السلطان تهران، فقط و فقط روی قطعات خودروهای نیسان و هوندا تمرکز کرده است. همین تخصص باعث شده تعمیرکاران و مالکان این خودروها در سراسر ایران به ما اعتماد کنند.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4">
            {STATS.map((s) => (
              <div key={s.l} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-3xl font-black">{toFa(s.v.toLocaleString("en-US").replace(/,/g, "٬"))}<span className="text-primary">{s.s}</span></p>
                <p className="mt-1 text-xs text-neutral-300">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f, i) => (
            <div key={f.t} className={`group rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-6 transition hover:border-primary/50 ${i % 2 ? "sm:translate-y-8" : ""}`}>
              <span className="grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary transition group-hover:bg-primary group-hover:text-white"><f.icon className="size-6" /></span>
              <h3 className="mt-5 font-extrabold">{f.t}</h3>
              <p className="mt-2 text-sm leading-7 text-neutral-300">{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
