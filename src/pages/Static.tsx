import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { faqs } from '@/data/account';
import { useSEO } from '@/utils/seo';
import { useShop } from '@/store';
import { PageShell } from '@/components/PageShell';
import { CaseCustomizer } from '@/components/CaseCustomizer';

const Prose = ({ children }: { children: React.ReactNode }) => <div className="card max-w-3xl space-y-4 p-6 leading-9 text-mist/80 sm:p-10">{children}</div>;

export const About = () => { useSEO({ title: 'درباره ما' }); return <PageShell title="درباره CaseLine"><Prose><p>CaseLine با این باور شروع شد که گوشی شما بخشی از استایل شماست. ما قاب‌ها و لوازم جانبی را با کیفیت بالا، طراحی مدرن و قیمت منصفانه عرضه می‌کنیم.</p><p>تمام محصولات پیش از ارسال بررسی می‌شوند و با ضمانت اصالت به دست شما می‌رسند.</p></Prose></PageShell>; };
export const Shipping = () => { useSEO({ title: 'شرایط ارسال' }); return <PageShell title="شرایط ارسال"><Prose><p>• تهران: ۱ تا ۲ روز کاری · سایر شهرها: ۲ تا ۵ روز کاری.</p><p>• ارسال سفارش‌های بالای ۳۵۰ هزار تومان رایگان است.</p><p>• ارسال اکسپرس با هزینه‌ی ۹۵٬۰۰۰ تومان انجام می‌شود.</p></Prose></PageShell>; };
export const Returns = () => { useSEO({ title: 'شرایط بازگشت کالا' }); return <PageShell title="شرایط بازگشت کالا"><Prose><p>تا ۷ روز پس از تحویل می‌توانید کالا را در صورت سالم بودن و بسته‌بندی اصلی بازگردانید.</p><p>مبلغ پس از تأیید، به کیف پول CaseLine یا حساب شما بازگردانده می‌شود.</p></Prose></PageShell>; };

export function Contact() {
  useSEO({ title: 'تماس با ما' });
  const notify = useShop((s) => s.notify);
  return (
    <PageShell title="تماس با ما" subtitle="پشتیبانی CaseLine هر روز از ۹ تا ۲۱ در کنار شماست.">
      <form className="card grid max-w-xl gap-4 p-6" onSubmit={(e) => { e.preventDefault(); notify('پیام شما ارسال شد'); (e.target as HTMLFormElement).reset(); }}>
        <input required className="input" placeholder="نام شما" /><input required type="email" className="input" placeholder="ایمیل" dir="ltr" /><textarea required rows={5} className="input" placeholder="پیام شما" /><button className="btn btn-primary">ارسال پیام</button>
      </form>
    </PageShell>
  );
}

export function FAQ() {
  useSEO({ title: 'سوالات متداول' });
  const [open, setOpen] = useState<number | null>(0);
  return (
    <PageShell title="سوالات متداول">
      <div className="max-w-3xl space-y-3">{faqs.map((f, i) => (
        <div key={f.q} className="card overflow-hidden"><button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between p-5 text-right font-bold text-white">{f.q}<ChevronDown className={`transition ${open === i ? 'rotate-180' : ''}`} /></button>{open === i && <p className="px-5 pb-5 text-sm leading-8 text-mist/70">{f.a}</p>}</div>))}</div>
    </PageShell>
  );
}

export function Customize() {
  useSEO({ title: 'قاب خودت را بساز' });
  return <PageShell title="قاب خودت را بساز" subtitle="مدل، رنگ، عکس و متن دلخواهت را انتخاب کن."><CaseCustomizer /></PageShell>;
}

export function NotFound() {
  useSEO({ title: 'صفحه پیدا نشد' });
  return <PageShell title="۴۰۴"><p className="text-mist/70">صفحه‌ای که دنبالش بودید پیدا نشد.</p></PageShell>;
}
