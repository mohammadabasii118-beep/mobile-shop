"use client";
import { useState } from "react";
import Link from "next/link";

// Real bug fix: before this component existed, the admin panel's mobile
// header (app/admin/(protected)/layout.tsx) rendered NO navigation at all —
// the full sidebar was `hidden md:flex`, so on a phone there was literally
// no way to reach any admin page except typing its URL directly. This is a
// hamburger drawer that surfaces the exact same nav items the desktop
// sidebar shows (same `visibleNav`/`unreadAlerts` computed server-side in
// the layout and passed down as props — no separate/duplicated permission
// logic to drift out of sync with it).
export default function AdminMobileNav({
  items,
  unreadAlerts,
}: {
  items: { href: string; label: string; icon: string }[];
  unreadAlerts: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="باز کردن منو"
        className="w-10 h-10 rounded-lg border line flex items-center justify-center shrink-0"
      >
        <span className="text-lg leading-none">☰</span>
      </button>

      <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}>
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        />
        <div
          className="absolute top-0 right-0 h-full w-[80%] max-w-xs surface p-4 overflow-y-auto transition-transform"
          style={{ transform: `translateX(${open ? "0" : "100%"})` }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="font-extrabold">منوی پنل مدیریت</span>
            <button onClick={() => setOpen(false)} className="w-9 h-9 rounded-full surface2 flex items-center justify-center">✕</button>
          </div>
          <nav className="flex flex-col gap-1">
            {items.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 h-11 rounded-lg text-sm hover:bg-[var(--surface-2)]"
              >
                <span>{n.icon}</span>{n.label}
                {n.href === "/admin/alerts" && unreadAlerts > 0 && (
                  <span className="mr-auto text-xs font-bold px-2 rounded-full text-white" style={{ background: "#a24e56" }}>{unreadAlerts}</span>
                )}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
