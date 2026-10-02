import { lazy, Suspense, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowLeft, Headphones, RotateCcw, ShieldCheck, Truck, Sparkles, BadgeCheck } from 'lucide-react';
import { categories } from '@/data/categories';
import { products } from '@/data/products';
import { CategoryCard } from '@/components/CategoryCard';
import { ProductGrid } from '@/components/ProductGrid';
import { ProductCard } from '@/components/ProductCard';
import { SectionHeading } from '@/components/SectionHeading';
import { FadeIn } from '@/components/FadeIn';
import { AnimatedText } from '@/components/AnimatedText';
import { Magnet } from '@/components/Magnet';
import { discountPercent, toFa } from '@/utils/format';
import { useShop } from '@/store';

const HeroProduct3D = lazy(() => import('@/three/HeroProduct3D'));

export const Categories = () => (
  <section className="container-x py-24">
    <SectionHeading eyebrow="CATEGORIES" title="دسته‌بندی محصولات" link="همه محصولات" to="/shop" />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{categories.map((c, i) => <FadeIn key={c.slug} delay={i * 0.06}><CategoryCard cat={c} index={i} /></FadeIn>)}</div>
  </section>
);

export const Featured = () => (
  <section className="container-x py-16">
    <SectionHeading eyebrow="FEATURED" title="محصولات ویژه" link="مشاهده همه" to="/shop" />
    <ProductGrid items={products.filter((p) => p.isFeatured).slice(0, 8)} />
  </section>
);

const why = [
  ['۰۱', 'کیفیت بالا', 'مواد اولیه درجه یک و تست دقیق پیش از ارسال.'],
  ['۰۲', 'ارسال سریع', 'ارسال همان روز برای سفارش‌های تهران.'],
  ['۰۳', 'پرداخت امن', 'پرداخت از طریق درگاه معتبر و کیف پول.'],
  ['۰۴', 'ضمانت بازگشت', 'تا ۷ روز امکان بازگشت کالا.'],
  ['۰۵', 'پشتیبانی واقعی', 'پاسخ‌گویی انسانی، هر روز هفته.'],
];
export const WhyUs = () => (
  <section className="container-x py-24">
    <SectionHeading eyebrow="WHY US" title="چرا CaseLine؟" />
    <div className="divide-y divide-line border-y border-line">
      {why.map(([n, t, d], i) => (
        <FadeIn key={n} delay={i * 0.05}>
          <div className="group flex items-center gap-4 py-7 transition-colors hover:bg-white/[.02] md:gap-10 md:py-9">
            <span className="w-14 text-3xl font-black text-white/15 transition group-hover:text-violet md:w-24 md:text-6xl">{n}</span>
            <h3 className="flex-1 text-2xl font-black text-white transition-transform duration-500 group-hover:-translate-x-2 md:text-5xl">{t}</h3>
            <p className="hidden max-w-xs text-sm leading-7 text-mist/60 md:block">{d}</p>
          </div>
        </FadeIn>
      ))}
    </div>
  </section>
);

export function Promo3D() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const x = useTransform(scrollYProgress, [0, 1], [120, -120]);
  return (
    <section ref={ref} className="relative my-16 h-[85vh] min-h-[560px] overflow-hidden border-y border-line">
      <motion.h2 style={{ x }} className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 whitespace-nowrap text-center text-[clamp(5rem,20vw,18rem)] font-black leading-none text-white/[.04]">CASELINE</motion.h2>
      <Suspense fallback={null}><HeroProduct3D color="#EC4899" className="absolute inset-0" /></Suspense>
      <div className="container-x pointer-events-none relative z-10 flex h-full flex-col justify-between py-14">
        <AnimatedText as="h2" text={'گوشی تو،\nاستایل تو.'} className="text-5xl font-black leading-tight text-white md:text-8xl" />
        <div className="pointer-events-auto"><Magnet><Link to="/customize" className="btn btn-light !px-8 !py-4 text-base">قاب خودت را انتخاب کن<ArrowLeft size={18} /></Link></Magnet></div>
      </div>
    </section>
  );
}

export function NewArrivals() {
  const items = products.filter((p) => p.isNew);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <section className="py-16">
      <div className="container-x"><SectionHeading eyebrow="NEW" title="جدیدترین محصولات" link="مشاهده همه" to="/shop?sort=new" /></div>
      <div ref={ref} className="no-scrollbar flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:px-6 lg:px-10">
        {items.map((p) => <div key={p.id} className="w-[220px] shrink-0 snap-start sm:w-[270px]"><ProductCard product={p} badge="جدید" /></div>)}
      </div>
    </section>
  );
}

