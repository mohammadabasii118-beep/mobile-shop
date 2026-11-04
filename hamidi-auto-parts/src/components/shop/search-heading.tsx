"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

const EXAMPLES = ["لنت", "مورانو", "15400-PLM-A02", "HAP-NS-3041", "واترپمپ آکورد", "سنسور"];

export function SearchHeading() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const q = sp.get("q") ?? "";
  const [text, setText] = useState(q);
  const [prev, setPrev] = useState(q);
  if (prev !== q) { setPrev(q); setText(q); }

  function go(value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value.trim()) next.set("q", value.trim()); else next.delete("q");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="mt-8 max-w-3xl">
      <form onSubmit={(e) => { e.preventDefault(); go(text); }} className="relative">
        <Search className="pointer-events-none absolute top-1/2 right-5 size-5 -translate-y-1/2 text-neutral-400" />
        <input value={text} onChange={(e) => setText(e.target.value)} autoFocus placeholder="مثلاً: کمک‌فنر ایکس‌تریل یا 40206-JA00A" className="h-16 w-full rounded-2xl border border-white/10 bg-white pr-14 pl-32 text-base text-neutral-950 shadow-2xl outline-none focus:ring-4 focus:ring-primary/30" />
        <button className="absolute top-2 bottom-2 left-2 cursor-pointer rounded-xl bg-primary px-6 text-sm font-bold text-white transition hover:bg-red-700">جستجو</button>
      </form>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
        <span>نمونه‌ها:</span>
        {EXAMPLES.map((e) => (
          <button key={e} onClick={() => { setText(e); go(e); }} className="cursor-pointer rounded-full bg-white/10 px-3 py-1 text-neutral-200 transition hover:bg-primary hover:text-white">{e}</button>
        ))}
      </div>
      {q && <p className="mt-4 text-sm text-neutral-300">نتایج جستجو برای «<b className="text-white">{q}</b>»</p>}
    </div>
  );
}
