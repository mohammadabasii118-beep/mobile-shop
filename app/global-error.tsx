"use client";

/** Last-resort boundary (root layout failed). Kept dependency-free. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fa" dir="rtl">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", minHeight: "100vh", placeItems: "center", textAlign: "center" }}>
        <div role="alert"><h1>مشکلی پیش آمد</h1><p>لطفاً چند لحظه بعد دوباره تلاش کنید.</p><button onClick={reset}>تلاش دوباره</button></div>
      </body>
    </html>
  );
}
