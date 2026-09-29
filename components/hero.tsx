"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Container } from "@/components/ui";

const heroWords = ["قاب", "گلس", "شارژر", "هندزفری", "پاوربانک"];

export function Hero({ chips }: { chips: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % heroWords.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="py-8 text-center sm:py-14">
      <Container className="max-w-3xl">
        <h1 className="text-3xl font-black leading-[1.5] sm:text-5xl sm:leading-[1.5]">
          <span className="text-primary" data-hero-word>{heroWords[i]}</span> اورجینال
          <br />سریع و مطمئن، با ضمانت بازگشت
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-8 text-muted sm:text-base">لوازم جانبی محبوب موبایل، قاب، گلس و شارژر، همه در یک‌جا.</p>
        <form role="search" data-search-form className="group relative mx-auto mt-7 flex h-16 max-w-[660px] items-center gap-3 rounded-full border border-white bg-surface px-6 shadow-[0_12px_32px_-14px_rgba(40,140,210,0.4)] transition-shadow focus-within:border-primary/30 focus-within:shadow-[0_0_0_5px_color-mix(in_srgb,var(--primary)_20%,transparent),0_12px_32px_-14px_rgba(40,140,210,0.4)] dark:border-border" onSubmit={(e) => e.preventDefault()}>
          <Search className="size-[18px] shrink-0 text-muted" aria-hidden />
          <input id="hero-search" type="search" aria-label="جستجو" placeholder="نام محصول یا مدل گوشی…" className="h-full min-w-0 flex-1 bg-transparent text-start text-[15px] outline-none placeholder:text-muted/70" />
        </form>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 text-[13px]">
          <span className="text-[12px] text-muted">پرجستجو:</span>
          {chips.map((c) => <Link key={c} href="/shop" className="inline-flex h-[34px] cursor-pointer items-center rounded-full border border-border bg-surface px-4 font-medium text-foreground transition-all duration-200 hover:border-primary hover:text-primary hover:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_16%,transparent)]">{c}</Link>)}
        </div>
      </Container>
    </section>
  );
}
