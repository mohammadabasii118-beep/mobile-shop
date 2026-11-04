"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BRANDS } from "@/data/vehicles";
import { cn } from "@/lib/utils";

const TOPICS = ["استعلام قیمت قطعه", "پیگیری سفارش", "همکاری تعمیرگاه‌ها", "سایر موارد"];

export function ContactForm() {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [brand, setBrand] = useState("nissan");
  const [sending, setSending] = useState(false);
  return (
    <form
      aria-label="فرم تماس و استعلام قطعه"
      onSubmit={(e) => {
        e.preventDefault();
        setSending(true);
        const form = e.currentTarget;
        setTimeout(() => {
          setSending(false);
          form.reset();
          toast({ title: "پیام شما با موفقیت ارسال شد", description: "کارشناسان ما به‌زودی با شما تماس می‌گیرند. (نمایشی)" });
        }, 900);
      }}
      className="space-y-5"
    >
      <div>
        <p id="topic-label" className="mb-2 text-sm font-semibold">موضوع پیام</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="topic-label">
          {TOPICS.map((t) => (
            <button type="button" key={t} role="radio" aria-checked={topic === t} onClick={() => setTopic(t)} className={cn("cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold transition", topic === t ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 hover:border-neutral-400")}>{t}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold">نام و نام خانوادگی<Input required autoComplete="name" placeholder="مثلاً علی رضایی" /></label>
        <label className="space-y-2 text-sm font-semibold">شماره تماس<Input required inputMode="tel" autoComplete="tel" dir="ltr" placeholder="09120000000" /></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <div className="space-y-2 text-sm font-semibold">
          برند خودرو
          <div className="flex gap-2">
            {BRANDS.map((b) => (
              <button type="button" key={b.id} aria-pressed={brand === b.id} onClick={() => setBrand(b.id)} className={cn("h-11 cursor-pointer rounded-xl border px-5 text-sm transition", brand === b.id ? "border-primary bg-red-50 text-primary" : "border-neutral-200")}>{b.nameFa}</button>
            ))}
          </div>
        </div>
        <label className="space-y-2 text-sm font-semibold">مدل، سال و شماره شاسی (اختیاری)<Input placeholder="مثلاً تیانا ۲۰۱۲ — VIN" /></label>
      </div>
      <label className="block space-y-2 text-sm font-semibold">
        متن پیام
        <textarea required rows={5} placeholder="نام یا کد قطعه مورد نیاز را بنویسید…" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-normal outline-none focus:border-neutral-950 focus:ring-[3px] focus:ring-neutral-950/10" />
      </label>
      <Button size="lg" disabled={sending} className="w-full sm:w-auto">
        <Send />{sending ? "در حال ارسال…" : "ارسال پیام"}
      </Button>
    </form>
  );
}
