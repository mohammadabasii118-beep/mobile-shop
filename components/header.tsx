import { Heart, Menu, Search, ShoppingBag, User, Smartphone } from "lucide-react";
import { Container } from "@/components/ui";
import { ThemeToggle } from "@/components/theme";
import { categories } from "@/lib/data";

export function Logo() {
  return (
    <a href="/" className="flex items-center gap-2 text-xl font-black tracking-tight" aria-label="CaseLine">
      <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-fg"><Smartphone className="size-5" /></span>
      <span dir="ltr">Case<span className="text-primary">Line</span></span>
    </a>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="hidden bg-secondary text-secondary-fg sm:block">
        <Container className="flex h-8 items-center justify-between text-xs">
          <span>ارسال رایگان برای سفارش‌های بالای ۲ میلیون تومان</span>
          <span>پشتیبانی: ۰۲۱-۱۲۳۴۵۶۷۸</span>
        </Container>
      </div>
      <Container className="flex h-16 items-center gap-3 lg:gap-6">
        <button className="grid size-10 place-items-center rounded-md hover:bg-surface-2 lg:hidden" aria-label="منو"><Menu className="size-6" /></button>
        <Logo />
        <form role="search" className="relative mx-auto hidden max-w-xl flex-1 md:block">
          <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input type="search" placeholder="جستجو در محصولات، برندها و مدل گوشی…" className="h-11 w-full rounded-full border border-border bg-surface ps-12 pe-4 text-sm outline-none focus:border-primary" />
        </form>
        <div className="ms-auto flex items-center gap-1 md:ms-0">
          <span className="hidden sm:block"><ThemeToggle /></span>
          <button className="grid size-10 place-items-center rounded-md hover:bg-surface-2 md:hidden" aria-label="جستجو"><Search className="size-5" /></button>
          <button className="hidden size-10 place-items-center rounded-md hover:bg-surface-2 sm:grid" aria-label="علاقه‌مندی‌ها"><Heart className="size-5" /></button>
          <button className="grid size-10 place-items-center rounded-md hover:bg-surface-2" aria-label="حساب کاربری"><User className="size-5" /></button>
          <button className="relative grid size-10 place-items-center rounded-md hover:bg-surface-2" aria-label="سبد خرید">
            <ShoppingBag className="size-5" />
            <span className="absolute end-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-fg">۲</span>
          </button>
        </div>
      </Container>
      <nav className="hidden border-t border-border lg:block" aria-label="دسته‌بندی‌ها">
        <Container className="flex h-11 items-center gap-6 text-sm font-medium">
          <a href="#phone-picker" className="flex items-center gap-1.5 font-bold text-primary"><Smartphone className="size-4" />انتخاب بر اساس مدل گوشی</a>
          {categories.slice(0, 7).map((c) => <a key={c.slug} href={`#${c.slug}`} className="text-foreground/80 hover:text-primary">{c.label}</a>)}
          <a href="#brands" className="text-foreground/80 hover:text-primary">برندها</a>
          <a href="/wholesale" className="ms-auto text-foreground/80 hover:text-primary">همکاری عمده</a>
        </Container>
      </nav>
    </header>
  );
}
