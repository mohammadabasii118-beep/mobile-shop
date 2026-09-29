import { Container } from "@/components/ui";
import { Logo } from "@/components/header";

const cols = [
  { t: "فروشگاه", l: ["قاب و کاور", "گلس", "شارژر و کابل", "هندزفری", "پاوربانک"] },
  { t: "خدمات مشتریان", l: ["پیگیری سفارش", "شرایط بازگشت", "سوالات متداول", "تماس با ما"] },
  { t: "CaseLine", l: ["درباره ما", "مجله", "همکاری عمده", "قوانین و مقررات"] },
];

export function Footer() {
  return (
    <footer className="mt-12 border-t border-border bg-surface">
      <Container className="grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-7 text-muted">CaseLine؛ فروشگاه تخصصی لوازم جانبی موبایل با تمرکز بر سازگاری دقیق با مدل گوشی شما.</p>
        </div>
        {cols.map((c) => (
          <div key={c.t}>
            <h4 className="mb-3 text-sm font-extrabold">{c.t}</h4>
            <ul className="space-y-2 text-sm text-muted">{c.l.map((x) => <li key={x}><a href="#" className="hover:text-primary">{x}</a></li>)}</ul>
          </div>
        ))}
      </Container>
      <div className="border-t border-border py-4 text-center text-xs text-muted">© ۱۴۰۵ CaseLine — نسخه دمو طراحی</div>
    </footer>
  );
}
