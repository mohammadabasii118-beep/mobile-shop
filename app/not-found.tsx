import type { Metadata } from "next";
import Link from "next/link";
import { BottomNav } from "@/components/header";
import { Header } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "صفحه پیدا نشد | CaseLine", robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="py-16">
        <Container className="text-center">
          <p className="text-6xl font-black text-primary">۴۰۴</p>
          <h1 className="mt-4 text-xl font-black">صفحه‌ای که دنبالش بودید پیدا نشد</h1>
          <p className="mt-2 text-sm text-muted">ممکن است آدرس تغییر کرده یا محصول دیگر موجود نباشد.</p>
          <div className="mt-6 flex justify-center gap-3 text-sm font-bold">
            <Link href="/shop" className="rounded-xl bg-primary px-5 py-3 text-primary-fg">مشاهده فروشگاه</Link>
            <Link href="/" className="rounded-xl bg-surface-2 px-5 py-3">صفحه اصلی</Link>
          </div>
        </Container>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
