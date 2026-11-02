import { Phone, Mail, MapPin, Clock } from "lucide-react";
import Reveal from "@/components/ui/Reveal";

export const metadata = { title: "تماس با ما" };

const field =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-silver-100 outline-none placeholder:text-silver-500 focus:border-white/25";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <Reveal className="mb-10 text-center">
        <h1 className="text-3xl font-black text-silver-50 sm:text-4xl">
          تماس با ما
        </h1>
        <p className="mt-3 text-silver-400">
          سؤالی دارید؟ تیم ما آماده‌ی پاسخ‌گویی است.
        </p>
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        {/* info */}
        <Reveal className="space-y-3">
          {[
            { icon: Phone, t: "تلفن", v: "۰۲۱-۱۲۳۴۵۶۷۸" },
            { icon: Mail, t: "ایمیل", v: "support@luxesell.demo" },
            { icon: MapPin, t: "نشانی", v: "تهران، خیابان نمونه (نمایشی)" },
            { icon: Clock, t: "ساعات پاسخ‌گویی", v: "همه‌روزه ۹ تا ۲۱" },
          ].map((c) => (
            <div key={c.t} className="glass flex items-center gap-4 rounded-2xl p-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-accent">
                <c.icon className="h-5 w-5" strokeWidth={1.5} />
              </span>
              <div>
                <div className="text-xs text-silver-500">{c.t}</div>
                <div className="num mt-0.5 text-sm text-silver-100">{c.v}</div>
              </div>
            </div>
          ))}
        </Reveal>

        {/* form */}
        <Reveal delay={0.1}>
          <form
            action="#"
            className="glass space-y-3 rounded-3xl p-6"
            aria-label="فرم تماس (نمایشی)"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <input required placeholder="نام شما" className={field} />
              <input required placeholder="ایمیل یا موبایل" className={field} />
            </div>
            <input placeholder="موضوع" className={field} />
            <textarea
              required
              rows={5}
              placeholder="پیام شما…"
              className={`${field} resize-none`}
            />
            <button type="submit" className="btn-luxe w-full">
              ارسال پیام
            </button>
            <p className="text-center text-[11px] text-silver-600">
              این فرم نمایشی است و پیامی ارسال نمی‌شود.
            </p>
          </form>
        </Reveal>
      </div>
    </div>
  );
}
