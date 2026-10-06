"use client";
import { useEffect } from "react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[admin-error]", error.digest ?? "", error.message); }, [error]);
  return (
    <div role="alert" className="mx-auto max-w-md rounded-xl border border-error/30 bg-error/10 p-6 text-center">
      <h1 className="text-lg font-black text-error">خطا در بارگذاری این بخش</h1>
      <p className="mt-2 text-sm">{error.digest ? `کد پیگیری: ${error.digest}` : "دوباره تلاش کنید."}</p>
      <button onClick={reset} className="mt-4 h-10 cursor-pointer rounded-md bg-primary px-5 text-sm font-bold text-primary-fg">تلاش دوباره</button>
    </div>
  );
}
