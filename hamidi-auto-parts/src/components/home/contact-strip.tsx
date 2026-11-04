import { MapPin, Phone, Clock } from "lucide-react";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { SHOP, toFa, whatsappLink } from "@/lib/utils";

export function ContactStrip() {
  const cards = [
    { icon: <WhatsAppIcon className="size-6" />, t: "واتساپ فروشگاه", v: toFa(SHOP.mobile), d: "ارسال عکس قطعه و دریافت قیمت", href: whatsappLink("سلام، استعلام قیمت دارم."), cls: "bg-[#25D366] text-white", ext: true, num: true },
    { icon: <Phone className="size-6" />, t: "تلفن فروش", v: toFa(SHOP.phone), d: "مشاوره رایگان قبل از خرید", href: `tel:${SHOP.phone}`, cls: "bg-neutral-950 text-white", num: true },
    { icon: <MapPin className="size-6" />, t: "آدرس فروشگاه", v: "تهران، امین‌السلطان", d: "پاساژ ایرانیان، پلاک ۱۸", href: "/contact", cls: "bg-primary text-white" },
    { icon: <Clock className="size-6" />, t: "ساعات کاری", v: "شنبه تا پنجشنبه", d: SHOP.hours, href: "/contact", cls: "bg-neutral-100 text-neutral-950" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <a key={c.t} href={c.href} target={c.ext ? "_blank" : undefined} rel={c.ext ? "noreferrer" : undefined} className="group flex items-start gap-4 rounded-3xl border border-neutral-200 bg-white p-5 transition hover:-translate-y-1 hover:shadow-[0_20px_40px_-24px_rgba(0,0,0,.4)]">
          <span className={`grid size-14 shrink-0 place-items-center rounded-2xl transition group-hover:scale-105 ${c.cls}`}>{c.icon}</span>
          <div className="min-w-0">
            <p className="text-xs text-neutral-500">{c.t}</p>
            <p className={`mt-1 font-extrabold ${c.num ? "ltr-nums" : ""}`}>{c.v}</p>
            <p className="mt-1 text-xs leading-5 text-neutral-500">{c.d}</p>
          </div>
        </a>
      ))}
    </div>
  );
}
