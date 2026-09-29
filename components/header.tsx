import { Menu, Search, ShoppingBag, Smartphone, Headphones, PenLine, Store, User, MessageCircle } from "lucide-react";
import { Container } from "@/components/ui";
import { NightButton, ThemeToggle } from "@/components/theme";
import { categories } from "@/lib/data";

export function Logo() {
  return (
    <a href="/" className="flex items-center gap-1.5 text-2xl font-black tracking-tight text-primary" aria-label="CaseLine">
      <Smartphone className="size-6" strokeWidth={2.6} />
      <span dir="ltr">Case<span className="text-foreground">line</span></span>
    </a>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40">
      <div className="bg-primary/12 text-center text-[11px] leading-7 text-muted sm:text-xs">
        <span dir="ltr" className="font-bold text-primary">@Caseline_shop</span> در تلگرام | کد تخفیف خرید اول: <b className="text-foreground">CASE10</b>
      </div>
      <div className="glass border-x-0 border-t-0">
        <Container className="flex h-14 items-center gap-3 sm:h-16 lg:gap-8">
          <Logo />
          <nav className="hidden items-center gap-5 text-sm font-medium lg:flex" aria-label="دسته‌بندی‌ها">
            {categories.slice(0, 6).map((c) => <a key={c.slug} href={`#${c.slug}`} className="text-foreground/80 hover:text-primary">{c.label}</a>)}
            <a href="#phone-picker" className="font-bold text-primary">مدل گوشی</a>
            <a href="/wholesale" className="text-foreground/80 hover:text-primary">همکاری عمده</a>
          </nav>
          <div className="ms-auto flex items-center gap-1">
            <span className="hidden sm:block"><ThemeToggle /></span>
            <button className="grid size-10 cursor-pointer place-items-center rounded-full text-primary hover:bg-primary/10" aria-label="جستجو"><Search className="size-5" /></button>
            <button className="relative grid size-10 cursor-pointer place-items-center rounded-full text-primary hover:bg-primary/10" aria-label="سبد خرید">
              <ShoppingBag className="size-5" />
              <span className="absolute end-1 top-1 grid size-4 place-items-center rounded-full bg-hot text-[10px] font-bold text-white">۱</span>
            </button>
            <button className="grid size-10 cursor-pointer place-items-center rounded-full text-primary hover:bg-primary/10 lg:hidden" aria-label="منو"><Menu className="size-5" /></button>
          </div>
        </Container>
      </div>
    </header>
  );
}

/** Floating glass bar + chat bubble, like a mobile app. */
export function BottomNav() {
  const item = "flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-full py-2 text-[10px] font-medium text-muted";
  return (
    <>
      <a href="#" aria-label="گفتگوی آنلاین" className="fixed bottom-24 start-4 z-40 grid size-12 place-items-center rounded-full bg-accent text-white shadow-lg md:bottom-6"><MessageCircle className="size-6" /></a>
      <nav aria-label="منوی اصلی" className="glass fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md rounded-full px-2 shadow-lg md:hidden">
        <a href="#" className={item}><Headphones className="size-5" />پشتیبانی</a>
        <a href="#blog" className={item}><PenLine className="size-5" />بلاگ</a>
        <NightButton className={item} />
        <a href="#featured" className={item}><Store className="size-5" />فروشگاه</a>
        <a href="#" className={item}><User className="size-5" />داشبورد</a>
      </nav>
    </>
  );
}