export function Bestsellers() {
  const items = products.filter((p) => p.isBestseller);
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * 300, behavior: 'smooth' });
  return (
    <section className="py-16">
      <div className="container-x flex items-end justify-between">
        <SectionHeading eyebrow="BESTSELLERS" title="پرفروش‌ترین‌ها" />
        <div className="mb-10 hidden gap-2 sm:flex">{[1, -1].map((d) => <button key={d} aria-label={d > 0 ? 'بعدی' : 'قبلی'} onClick={() => scroll(d)} className="grid h-11 w-11 place-items-center rounded-full border border-line text-white hover:bg-white/10"><ArrowLeft size={18} className={d > 0 ? '' : 'rotate-180'} /></button>)}</div>
      </div>
      <div ref={ref} className="no-scrollbar flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:px-6 lg:px-10">
        {items.map((p) => <div key={p.id} className="w-[220px] shrink-0 snap-start sm:w-[270px]"><ProductCard product={p} badge="پرفروش" /></div>)}
      </div>
    </section>
  );
}

export function Deals() {
  const deals = products.filter((p) => discountPercent(p.price, p.oldPrice) > 0).slice(0, 4);
  return (
    <section className="container-x py-16">
      <div className="relative overflow-hidden rounded-[2.5rem] border border-line bg-gradient-to-br from-[#1a1033] via-[#120d1f] to-[#1f0d18] p-6 sm:p-10 md:p-14">
        <div className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-violet/30 blur-[100px]" />
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div><p className="mb-2 flex items-center gap-2 text-xs font-bold text-amber"><Sparkles size={14} />SPECIAL OFFERS</p>
            <AnimatedText text="تخفیف‌های ویژه CaseLine" className="text-3xl font-black text-white md:text-6xl" /></div>
          <Link to="/shop?discounted=1" className="btn btn-primary self-start">مشاهده تخفیف‌ها<ArrowLeft size={16} /></Link>
        </div>
        <div className="relative mt-10 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
          {deals.map((p) => (
            <Link key={p.id} to={`/product/${p.slug}`} className="group rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur transition hover:border-magenta/60">
              <div className="text-4xl font-black text-gradient md:text-5xl">{toFa(discountPercent(p.price, p.oldPrice))}٪</div>
              <div className="text-xs font-bold text-mist/70">تخفیف</div>
              <p className="mt-4 line-clamp-2 text-sm font-bold text-white group-hover:text-magenta">{p.name}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

const trust = [[ShieldCheck, 'پرداخت امن'], [Truck, 'ارسال سریع'], [BadgeCheck, 'ضمانت اصالت'], [Headphones, 'پشتیبانی'], [RotateCcw, 'امکان بازگشت کالا']] as const;
export const Trust = () => (
  <section className="container-x py-16">
    <SectionHeading eyebrow="TRUST" title="خرید مطمئن از CaseLine" />
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {trust.map(([I, t], i) => <FadeIn key={t} delay={i * 0.06}><div className="card flex flex-col items-center gap-3 p-6 text-center transition hover:border-violet/40"><I className="text-violet" size={30} /><b className="text-sm text-white">{t}</b></div></FadeIn>)}
    </div>
  </section>
);

export function Newsletter() {
  const notify = useShop((s) => s.notify);
  return (
    <section className="container-x py-16">
      <div className="mx-auto max-w-3xl text-center">
        <AnimatedText text="همیشه یک قدم جلوتر باش" className="text-4xl font-black text-white md:text-6xl" />
        <p className="mt-4 text-mist/60">برای اطلاع از محصولات جدید، تخفیف‌ها و پیشنهادهای ویژه عضو شوید.</p>
        <form onSubmit={(e) => { e.preventDefault(); notify('عضویت شما ثبت شد'); (e.target as HTMLFormElement).reset(); }} className="mx-auto mt-8 flex max-w-lg gap-2">
          <input type="email" required placeholder="ایمیل شما" className="input !rounded-full" dir="ltr" style={{ textAlign: 'right' }} />
          <button className="btn btn-primary shrink-0">عضویت</button>
        </form>
      </div>
    </section>
  );
}
