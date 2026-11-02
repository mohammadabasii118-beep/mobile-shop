"use client";

import Link from "next/link";
import { useState } from "react";
import {
  User,
  Package,
  Heart,
  MapPin,
  LogOut,
  Truck,
} from "lucide-react";
import { toFa, formatPrice } from "@/lib/format";

type Tab = "profile" | "orders" | "wishlist" | "addresses";

// Demo data
const demoOrders = [
  { id: "LX-۱۰۲۴", date: "۱۴۰۴/۰۸/۱۰", status: "در حال ارسال", total: 4_780_000 },
  { id: "LX-۰۹۸۷", date: "۱۴۰۴/۰۷/۲۲", status: "تحویل شده", total: 1_290_000 },
  { id: "LX-۰۸۱۲", date: "۱۴۰۴/۰۶/۰۳", status: "تحویل شده", total: 3_490_000 },
];

export default function AccountPage() {
  const [tab, setTab] = useState<Tab>("profile");

  const tabs: { key: Tab; label: string; icon: typeof User }[] = [
    { key: "profile", label: "پروفایل", icon: User },
    { key: "orders", label: "سفارش‌ها", icon: Package },
    { key: "wishlist", label: "علاقه‌مندی‌ها", icon: Heart },
    { key: "addresses", label: "آدرس‌ها", icon: MapPin },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-black text-silver-50 sm:text-3xl">
        حساب کاربری
      </h1>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* sidebar */}
        <aside className="h-fit">
          <div className="glass rounded-2xl p-4">
            <div className="mb-4 flex items-center gap-3 border-b border-white/[0.06] pb-4">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-metal text-lg font-black text-ink-900">
                ک
              </span>
              <div>
                <div className="text-sm font-bold text-silver-50">کاربر مهمان</div>
                <div className="num text-xs text-silver-500">۰۹۱۲••••۷۸</div>
              </div>
            </div>
            <nav className="space-y-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm transition ${
                    tab === t.key
                      ? "bg-white/10 text-white"
                      : "text-silver-300 hover:bg-white/5"
                  }`}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </button>
              ))}
              <Link
                href="/login"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm text-silver-400 transition hover:bg-white/5 hover:text-rose-400"
              >
                <LogOut className="h-4 w-4" />
                خروج
              </Link>
            </nav>
          </div>
        </aside>

        {/* content */}
        <div className="glass min-h-[340px] rounded-2xl p-6">
          {tab === "profile" && (
            <div>
              <h2 className="mb-4 text-lg font-bold text-silver-50">
                اطلاعات پروفایل
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["نام و نام خانوادگی", "کاربر مهمان"],
                  ["شماره موبایل", "۰۹۱۲۰۰۰۰۰۷۸"],
                  ["ایمیل", "guest@example.com"],
                  ["تاریخ عضویت", "۱۴۰۴/۰۵/۰۱"],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-xl border border-white/[0.07] p-4">
                    <div className="text-xs text-silver-500">{l}</div>
                    <div className="num mt-1 text-sm text-silver-100">{v}</div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-silver-600">
                داده‌های این بخش نمایشی هستند.
              </p>
            </div>
          )}

          {tab === "orders" && (
            <div>
              <h2 className="mb-4 text-lg font-bold text-silver-50">
                تاریخچه سفارش‌ها
              </h2>
              <div className="space-y-3">
                {demoOrders.map((o) => (
                  <div
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] p-4"
                  >
                    <div>
                      <div className="num text-sm font-bold text-silver-50">
                        {o.id}
                      </div>
                      <div className="num text-xs text-silver-500">{o.date}</div>
                    </div>
                    <span
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
                        o.status === "تحویل شده"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-amber-500/15 text-amber-300"
                      }`}
                    >
                      <Truck className="h-3.5 w-3.5" />
                      {o.status}
                    </span>
                    <span className="num text-sm font-bold text-metal">
                      {formatPrice(o.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "wishlist" && (
            <div className="grid min-h-[260px] place-items-center text-center">
              <div>
                <Heart className="mx-auto mb-3 h-12 w-12 text-silver-600" />
                <p className="text-silver-300">لیست علاقه‌مندی‌ها خالی است.</p>
                <Link href="/products" className="btn-ghost mt-4">
                  مشاهده محصولات
                </Link>
              </div>
            </div>
          )}

          {tab === "addresses" && (
            <div>
              <h2 className="mb-4 text-lg font-bold text-silver-50">
                آدرس‌های من
              </h2>
              <div className="rounded-xl border border-white/[0.07] p-4">
                <div className="text-sm font-bold text-silver-100">خانه</div>
                <p className="mt-1 text-sm leading-7 text-silver-400">
                  تهران، خیابان نمونه، کوچه‌ی دمو، پلاک ۱۲ — کد پستی ۱۲۳۴۵۶۷۸۹۰
                </p>
              </div>
              <p className="mt-4 text-xs text-silver-600">
                آدرس نمایشی برای این دمو.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
