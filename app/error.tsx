"use client";
import { useEffect } from "react";
import Link from "next/link";

/** Shown when a page throws while rendering. The message is generic on purpose; details go to the server log only. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[page-error]", error.digest ?? "", error.message); }, [error]);
  return (
    <main id="main" tabIndex={-1} className="grid min-h-[60vh] place-items-center px-4 py-16 text-center">
      <div role="alert">
        <h1 className="text-xl font-black">مشکلی پیش آمد</h1>
        <p className="mt-2 text-sm text-muted">خطایی در نمایش این صفحه رخ داد. لطفاً دوباره تلاش کنید.{error.digest ? ` (کد پیگیری: ${error.digest})` : ""}</p>
        <div className="mt-5 flex justify-center gap-3 text-sm font-bold">
          <button onClick={reset} className="cursor-pointer rounded-xl bg-primary px-5 py-3 text-primary-fg">تلاش دوباره</button>
          <Link href="/" className="rounded-xl bg-surface-2 px-5 py-3">صفحه اصلی</Link>
        </div>
      </div>
    </main>
  );
}
