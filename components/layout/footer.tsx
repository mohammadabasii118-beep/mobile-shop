import { Logo } from "./logo";

const cols = [
  { title: "فروشگاه", links: ["قاب موبایل", "شارژر و کابل", "هدفون و ایربادز", "پاوربانک", "محافظ صفحه"] },
  { title: "پشتیبانی", links: ["پیگیری سفارش", "راهنمای سایز و مدل", "گارانتی و مرجوعی", "تماس با ما"] },
  { title: "ولتا", links: ["دربارهٔ ما", "برندها", "وبلاگ", "همکاری با ما"] },
];

export function Footer() {
  return (
    <footer className="surface-dark bg-bg pb-24 pt-16 text-fg md:pb-12">
      <div className="container-x grid gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="t-small mt-4 max-w-xs text-muted">لوازم جانبی موبایل با ظاهر و کیفیتی که از خود گوشی کم ندارد.</p>
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h3 className="t-caption mb-4 font-semibold text-muted">{c.title}</h3>
            <ul className="space-y-1">
              {c.links.map((l) => (
                <li key={l}><a href="#top" className="inline-flex min-h-9 items-center text-sm hover:text-accent">{l}</a></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="container-x mt-12 border-t border-line pt-6">
        <p className="t-caption text-muted">نسخهٔ Demo — دادهٔ نمایشی. © ولتا</p>
      </div>
    </footer>
  );
}
