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
    <footer className="mt-10 pb-28 md:pb-10">
      <Container className="grid gap-8 py-8 md:grid-cols-2">
        <div className="text-center md:text-start">
          <div className="flex justify-center md:justify-start"><Logo /></div>
          <p className="mt-4 text-sm leading-8 text-muted">در <b className="text-primary">کیس‌لاین</b>، لوازم جانبی موبایل را اورجینال، با ضمانت سازگاری با مدل گوشی و پرداخت مطمئن تهیه کنید. تیم پشتیبانی ما هر روز پاسخ‌گوی شماست.</p>
        </div>
        <div>
          <h4 className="mb-3 text-center text-sm font-extrabold md:text-start">اطلاعات تماس</h4>
          <ul className="space-y-3 text-sm">
            {rows.map(({ i: I, t }) => <li key={t} className="flex items-center gap-2 text-muted"><span className="grid size-8 place-items-center rounded-full bg-primary/12 text-primary"><I className="size-4" /></span><span dir="auto">{t}</span></li>)}
          </ul>
        </div>
      </Container>
      <p className="text-center text-xs text-muted">© ۱۴۰۵ CaseLine — نسخه دمو طراحی</p>
    </footer>
  );
}
