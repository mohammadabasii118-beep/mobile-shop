"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { useCart } from "./CartContext";
import { useCompare } from "./CompareContext";
import CartDrawer from "./CartDrawer";
import MobileMenu from "./MobileMenu";
import Icon from "./Icon";
import ThemeToggle from "./ThemeToggle";

const CATS = [
  { slug: "case", name: "قاب و کاور" },
  { slug: "airpods", name: "کاور ایرپاد" },
  { slug: "cable", name: "شارژ و کابل" },
  { slug: "protector", name: "محافظ‌ها" },
  { slug: "holder", name: "هولدر و پایه" },
  { slug: "watch", name: "لوازم ساعت" },
  { slug: "accessory", name: "اکسسوری" },
];

export default function Header() {
  const { count, setCartOpen } = useCart();
  const { ids: compareIds } = useCompare();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const router = useRouter();

  function onSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <>
      <header className="sticky top-0 z-40 surface border-b line">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: "var(--ink)" }}>CL</span>
              <span className="font-extrabold text-lg hidden sm:block">کیس لاین</span>
            </Link>
            <form onSubmit={onSearch} className="hidden md:flex flex-1 max-w-xl">
              <div className="flex items-center w-full surface2 rounded-full px-4 h-11 border line">
                <input name="q" placeholder="جستجوی محصول، مثلاً «قاب آیفون»" className="bg-transparent flex-1 outline-none text-sm placeholder:muted" />
                <button className="text-lg"><Icon name="search" className="w-5 h-5 muted" /></button>
              </div>
            </form>
            <div className="flex items-center gap-1 md:gap-2">
              <button onClick={() => setMobileSearch((v) => !v)} className="md:hidden w-10 h-10 rounded-full flex items-center justify-center"><Icon name="search" className="w-5 h-5" /></button>
              <ThemeToggle />
              <Link href="/compare" className="relative w-10 h-10 rounded-full flex items-center justify-center" aria-label="مقایسه محصولات">
                <Icon name="compare" className="w-5 h-5" />
                {compareIds.length > 0 && (
                  <span className="absolute -top-1 -left-1 text-[10px] w-5 h-5 rounded-full flex items-center justify-center text-white font-bold" style={{ background: "var(--ink)" }}>
                    {compareIds.length.toLocaleString("fa-IR")}
                  </span>
                )}
              </Link>
              <Link href={session ? "/account" : "/login"} className="w-10 h-10 rounded-full flex items-center justify-center" aria-label="حساب کاربری"><Icon name="user" className="w-5 h-5" /></Link>
              <button onClick={() => setCartOpen(true)} className="relative w-10 h-10 rounded-full flex items-center justify-center" aria-label="سبد خرید">
                <Icon name="bag" className="w-5 h-5" />
                {count > 0 && (
                  <span className="absolute -top-1 -left-1 text-[10px] w-5 h-5 rounded-full flex items-center justify-center text-white font-bold" style={{ background: "var(--ink)" }}>
                    {count.toLocaleString("fa-IR")}
                  </span>
                )}
              </button>
              <button onClick={() => setMenuOpen(true)} className="md:hidden w-10 h-10 rounded-full flex items-center justify-center"><Icon name="menu" className="w-5 h-5" /></button>
            </div>
          </div>
          {mobileSearch && (
            <form onSubmit={onSearch} className="md:hidden pb-3">
              <div className="flex items-center surface2 rounded-full px-4 h-11 border line">
                <input name="q" placeholder="جستجوی محصول…" className="bg-transparent flex-1 outline-none text-sm placeholder:muted" />
                <button className="text-lg"><Icon name="search" className="w-5 h-5 muted" /></button>
              </div>
            </form>
          )}
          <nav className="hidden md:flex items-center gap-6 h-12 border-t line text-sm">
            {CATS.map((c) => (
              <Link key={c.slug} href={`/category/${c.slug}`} className="hover:opacity-70 transition">{c.name}</Link>
            ))}
          </nav>
        </div>
      </header>
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} categories={CATS} loggedIn={!!session} onSignOut={() => signOut()} />
      <CartDrawer />
    </>
  );
}
