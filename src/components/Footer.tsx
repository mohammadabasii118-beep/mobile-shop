import { Link } from 'react-router-dom';
import { Instagram, Send, Music2 } from 'lucide-react';
import { Logo } from './Navbar';

const cols = [
  { t: 'فروشگاه', l: [['قاب گوشی', '/category/cases'], ['محافظ صفحه', '/category/screen-protectors'], ['شارژر', '/category/chargers'], ['کابل', '/category/cables'], ['لوازم جانبی', '/category/accessories']] },
  { t: 'پشتیبانی', l: [['تماس با ما', '/contact'], ['سوالات متداول', '/faq'], ['راهنمای خرید', '/faq'], ['شرایط ارسال', '/shipping'], ['شرایط بازگشت', '/returns'], ['قوانین و مقررات', '/about']] },
];

export function Footer() {
  return (
    <footer className="mt-32 border-t border-line bg-surface/50">
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-7 text-mist/60">فروشگاه نسل جدید قاب گوشی و لوازم جانبی موبایل؛ برای کسانی که متفاوت انتخاب می‌کنند.</p>
          <div className="mt-5 flex gap-2">
            {[Instagram, Send, Music2].map((I, i) => <a key={i} href="#" aria-label={['Instagram', 'Telegram', 'TikTok'][i]} className="grid h-10 w-10 place-items-center rounded-full border border-line text-white transition hover:bg-brand-gradient"><I size={18} /></a>)}
          </div>
          <p className="mt-3 text-xs text-mist/40" dir="ltr">Instagram · Telegram · TikTok</p>
        </div>
        {cols.map((c) => (
          <div key={c.t}><h4 className="mb-4 font-black text-white">{c.t}</h4>
            <ul className="space-y-3 text-sm text-mist/60">{c.l.map(([n, to]) => <li key={n}><Link to={to} className="hover:text-white">{n}</Link></li>)}</ul></div>
        ))}
      </div>
      <div className="border-t border-line py-5 text-center text-xs text-mist/50">© تمامی حقوق برای CaseLine محفوظ است.</div>
    </footer>
  );
}
