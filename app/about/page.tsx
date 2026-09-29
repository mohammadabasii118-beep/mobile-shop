import type { Metadata } from "next";
export const metadata: Metadata = { title: "درباره ما" };

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-14 leading-8 text-sm muted">
      <h1 className="text-2xl font-extrabold mb-6 ink" style={{ color: "var(--text)" }}>درباره کیس لاین</h1>
      <p className="mb-4">
        کیس لاین مرجع تخصصی قاب، کاور و لوازم جانبی موبایل است. تمرکز ما بر ارائه محصولاتی با کیفیت بالا،
        طراحی ظریف و قیمت منصفانه است تا هر کاربر بتواند سبک شخصی خودش را برای گوشی و اکسسوری‌هایش انتخاب کند.
      </p>
      <p className="mb-4">
        تمام محصولات پیش از عرضه از نظر کیفیت ساخت، تناسب دقیق با مدل دستگاه و دوام بررسی می‌شوند.
        ارسال سریع، ضمانت اصالت کالا و پشتیبانی پاسخگو بخشی از تعهد ما به مشتریان است.
      </p>
      <p>برای هرگونه سوال یا پیشنهاد، از طریق صفحه تماس با ما در ارتباط باشید.</p>
    </div>
  );
}
