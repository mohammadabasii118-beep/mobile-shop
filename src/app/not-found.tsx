import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative mx-auto grid min-h-[70vh] max-w-2xl place-items-center px-4 text-center">
      <div className="pointer-events-none absolute -top-10 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent-glow/10 blur-[120px]" />
      <div className="relative">
        <div className="num bg-metal bg-clip-text text-8xl font-black text-transparent sm:text-9xl">
          ۴۰۴
        </div>
        <h1 className="mt-4 text-xl font-bold text-silver-50">
          صفحه‌ای که دنبالش بودید پیدا نشد
        </h1>
        <p className="mt-2 text-sm text-silver-400">
          ممکن است آدرس اشتباه باشد یا صفحه حذف شده باشد.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="btn-luxe">
            <Home className="h-4 w-4" />
            بازگشت به خانه
          </Link>
          <Link href="/products" className="btn-ghost">
            <Search className="h-4 w-4" />
            جستجوی محصولات
          </Link>
        </div>
      </div>
    </div>
  );
}
