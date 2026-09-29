"use client";
import Link from "next/link";

export default function MobileMenu({
  open, onClose, categories, loggedIn, onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  categories: { slug: string; name: string }[];
  loggedIn: boolean;
  onSignOut: () => void;
}) {
  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} />
      <div
        className="absolute top-0 right-0 h-full w-[78%] max-w-xs surface p-5 overflow-y-auto transition-transform"
        style={{ transform: `translateX(${open ? "0" : "100%"})` }}
      >
        <div className="flex items-center justify-between mb-6">
          <span className="font-extrabold text-lg">منو</span>
          <button onClick={onClose} className="w-9 h-9 rounded-full surface2 flex items-center justify-center">✕</button>
        </div>
        <div className="flex flex-col gap-1 mb-4">
          {categories.map((c) => (
            <Link key={c.slug} href={`/category/${c.slug}`} onClick={onClose} className="py-3 border-b line text-right">{c.name}</Link>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <Link href="/about" onClick={onClose} className="py-3 border-b line text-right">درباره ما</Link>
          <Link href="/contact" onClick={onClose} className="py-3 border-b line text-right">تماس با ما</Link>
          <Link href="/order/track" onClick={onClose} className="py-3 border-b line text-right">پیگیری سفارش</Link>
          {loggedIn ? (
            <>
              <Link href="/account" onClick={onClose} className="py-3 border-b line text-right">حساب کاربری</Link>
              <button onClick={() => { onClose(); onSignOut(); }} className="py-3 text-right muted">خروج از حساب</button>
            </>
          ) : (
            <Link href="/login" onClick={onClose} className="py-3 border-b line text-right">ورود / ثبت‌نام</Link>
          )}
        </div>
      </div>
    </div>
  );
}
