"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/layout/Logo";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const field =
    "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-silver-100 outline-none placeholder:text-silver-500 focus:border-white/25";

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-4 py-12">
      <div className="glass w-full rounded-3xl p-8 shadow-luxe">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo className="mb-3 h-12 w-12" />
          <h1 className="text-xl font-black text-silver-50">
            {mode === "login" ? "ورود به حساب" : "ایجاد حساب جدید"}
          </h1>
          <p className="mt-1 text-xs text-silver-500">
            به تجربه‌ی خرید لوکس خوش آمدید
          </p>
        </div>

        {/* tabs */}
        <div className="mb-6 flex rounded-xl border border-white/10 p-1">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                mode === m
                  ? "bg-white/10 text-white"
                  : "text-silver-400 hover:text-silver-200"
              }`}
            >
              {m === "login" ? "ورود" : "ثبت‌نام"}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => e.preventDefault()}
          className="space-y-3"
          aria-label="فرم احراز هویت (نمایشی)"
        >
          {mode === "register" && (
            <input placeholder="نام و نام خانوادگی" className={field} />
          )}
          <input placeholder="شماره موبایل یا ایمیل" className={field} />
          <input type="password" placeholder="رمز عبور" className={field} />
          {mode === "register" && (
            <input type="password" placeholder="تکرار رمز عبور" className={field} />
          )}
          <button type="submit" className="btn-luxe w-full">
            {mode === "login" ? "ورود" : "ثبت‌نام"}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-silver-600">
          احراز هویت در این دمو غیرفعال است و اطلاعاتی ذخیره نمی‌شود.
        </p>

        <Link
          href="/"
          className="mt-6 flex items-center justify-center gap-1 text-sm text-silver-400 hover:text-white"
        >
          بازگشت به خانه
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
