import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Faq } from "@/components/shop/faq";
import { pageMetadata } from "@/lib/seo";
import { PageHeader } from "@/components/shop/breadcrumbs";
import { ContactForm } from "@/components/shop/contact-form";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { SHOP, toFa, whatsappLink } from "@/lib/utils";

export const metadata: Metadata = pageMetadata({
  title: "تماس با ما — آدرس، تلفن و واتساپ",
  description: `تماس با فروشگاه حمیدی: تلفن ${SHOP.phone}، واتساپ، آدرس فروشگاه در امین‌السلطان تهران و ساعات کاری. استعلام قیمت و تطابق قطعه نیسان و هوندا.`,
  path: "/contact",
});

const FAQ = [
  { q: "چطور مطمئن شوم قطعه با خودروی من سازگار است؟", a: "شماره شاسی (VIN) یا عکس کارت خودرو را در واتساپ ارسال کنید. کارشناسان ما قطعه را بر اساس کاتالوگ رسمی EPC نیسان و هوندا بررسی و تأیید می‌کنند." },
  { q: "قطعات اصلی هستند یا تقلبی؟", a: "تمام قطعات با ضمانت اصالت عرضه می‌شوند و نوع آن‌ها (Genuine، OEM یا افترمارکت درجه یک) به‌صورت شفاف روی هر محصول درج شده است." },
  { q: "ارسال به شهرستان چقدر طول می‌کشد؟", a: "سفارش‌ها معمولاً ظرف ۲ تا ۴ روز کاری با پست پیشتاز یا باربری به سراسر ایران ارسال می‌شوند." },
  { q: "امکان مرجوع کردن قطعه وجود دارد؟", a: "در صورت عدم تطابق قطعه، تا ۷ روز امکان بازگشت کالا (به شرط سالم بودن و عدم نصب) وجود دارد." },
];

export default function ContactPage() {
  const cards = [
    { icon: Phone, t: "تلفن فروشگاه", v: toFa(SHOP.phone), href: `tel:${SHOP.phone}`, num: true },
    { icon: WhatsAppIcon, t: "واتساپ", v: toFa(SHOP.mobile), href: whatsappLink(), num: true },
    { icon: Mail, t: "ایمیل", v: SHOP.email, href: `mailto:${SHOP.email}`, num: true },
    { icon: Clock, t: "ساعات کاری", v: SHOP.hours },
  ];
  return (
    <>
      <PageHeader title="تماس با فروشگاه حمیدی" subtitle="برای استعلام قیمت، موجودی و تطابق قطعه با ما در ارتباط باشید. پاسخگویی در ساعات کاری کمتر از ۳۰ دقیقه است." crumbs={[{ href: "/contact", label: "تماس با ما" }]} />
      <div className="container-x mt-10 grid gap-8 lg:grid-cols-[1fr_420px]">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-black">ارسال پیام و استعلام قطعه</h2>
          <p className="mt-1 mb-6 text-sm text-neutral-600">فرم زیر را تکمیل کنید؛ کارشناسان ما با شما تماس می‌گیرند.</p>
          <ContactForm />
        </div>
        <div className="space-y-4">
          <a href={whatsappLink("سلام، استعلام قطعه دارم.")} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-4 rounded-3xl bg-[#25D366] p-5 text-white shadow-[0_20px_40px_-20px_rgba(37,211,102,.9)] transition hover:-translate-y-0.5">
            <span className="grid size-14 place-items-center rounded-2xl bg-white/20"><WhatsAppIcon className="size-7" /></span>
            <span><span className="block text-lg font-black">گفتگوی مستقیم در واتساپ</span><span className="text-sm opacity-90">سریع‌ترین راه استعلام قیمت</span></span>
          </a>
          {cards.map((c) => {
            const body = (
              <>
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-neutral-950 text-white" aria-hidden><c.icon className="size-5" /></span>
                <span className="min-w-0"><span className="block text-xs text-neutral-600">{c.t}</span><span className={`block font-bold ${c.num ? "ltr-nums" : ""}`}>{c.v}</span></span>
              </>
            );
            return c.href ? (
              <a key={c.t} href={c.href} className="flex items-center gap-4 rounded-3xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-950">{body}</a>
            ) : (
              <div key={c.t} className="flex items-center gap-4 rounded-3xl border border-neutral-200 bg-white p-4">{body}</div>
            );
          })}
          <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white">
            <div className="relative h-48 overflow-hidden bg-[#eef0f2]">
              <svg role="img" aria-label="نقشه موقعیت فروشگاه" viewBox="0 0 400 200" className="absolute inset-0 size-full" preserveAspectRatio="xMidYMid slice">
                <rect width="400" height="200" fill="#eceef1" />
                {[30, 80, 140, 200, 260, 330].map((x) => <rect key={x} x={x} y="0" width="10" height="200" fill="#fff" />)}
                {[40, 100, 160].map((y) => <rect key={y} x="0" y={y} width="400" height="9" fill="#fff" />)}
                <path d="M0 130 C120 110 220 160 400 120" stroke="#ffd36b" strokeWidth="12" fill="none" />
                <rect x="150" y="55" width="40" height="38" rx="4" fill="#dfe3e8" /><rect x="215" y="112" width="38" height="40" rx="4" fill="#dfe3e8" />
                <rect x="90" y="110" width="40" height="44" rx="4" fill="#d4ecd9" />
              </svg>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full">
                <span className="absolute top-full left-1/2 h-3 w-8 -translate-x-1/2 rounded-full bg-black/20 blur-sm" />
                <MapPin className="size-12 animate-bounce fill-primary text-white drop-shadow-lg" />
              </div>
            </div>
            <div className="p-4">
              <address className="flex gap-2 text-sm leading-7 not-italic"><MapPin className="mt-1 size-4 shrink-0 text-primary" aria-hidden />{SHOP.address}</address>
            </div>
          </div>
        </div>
      </div>

      <div className="container-x mt-16">
        <Faq items={FAQ} />
      </div>
    </>
  );
}
