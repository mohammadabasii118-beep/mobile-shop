"use client";

import { useState } from "react";
import { Search, Package, CheckCircle2, Truck, Home, Clock } from "lucide-react";
import { toFa } from "@/lib/format";

const STEPS = [
  { key: "placed", label: "ثبت سفارش", icon: CheckCircle2 },
  { key: "processing", label: "در حال پردازش", icon: Clock },
  { key: "shipped", label: "ارسال شد", icon: Truck },
  { key: "delivered", label: "تحویل شد", icon: Home },
];

// نمونه‌های نمایشی برای دمو
const DEMO: Record<string, { step: number; eta: string }> = {
  "LX-1024": { step: 2, eta: "۲ روز دیگر" },
  "LX-0987": { step: 3, eta: "تحویل شده" },
  "LX-0812": { step: 3, eta: "تحویل شده" },
};

export default function TrackPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{
    code: string;
    step: number;
    eta: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const key = code.trim().toUpperCase();
    const found = DEMO[key];
    if (found) {
      setResult({ code: key, ...found });
      setError(null);
    } else {
      setResult(null);
      setError("سفارشی با این کد پیدا نشد. (کدهای نمایشی: LX-1024، LX-0987)");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="mb-8 text-center">
        <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.04] text-accent">
          <Package className="h-7 w-7" strokeWidth={1.5} />
        </span>
        <h1 className="text-2xl font-black text-silver-50 sm:text-3xl">
          پیگیری سفارش
        </h1>
        <p className="mt-2 text-sm text-silver-400">
          کد رهگیری سفارش خود را وارد کنید.
        </p>
      </div>

      <form onSubmit={submit} className="glass rounded-2xl p-2 sm:flex sm:gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-500" />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="مثلاً LX-1024"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 pr-10 pl-3 text-sm text-silver-100 outline-none placeholder:text-silver-500 focus:border-white/25"
          />
        </div>
        <button type="submit" className="btn-luxe mt-2 w-full sm:mt-0 sm:w-auto">
          پیگیری
        </button>
      </form>

      {error && (
        <p className="mt-4 text-center text-sm text-rose-400">{error}</p>
      )}

      {result && (
        <div className="mt-8 animate-fade-up">
          <div className="glass rounded-2xl p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="num text-sm font-bold text-silver-50">
                  {result.code}
                </div>
                <div className="text-xs text-silver-500">وضعیت سفارش</div>
              </div>
              <span className="chip">
                <Clock className="h-3.5 w-3.5 text-accent" />
                {result.eta}
              </span>
            </div>

            {/* stepper */}
            <ol className="relative">
              {STEPS.map((s, i) => {
                const done = i <= result.step;
                const active = i === result.step;
                return (
                  <li key={s.key} className="flex gap-4 pb-6 last:pb-0">
                    <div className="relative flex flex-col items-center">
                      <span
                        className={`grid h-10 w-10 place-items-center rounded-full border transition ${
                          done
                            ? "border-accent bg-accent/15 text-accent"
                            : "border-white/10 text-silver-600"
                        } ${active ? "ring-2 ring-accent/30" : ""}`}
                      >
                        <s.icon className="h-5 w-5" />
                      </span>
                      {i < STEPS.length - 1 && (
                        <span
                          className={`mt-1 w-px flex-1 ${
                            i < result.step ? "bg-accent/50" : "bg-white/10"
                          }`}
                          style={{ minHeight: 28 }}
                        />
                      )}
                    </div>
                    <div className="pt-2">
                      <div
                        className={`text-sm font-semibold ${
                          done ? "text-silver-50" : "text-silver-500"
                        }`}
                      >
                        {s.label}
                      </div>
                      {active && (
                        <div className="mt-0.5 text-xs text-accent">
                          مرحلهٔ فعلی
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
          <p className="mt-3 text-center text-[11px] text-silver-600">
            داده‌های پیگیری در این دمو نمایشی هستند.
          </p>
        </div>
      )}
    </div>
  );
}
