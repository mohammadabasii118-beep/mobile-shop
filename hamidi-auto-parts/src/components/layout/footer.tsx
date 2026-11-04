import Link from "next/link";
import { Mail, MapPin, Phone, Send, Clock } from "lucide-react";
import { Logo } from "./logo";
import { CATEGORIES } from "@/data/categories";
import { BRANDS, modelsOf } from "@/data/vehicles";
import { SHOP, toFa, whatsappLink } from "@/lib/utils";
import { WhatsAppIcon } from "./whatsapp-icon";

export function Footer() {
  return (
    <footer className="carbon cv-auto relative mt-20 overflow-hidden text-neutral-300">
      <div className="pointer-events-none absolute hidden sm:block -top-40 left-1/2 h-80 w-[60rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      <div className="container-x relative">
        <div className="grid gap-6 border-b border-white/10 py-10 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <p className="text-xl font-extrabold text-white sm:text-2xl">قطعه‌ات را پیدا نکردی؟ <span className="text-[#ff5a4f]">کد فنی را بفرست.</span></p>
            <p className="mt-2 text-sm">عکس قطعه یا شماره شاسی را در واتساپ ارسال کنید؛ کارشناسان ما در کمتر از ۳۰ دقیقه پاسخ می‌دهند.</p>
          </div>
          <div className="flex flex-wrap gap-3 md:justify-end">
            <a href={whatsappLink("سلام، استعلام قطعه دارم.")} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center gap-2 rounded-2xl bg-[#25D366] px-5 text-sm font-bold text-white transition hover:brightness-110"><WhatsAppIcon className="size-5" />ارسال در واتساپ</a>
            <a href={`tel:${SHOP.phone}`} className="flex h-12 items-center gap-2 rounded-2xl border border-white/15 px-5 text-sm font-bold text-white transition hover:bg-white/10"><Phone className="size-4" /><span className="ltr-nums">{toFa(SHOP.phone)}</span></a>
          </div>
        </div>

        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div className="space-y-5">
            <Logo dark />
            <p className="text-sm leading-7">{SHOP.nameFa}، {SHOP.slogan}. بیش از ۲۰ سال تجربه در تأمین قطعات اصلی و OEM خودروهای ژاپنی، با ضمانت اصالت و ارسال به سراسر کشور.</p>
            <ul className="space-y-3 text-sm">
              <li className="flex gap-2.5"><MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /><address className="not-italic">{SHOP.address}</address></li>
              <li className="flex gap-2.5"><Clock className="size-4 shrink-0 text-primary" />{SHOP.hours}</li>
              <li className="flex gap-2.5"><Mail className="size-4 shrink-0 text-primary" /><span dir="ltr">{SHOP.email}</span></li>
            </ul>
          </div>
          <FooterCol title="دسته‌بندی‌های پرطرفدار" links={CATEGORIES.slice(0, 10).map((c) => ({ href: `/categories/${c.id}`, label: c.nameFa }))} />
          {BRANDS.map((b) => (
            <FooterCol key={b.id} title={`لوازم یدکی ${b.nameFa}`} links={modelsOf(b.id).slice(0, 8).map((m) => ({ href: `/${b.id}/${m.id}`, label: `${b.nameFa} ${m.nameFa}` }))} more={{ href: `/${b.id}`, label: `همه مدل‌های ${b.nameFa}` }} />
          ))}
          <FooterCol
            title="دسترسی سریع"
            links={[
              { href: "/shop", label: "همه محصولات" },
              { href: "/categories", label: "همه دسته‌بندی‌ها" },
              { href: "/about", label: "درباره ما" },
              { href: "/contact", label: "تماس با ما" },
              { href: "/cart", label: "سبد خرید" },
            ]}
          />
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 py-6 text-xs sm:flex-row">
          <p>© {toFa(1405)} {SHOP.nameFa} — HAMIDI AUTO PARTS. نسخه نمایشی؛ قیمت‌ها و موجودی‌ها نمونه هستند.</p>
          <div className="flex items-center gap-2">
            {[
              { href: `https://instagram.com/${SHOP.instagram}`, icon: <InstagramIcon />, label: "اینستاگرام" },
              { href: `https://t.me/${SHOP.telegram}`, icon: <Send className="size-4" />, label: "تلگرام" },
              { href: whatsappLink(), icon: <WhatsAppIcon className="size-4" />, label: "واتساپ" },
            ].map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="grid size-9 place-items-center rounded-xl bg-white/5 text-neutral-300 transition hover:bg-primary hover:text-white">
                {s.icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links, more }: { title: string; links: { href: string; label: string }[]; more?: { href: string; label: string } }) {
  return (
    <nav aria-label={title}>
      <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-white"><span className="h-4 w-1 rounded-full bg-primary" aria-hidden />{title}</h2>
      <ul className="space-y-2.5 text-sm">
        {links.map((l) => (
          <li key={l.href}><Link href={l.href} className="transition hover:text-white">{l.label}</Link></li>
        ))}
        {more && <li><Link href={more.href} className="font-semibold text-[#ff5a4f] hover:text-white">{more.label} ←</Link></li>}
      </ul>
    </nav>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}
