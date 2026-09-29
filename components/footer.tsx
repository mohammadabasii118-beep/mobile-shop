import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Container } from "@/components/ui";
import { Logo } from "@/components/header";

export function Footer() {
  const rows = [
    { i: Clock, t: "هر روز ساعت ۸ صبح تا ۱۰ شب" },
    { i: Phone, t: "021-12345678" },
    { i: Mail, t: "INFO@CASELINE.IR" },
    { i: MapPin, t: "آدرس: تهران، میدان ونک، خیابان ملاصدرا" },
  ];
  return (
    <footer className="mt-10 pb-32 md:pb-24">
      <Container>
        <div className="grid gap-8 border-t border-border py-10 text-sm sm:grid-cols-2 lg:grid-cols-[1.3fr_0.7fr_1.1fr_0.8fr]">
          <div>
            <Logo />
            <p className="mt-4 leading-8 text-muted">در <b className="text-primary">کیس‌لاین</b>، لوازم جانبی موبایل را اورجینال، با ضمانت سازگاری با مدل گوشی و پرداخت مطمئن تهیه کنید. تیم پشتیبانی ما هر روز پاسخ‌گوی شماست.</p>
          </div>
          <div>
            <h4 className="mb-3 font-extrabold">خدمات ما</h4>
            <ul className="space-y-2 text-muted">{[["محصولات", "/shop"], ["بلاگ", "/blog"], ["حساب کاربری", "/account"], ["تماس با ما", "/support"], ["پشتیبانی", "/support"]].map(([x, h]) => <li key={x}><Link href={h} className="hover:text-primary">{x}</Link></li>)}</ul>
          </div>
          <div>
            <h4 className="mb-3 font-extrabold">اطلاعات تماس</h4>
            <ul className="space-y-3">
              {rows.map(({ i: I, t }) => <li key={t} className="flex items-center gap-2 text-muted"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/12 text-primary"><I className="size-4" /></span><span dir="auto">{t}</span></li>)}
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-extrabold">نماد اعتماد</h4>
            <div className="grid h-24 w-28 place-items-center rounded-lg border border-dashed border-border bg-surface p-2 text-center text-[11px] text-muted">محل نماد اعتماد الکترونیکی</div>
          </div>
        </div>
        <p className="text-center text-xs text-muted">© ۱۴۰۵ CaseLine — نسخه دمو طراحی</p>
      </Container>
    </footer>
  );
}
