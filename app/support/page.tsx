import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Phone, Send } from "lucide-react";
import { BottomNav, Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Container } from "@/components/ui";
import { CopyChip } from "@/components/copy-chip";

export const metadata: Metadata = { title: "پشتیبانی | CaseLine" };

function SupportArt() {
  return (
    <svg viewBox="0 0 260 240" className="mx-auto w-full max-w-[260px]" role="img" aria-label="پشتیبانی آنلاین">
      <defs>
        <linearGradient id="hs" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5cc3f2" /><stop offset="1" stopColor="#1a7fc4" /></linearGradient>
        <radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#7cd0f7" stopOpacity=".35" /><stop offset="1" stopColor="#7cd0f7" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx="130" cy="120" r="115" fill="url(#glow)" />
      <path d="M52 130 C52 60 90 34 130 34 C170 34 208 60 208 130" fill="none" stroke="url(#hs)" strokeWidth="14" strokeLinecap="round" />
      <rect x="34" y="112" width="34" height="66" rx="17" fill="url(#hs)" />
      <rect x="192" y="112" width="34" height="66" rx="17" fill="url(#hs)" />
      <rect x="64" y="84" width="132" height="96" rx="30" fill="#fff" stroke="#cfe8f7" strokeWidth="3" />
      <path d="M96 178 L86 202 L120 180Z" fill="#fff" stroke="#cfe8f7" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="102" cy="132" r="9" fill="#5cc3f2" /><circle cx="130" cy="132" r="9" fill="#2497d4" /><circle cx="158" cy="132" r="9" fill="#5cc3f2" />
      <path d="M204 176 C204 206 176 214 152 210" fill="none" stroke="url(#hs)" strokeWidth="6" strokeLinecap="round" />
      <ellipse cx="146" cy="210" rx="12" ry="7" fill="#fff" stroke="#cfe8f7" strokeWidth="3" />
      <circle cx="216" cy="70" r="20" fill="#fff" stroke="#e1f1fb" /><path d="M208 72 L226 64 L221 80 L216 75Z" fill="#2497d4" />
      <circle cx="44" cy="84" r="16" fill="#fff" stroke="#e1f1fb" /><path d="M39 79 h8 a3 3 0 0 1 3 3 v1 c0 4 -4 8 -8 8 a3 3 0 0 1 -3 -3z" fill="#2497d4" />
    </svg>
  );
}

export default function SupportPage() {
  return (
    <>
      <Header />
      <main className="py-6">
        <Container>
          <section className="rounded-[28px] border border-border bg-surface p-5 shadow-md sm:p-10">
            <div className="grid items-center gap-8 md:grid-cols-[1.5fr_1fr]">
              <div>
                <h1 className="text-2xl font-black sm:text-3xl">تماس با <span className="text-primary">کیس‌لاین</span></h1>
                <p className="mt-5 text-[13px] leading-8 text-muted sm:text-sm">پشتیبانی فروشگاه کیس‌لاین همه‌روزه آماده پاسخ‌گویی به شماست تا مشکلات و درخواست‌های شما را در سریع‌ترین زمان ممکن بررسی و برطرف کند. همکاران ما در ساعات کاری با دقت و احترام پاسخ‌گوی شما خواهند بود. ساعت کاری پشتیبانی از ساعت ۸ صبح تا ۱۰ شب می‌باشد. همچنین سریع‌ترین راه برای ارتباط، ارسال پیام به پشتیبانی تلگرام می‌باشد.</p>
                <CopyChip label="آیدی پشتیبانی تلگرام:" value="@caseline_support" className="mt-5" />
              </div>
              <div><SupportArt /></div>
            </div>
            <div className="mt-8 grid gap-4 border-t border-border pt-8 md:grid-cols-2">
              <a href="#" className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm font-bold transition-shadow hover:shadow-md">
                <span className="grid size-11 place-items-center rounded-lg bg-primary text-primary-fg"><Send className="size-5" /></span>
                <span className="flex-1">ارسال پیام در تلگرام</span><ChevronLeft className="size-4 text-muted" />
              </a>
              <a href="#" className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-sm font-bold shadow-sm transition-shadow hover:shadow-md">
                <span className="grid size-11 place-items-center rounded-lg bg-primary/12 text-primary"><Phone className="size-5" /></span>
                <span dir="ltr" className="flex-1 text-end text-base">021-12345678</span><ChevronLeft className="size-4 text-muted" />
              </a>
            </div>
          </section>
          <p className="mt-4 text-center text-xs text-muted"><Link href="/" className="text-primary hover:underline">بازگشت به صفحه اصلی</Link></p>
        </Container>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
