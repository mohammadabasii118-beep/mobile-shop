"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container-x flex flex-col items-center py-24 text-center">
      <h1 className="text-2xl font-black">خطایی رخ داد</h1>
      <p className="mt-2 text-neutral-600">لطفاً دوباره تلاش کنید یا به صفحه اصلی بازگردید.</p>
      <div className="mt-6 flex gap-2">
        <button type="button" onClick={reset} className="cursor-pointer rounded-xl bg-primary px-5 py-2.5 font-semibold text-white">تلاش دوباره</button>
        <Link href="/" className="rounded-xl border border-neutral-300 px-5 py-2.5 font-semibold">صفحه اصلی</Link>
      </div>
    </div>
  );
}
