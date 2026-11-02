import Link from "next/link";
import { Instagram, Send, Phone, Mail } from "lucide-react";
import { categories } from "@/lib/products";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="relative mt-24 border-t border-white/[0.06] bg-ink-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-white/20 to-transparent" />
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <Logo className="h-9 w-9" />
              <span className="text-xl font-extrabold text-metal">لوکس‌سل</span>
            </Link>
            <p className="max-w-xs text-sm leading-7 text-silver-400">
              مرجع تخصصی لوازم جانبی موبایل با تجربه‌ای آینده‌نگر و طراحی لوکس.
              کیفیت را لمس کن.
            </p>
            <div className="flex gap-2">
              {[Instagram, Send, Phone].map((Icon, i) => (
                <span
                  key={i}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-silver-300 transition hover:border-white/25 hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                </span>
              ))}
            </div>
          </div>

          {/* categories */}
          <div>
            <h4 className="mb-4 text-sm font-bold text-silver-100">دسته‌بندی‌ها</h4>
            <ul className="grid grid-cols-2 gap-2 text-sm text-silver-400">
              {categories.slice(0, 8).map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/products?cat=${c.slug}`}
                    className="transition hover:text-white"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* links */}
          <div>
            <h4 className="mb-4 text-sm font-bold text-silver-100">دسترسی سریع</h4>
            <ul className="space-y-2 text-sm text-silver-400">
              {[
                { href: "/about", label: "درباره ما" },
                { href: "/contact", label: "تماس با ما" },
                { href: "/terms", label: "قوانین و مقررات" },
                { href: "/track", label: "پیگیری سفارش" },
                { href: "/cart", label: "سبد خرید" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* newsletter */}
          <div>
            <h4 className="mb-4 text-sm font-bold text-silver-100">خبرنامه</h4>
            <p className="mb-3 text-sm text-silver-400">
              از جدیدترین محصولات و تخفیف‌ها باخبر شو.
            </p>
            <form
              className="flex gap-2"
              action="#"
              aria-label="عضویت در خبرنامه (نمایشی)"
            >
              <input
                type="email"
                placeholder="ایمیل شما"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-silver-100 outline-none placeholder:text-silver-500 focus:border-white/25"
              />
              <button type="submit" className="btn-luxe px-4 py-2.5">
                <Mail className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-6 text-xs text-silver-500 sm:flex-row">
          <p>© ۱۴۰۴ لوکس‌سل — تمامی حقوق محفوظ است.</p>
          <p className="text-silver-600">
            این یک فروشگاه نمایشی (دمو) است؛ خرید و پرداخت واقعی انجام نمی‌شود.
          </p>
        </div>
      </div>
    </footer>
  );
}
