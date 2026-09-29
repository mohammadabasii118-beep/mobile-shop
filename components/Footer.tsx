import Link from "next/link";
import { getSiteSettings } from "@/lib/siteSettings";

export default async function Footer() {
  const site = await getSiteSettings();
  const socialLinks = [
    site.instagramUrl ? { href: site.instagramUrl, label: "اینستاگرام" } : null,
    site.telegramUrl ? { href: site.telegramUrl, label: "تلگرام" } : null,
    site.whatsappUrl ? { href: site.whatsappUrl, label: "واتس‌اپ" } : null,
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <footer className="border-t line mt-4 surface2">
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-12 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm text-white" style={{ background: "#404040" }}>CL</span>
          <span className="font-extrabold">کیس لاین</span>
        </div>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm muted mb-6">
          <Link href="/">صفحه اصلی</Link>
          <Link href="/category/case">قاب و کاور</Link>
          <Link href="/about">درباره ما</Link>
          <Link href="/contact">تماس با ما</Link>
          <Link href="/order/track">پیگیری سفارش</Link>
          <Link href="/partners">همکاری عمده/نمایندگی</Link>
          <Link href="/terms">قوانین و مقررات</Link>
        </div>
        {/* Social links only render when an admin has actually filled one
            in at /admin/settings — never a placeholder/fake link. */}
        {socialLinks.length > 0 && (
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs muted mb-6">
            {socialLinks.map((s) => (
              <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer">{s.label}</a>
            ))}
          </div>
        )}
        <p className="text-xs muted">© {new Date().getFullYear()} کیس لاین — تمامی حقوق محفوظ است</p>
      </div>
    </footer>
  );
}
