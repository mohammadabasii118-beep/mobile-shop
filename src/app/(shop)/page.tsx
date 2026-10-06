import Link from 'next/link';
import { ArrowLeft, Headset, RotateCcw, ShieldCheck, Truck, Star, CheckCircle2 } from 'lucide-react';
import { getBanners, getBrands, getCategories, getHomeReviews, getSettings, getStoreRating, listProducts } from '@/lib/catalog';
import type { Banner } from '@/lib/types';
import HeroSlider from '@/components/shop/HeroSlider';
import ProductGrid from '@/components/shop/ProductGrid';
import Countdown from '@/components/shop/Countdown';
import Pic from '@/components/shop/Pic';
import { fa } from '@/lib/format';

const FALLBACK: Banner = {
  id: 0, position: 'hero', layout: 'split', theme: 'night', badge: 'جدید|لوازم جانبی اصل', title: 'شارژ سریع‌تر.\n*حمل سبک‌تر.*',
  subtitle: 'لوازم جانبی اصل موبایل با گارانتی اصالت و ارسال سریع.', cta_text: 'مشاهده‌ی فروشگاه', link: '/shop', image: null, image_mobile: null,
  art: 'p-charger', sort: 0, active: 1, starts_at: null, ends_at: null,
};

export default function HomePage() {
  const s = getSettings();
  const low = Number(s.low_stock) || 5;
  const hero = getBanners('hero');
  const promos = getBanners('promo').slice(0, 2);
  const cats = getCategories().filter((c) => !c.parent_id);
  const featured = listProducts({ featured: true, limit: 8, sort: 'popular' }).items;
  const fresh = listProducts({ limit: 4, sort: 'new' }).items;
  const deals = listProducts({ onSale: true, limit: 3, sort: 'new' }).items;
  const brands = getBrands();
  const reviews = getHomeReviews();
  const rating = getStoreRating();

  return (
    <>
      <HeroSlider slides={hero.length ? hero : [FALLBACK]} />
      <div className="hero-strip">
        <div className="wrap">
          <div className="it"><ShieldCheck className="i" />ضمانت اصالت کالا</div>
          <div className="it"><Truck className="i" />ارسال سریع</div>
          <div className="it"><RotateCcw className="i" />مرجوعی ۷ روزه</div>
          <div className="it"><Headset className="i" />پشتیبانی ۷ روز هفته</div>
        </div>
      </div>

      <section className="sec">
        <div className="wrap">
          <div className="sh"><h2>خرید بر اساس دسته</h2><Link className="more" href="/shop">همه‌ی محصولات<ArrowLeft className="i" /></Link></div>
          <div className="cat-grid">
            {cats.map((c) => (
              <Link key={c.id} className="cat" href={`/category/${c.slug}`}>
                <Pic src={c.image || (c.art ? `art:${c.art}` : null)} className="art" />
                <span>{c.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="sec tight-top">
          <div className="wrap">
            <div className="sh"><div><h2>محصولات ویژه</h2><p className="sub">انتخاب تیم {s.store_name}، پرفروش‌ترین‌ها</p></div><Link className="more" href="/shop">مشاهده‌ی همه<ArrowLeft className="i" /></Link></div>
            <ProductGrid items={featured} low={low} />
          </div>
        </section>
      )}

      {deals.length > 0 && (
        <section className="sec deal on-night">
          <div className="wrap">
            <div className="deal-in">
              <div>
                <span className="tag">پیشنهاد ویژه امروز</span>
                <h2>تخفیف ویژه روی لوازم منتخب</h2>
                <p>موجودی محدود است و با پایان زمان، قیمت‌ها به حالت عادی برمی‌گردند.</p>
                <Countdown />
                <Link className="btn btn-white btn-lg" href="/shop?sale=1">همه‌ی تخفیف‌ها</Link>
              </div>
              <ProductGrid items={deals} low={low} cols={3} />
            </div>
          </div>
        </section>
      )}

      <section className="sec">
        <div className="wrap">
          <div className="sh"><div><h2>جدیدترین محصولات</h2><p className="sub">تازه رسیده‌ها به انبار</p></div><Link className="more" href="/shop?sort=new">مشاهده‌ی همه<ArrowLeft className="i" /></Link></div>
          <ProductGrid items={fresh} low={low} />
        </div>
      </section>

      {promos.length > 0 && (
        <section className="sec tight-top">
          <div className="wrap promos">
            {promos.map((b) => (
              <Link key={b.id} className={`promo promo-${b.theme}`} href={b.link || '/shop'}>
                <div><h3>{b.title.replace(/\*/g, '')}</h3>{b.subtitle && <p>{b.subtitle}</p>}</div>
                <span className={`btn ${b.theme === 'light' ? 'btn-white' : 'btn-outline-night'}`}>{b.cta_text || 'مشاهده'}</span>
                <Pic src={b.image || (b.art ? `art:${b.art}` : null)} className="art" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {brands.length > 0 && (
        <section className="sec tight-top">
          <div className="wrap">
            <div className="sh"><h2>برندهای معتبر</h2></div>
            <div className="brands">
              {brands.slice(0, 8).map((b) => <Link key={b.id} href={`/shop?brand=${b.slug}`}>{b.name}</Link>)}
            </div>
          </div>
        </section>
      )}

      <section className="sec tight-top">
        <div className="wrap ben">
          <div><div className="ic"><ShieldCheck className="i" /></div><h3>اصالت تضمینی</h3><p>هر کالا با گارانتی اصالت و سلامت فیزیکی ارسال می‌شود.</p></div>
          <div><div className="ic"><Truck className="i" /></div><h3>ارسال سریع</h3><p>سفارش‌های ثبت‌شده تا ساعت ۱۶ در تهران، همان روز تحویل می‌شوند.</p></div>
          <div><div className="ic"><RotateCcw className="i" /></div><h3>مرجوعی آسان</h3><p>تا ۷ روز بدون پرسش اضافه، کالا را برگردانید.</p></div>
          <div><div className="ic"><Headset className="i" /></div><h3>مشاوره‌ی سازگاری</h3><p>مطمئن نیستید کدام قاب یا شارژر مناسب گوشی شماست؟ بپرسید.</p></div>
        </div>
      </section>

      {reviews.length > 0 && (
        <section className="sec tight-top">
          <div className="wrap">
            <div className="sh"><div><h2>نظر مشتریان</h2>{rating.n > 0 && <p className="sub">میانگین امتیاز <b className="num" style={{ color: 'var(--ink)' }}>{fa(Math.round(rating.avg * 10) / 10)}</b> از ۵ بر پایه‌ی <span className="num">{fa(rating.n)}</span> نظر</p>}</div></div>
            <div className="rev">
              {reviews.slice(0, 3).map((r) => (
                <figure key={r.id}>
                  <div className="stars" role="img" aria-label={`امتیاز ${fa(r.rating)} از ۵`}>
                    {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={n > r.rating ? 'off' : ''} />)}
                  </div>
                  <blockquote>{r.body}</blockquote>
                  <figcaption><span className="av">{r.author.slice(0, 1)}</span><div><b>{r.author}</b><span className="ok"><CheckCircle2 />خرید تأییدشده</span></div></figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
