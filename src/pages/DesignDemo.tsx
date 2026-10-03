import { lazy, Suspense, useState } from 'react';
import { ArrowLeft, BarChart3, Boxes, Heart, LayoutDashboard, Menu, Minus, Package, Plus, Search, Settings, ShoppingBag, Star, Tag, Trash2, User, Users, X } from 'lucide-react';
import '@/features/design-demo/design-demo.css';
import { products } from '@/data/products';
import { categories } from '@/data/categories';
import { ProductArt } from '@/components/ProductArt';
import { discountPercent, formatPrice, toFa } from '@/utils/format';
import { useSEO } from '@/utils/seo';
import type { ArtKind } from '@/types';

const HeroProduct3D = lazy(() => import('@/three/HeroProduct3D'));
const artOf: Record<string, ArtKind> = { cases: 'case', 'screen-protectors': 'glass', chargers: 'charger', cables: 'cable', 'power-banks': 'powerbank', accessories: 'holder' };

const Tag_ = ({ children }: { children: string }) => <div className="tag">{children}</div>;
const Head = ({ tag, title, text }: { tag: string; title: string; text?: string }) => (
  <div className="head"><Tag_>{tag}</Tag_><h2 className="h">{title}</h2>{text && <p className="lead">{text}</p>}</div>
);

function Header() {
  const [open, setOpen] = useState(false);
  const links = ['خانه', 'فروشگاه', 'قاب گوشی', 'لوازم جانبی', 'محصولات جدید', 'پرفروش‌ها'];
  return (
    <header className="nav">
      <div className="wrap in">
        <a href="#top" className="logo"><i />CaseLine</a>
        <nav className="links" aria-label="منوی اصلی">{links.map((l, i) => <a key={l} href="#top" aria-current={i === 1 ? 'page' : undefined}>{l}</a>)}</nav>
        <div className="acts">
          <button className="ic" aria-label="جستجو"><Search size={18} /></button>
          <button className="ic" aria-label="علاقه‌مندی‌ها"><Heart size={18} /></button>
          <button className="ic" aria-label="سبد خرید"><ShoppingBag size={18} /><span className="badge-n">{toFa(2)}</span></button>
          <a className="btn btn-s" href="#top"><User size={16} />ورود</a>
          <button className="ic burger" aria-label="منو" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={18} /> : <Menu size={18} />}</button>
        </div>
      </div>
      <div className={`drawer ${open ? 'open' : ''}`}>{links.map((l) => <a key={l} href="#top">{l}</a>)}</div>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero wrap" id="top">
      <div className="hero-grid">
        <div>
          <div className="tag">کالکشن جدید ۱۴۰۵</div>
          <h1>قاب گوشی،<br /><span>استایل تو.</span></h1>
          <p className="lead">قاب‌های خاص و لوازم جانبی موبایل برای کسانی که متفاوت انتخاب می‌کنند.</p>
          <div className="cta-row">
            <a className="btn btn-p btn-lg" href="#products">مشاهده فروشگاه<ArrowLeft size={18} /></a>
            <a className="btn btn-s btn-lg" href="#products">محصولات جدید</a>
          </div>
          <div className="hero-stats"><div><b>{toFa(20000)}+</b><span>مشتری راضی</span></div><div><b>{toFa(48)}٪</b><span>تخفیف تا</span></div><div><b>{toFa(2)} روز</b><span>ارسال سریع</span></div></div>
        </div>
        <div style={{ display: 'grid', gap: 15 }}>
          <div className="spot v" style={{ minHeight: 320 }}>
            <div className="pill" style={{ background: 'rgba(255,255,255,.2)', color: '#fff', alignSelf: 'flex-start' }}>پرفروش این هفته</div>
            <div style={{ maxWidth: '55%' }}><b>قاب شفاف مگ‌سیف</b><p>آیفون ۱۶ پرو مکس</p><a className="btn btn-p" style={{ marginTop: 14 }} href="#products">خرید محصول</a></div>
            <ProductArt kind="case" color="#d44df0" className="art" />
          </div>
          <div className="spot o" style={{ minHeight: 150, flexDirection: 'row', alignItems: 'center' }}>
            <div><b>تا ۳۰٪ تخفیف ویژه</b><p>برای کابل و شارژر</p></div>
            <ProductArt kind="charger" color="#fff" className="h-28 w-28 shrink-0" />
          </div>
        </div>
      </div>
      <div style={{ position: 'relative', height: 280, marginTop: 40, borderRadius: 30, overflow: 'hidden', background: 'var(--s1)' }} aria-label="گوشی سه‌بعدی">
        <Suspense fallback={null}><HeroProduct3D className="absolute inset-0 h-full w-full" color="#6a4cf5" /></Suspense>
      </div>
    </section>
  );
}

const Categories = () => (
  <section className="sec wrap">
    <Head tag="۰۲ · بخش دسته‌بندی" title="دسته‌بندی محصولات" text="کارت‌های سطح‌دار روی بوم تیره؛ فقط یک کارت گرادیانی برای تأکید." />
    <div className="cats">
      {categories.map((c, i) => (
        <a key={c.slug} href="#products" className={`cat ${i === 0 ? 'spot v' : ''}`}>
          <span className="n">{toFa(i + 1).padStart(2, '۰')}</span>
          <div className="txt"><h3>{c.name}</h3><p>{c.description}</p></div>
          <ProductArt kind={artOf[c.slug]} color={i === 0 ? '#fff' : c.hue} className="art" />
        </a>
      ))}
    </div>
  </section>
);

function Card({ id }: { id: string }) {
  const p = products.find((x) => x.id === id)!;
  const [fav, setFav] = useState(false);
  const off = discountPercent(p.price, p.oldPrice);
  return (
    <article className="pc">
      <div className="img">
        <ProductArt kind={p.art} color={p.colors[0].name === 'شفاف' ? '#6a4cf5' : p.colors[0].hex} className="" />
        <div className="tags">{off > 0 && <span className="pill hot">{toFa(off)}٪ تخفیف</span>}{p.isBestseller && <span className="pill">پرفروش</span>}{p.isNew && <span className="pill">جدید</span>}</div>
        <button className="fav" aria-pressed={fav} aria-label="علاقه‌مندی" onClick={() => setFav(!fav)}><Heart size={16} /></button>
      </div>
      <h4>{p.name}</h4>
      <div className="meta"><span className="stars"><Star size={13} fill="currentColor" />{p.rating.toLocaleString('fa-IR')} ({toFa(p.reviewCount)})</span><span>{p.stock <= 10 ? `فقط ${toFa(p.stock)} عدد` : 'موجود'}</span></div>
      <div className="row"><div>{p.oldPrice && <span className="old">{formatPrice(p.oldPrice)}</span>}<span className="price">{formatPrice(p.price)}</span></div><button className="add" aria-label="افزودن به سبد"><Plus size={18} /></button></div>
    </article>
  );
}

const Products = () => (
  <section className="sec wrap" id="products">
    <Head tag="۰۳ · Product Cards" title="محصولات ویژه" text="کارت محصول با سطح surface-1، تصویر روی surface-2 و دکمه‌ی دایره‌ای سفید." />
    <div className="grid4">{['p1', 'p5', 'p9', 'p14'].map((id) => <Card key={id} id={id} />)}</div>
  </section>
);

function Detail() {
  const p = products[0];
  const [model, setModel] = useState(0); const [color, setColor] = useState(0); const [q, setQ] = useState(1); const [shot, setShot] = useState(0);
  const hexes = ['#6a4cf5', '#d44df0', '#ff7a3d', '#1c1c1c'];
  return (
    <section className="sec wrap">
      <Head tag="۰۴ · Product Detail" title="صفحه محصول" />
      <div className="pd">
        <div className="mock">
          <div className="stage"><ProductArt kind="case" color={hexes[color]} className="" /></div>
          <div className="thumbs">{[0, 1, 2, 3].map((i) => <button key={i} aria-pressed={shot === i} aria-label={`تصویر ${toFa(i + 1)}`} onClick={() => setShot(i)}><ProductArt kind="case" color={hexes[color]} className="" /></button>)}</div>
        </div>
        <div>
          <div className="btnrow"><span className="pill">پرفروش</span><span className="pill hot">{toFa(22)}٪ تخفیف</span></div>
          <h3>{p.name}</h3>
          <div className="stars"><Star size={14} fill="currentColor" />{(4.8).toLocaleString('fa-IR')} <span style={{ color: 'var(--muted)' }}>· {toFa(214)} نظر</span></div>
          <div className="big-price">{formatPrice(p.price)}<small>{formatPrice(p.oldPrice!)}</small></div>
          <p className="lead" style={{ fontSize: 15 }}>{p.description}</p>
          <div className="opt"><label>مدل گوشی</label><div className="rowc">{['آیفون ۱۶ پرو مکس', 'آیفون ۱۶ پرو', 'آیفون ۱۶'].map((m, i) => <button key={m} className="chip" aria-pressed={model === i} onClick={() => setModel(i)}>{m}</button>)}</div></div>
          <div className="opt"><label>رنگ</label><div className="rowc">{hexes.map((h, i) => <button key={h} className="sw" aria-label={`رنگ ${toFa(i + 1)}`} aria-pressed={color === i} onClick={() => setColor(i)} style={{ background: h }} />)}</div></div>
          <div className="opt"><label>تعداد</label><div className="qty"><button className="ic" aria-label="افزایش" onClick={() => setQ(q + 1)}><Plus size={16} /></button><b>{toFa(q)}</b><button className="ic" aria-label="کاهش" onClick={() => setQ(Math.max(1, q - 1))}><Minus size={16} /></button></div></div>
          <div className="btnrow" style={{ marginTop: 24 }}><button className="btn btn-p btn-lg" style={{ flex: 1 }}>افزودن به سبد</button><button className="btn btn-s btn-lg" style={{ flex: 1 }}>خرید فوری</button></div>
          <div className="info"><div><b>ارسال سریع</b>تهران ۱ تا ۲ روز، شهرستان ۲ تا ۵ روز</div><div><b>بازگشت کالا</b>تا ۷ روز با شرایط بازگشت</div></div>
        </div>
      </div>
    </section>
  );
}

function Forms() {
  const [tog, setTog] = useState(true); const [tog2, setTog2] = useState(false); const [email, setEmail] = useState('abc');
  return (
    <section className="sec wrap">
      <Head tag="۰۵ · Buttons و فرم‌ها" title="دکمه‌ها و فرم‌ها" text="دکمه‌ها همه قرصی‌اند؛ حالت فوکوس با حلقه‌ی آبی و فقط برای وضعیت انتخاب." />
      <div className="fgrid">
        <div className="panel"><h4>دکمه‌ها</h4>
          <div className="btnrow"><button className="btn btn-p">اقدام اصلی</button><button className="btn btn-s">اقدام ثانویه</button><button className="btn btn-t">نیمه‌شفاف</button><button className="btn btn-p" disabled>غیرفعال</button></div>
          <div className="btnrow" style={{ marginTop: 16 }}><button className="ic" aria-label="جستجو"><Search size={18} /></button><button className="ic" aria-label="حذف"><Trash2 size={18} /></button><button className="ic" aria-label="علاقه‌مندی"><Heart size={18} /></button></div>
          <h4 style={{ marginTop: 26 }}>انتخاب و نشان‌ها</h4>
          <div className="btnrow"><button className="chip" aria-pressed="true">انتخاب‌شده</button><button className="chip" aria-pressed="false">عادی</button><span className="pill">جدید</span><span className="pill hot">۲۰٪ تخفیف</span><span className="st"><i style={{ background: 'var(--ok)' }} />موجود</span></div>
        </div>
        <div className="panel"><h4>فرم‌ها</h4>
          <label className="field"><span>نام و نام خانوادگی</span><input className="inp" id="f-name" defaultValue="علی رضایی" /></label>
          <label className="field"><span>ایمیل</span><input className={`inp ${email.includes('@') ? '' : 'bad'}`} id="f-mail" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />{!email.includes('@') && <i className="err">ایمیل معتبر نیست</i>}</label>
          <label className="field"><span>استان</span><select className="inp" id="f-prov" defaultValue="تهران"><option>تهران</option><option>اصفهان</option><option>فارس</option></select></label>
          <div className="tog">ارسال اکسپرس<button className="sw-t" aria-pressed={tog} aria-label="ارسال اکسپرس" onClick={() => setTog(!tog)}><i /></button></div>
          <div className="tog">دریافت خبرنامه<button className="sw-t" aria-pressed={tog2} aria-label="خبرنامه" onClick={() => setTog2(!tog2)}><i /></button></div>
        </div>
      </div>
    </section>
  );
}

function CartPreview() {
  const items = [products[0], products[8], products[11]];
  const [step, setStep] = useState(0);
  const sub = items.reduce((s, p) => s + (p.oldPrice ?? p.price), 0); const pay = items.reduce((s, p) => s + p.price, 0);
  return (
    <section className="sec wrap">
      <Head tag="۰۶ · Cart / Checkout" title="سبد خرید و تسویه حساب" />
      <div className="steps">{['اطلاعات مشتری', 'آدرس', 'روش ارسال', 'پرداخت', 'بررسی'].map((s, i) => <button key={s} className="chip" aria-pressed={step === i} onClick={() => setStep(i)}>{toFa(i + 1)}. {s}</button>)}</div>
      <div className="cc">
        <div className="panel"><h4>سبد خرید ({toFa(items.length)} کالا)</h4>
          {items.map((p) => (
            <div className="line" key={p.id}><div className="t"><ProductArt kind={p.art} color={p.colors[0].name === 'شفاف' ? '#6a4cf5' : p.colors[0].hex} className="" /></div>
              <div className="b"><h5>{p.name}</h5><small>{p.models[0]} · {p.colors[0].name}</small><span className="price">{formatPrice(p.price)}</span></div>
              <div className="qty"><button className="ic" aria-label="کاهش"><Minus size={14} /></button><b>{toFa(1)}</b><button className="ic" aria-label="افزایش"><Plus size={14} /></button></div></div>
          ))}
        </div>
        <div className="panel sum"><h4>خلاصه سفارش</h4>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{formatPrice(350_000 - 120_000)} تا ارسال رایگان</div><div className="bar"><i style={{ width: '66%' }} /></div>
          <div className="coupon"><input className="inp" id="coupon" placeholder="کد تخفیف" /><button className="btn btn-s">ثبت</button></div>
          <div className="r"><span>جمع محصولات</span><b>{formatPrice(sub)}</b></div><div className="r"><span>تخفیف</span><b style={{ color: 'var(--coral)' }}>− {formatPrice(sub - pay)}</b></div><div className="r"><span>هزینه ارسال</span><b>{formatPrice(45_000)}</b></div>
          <div className="r tot"><span>مبلغ نهایی</span><span>{formatPrice(pay + 45_000)}</span></div>
          <button className="btn btn-p btn-lg" style={{ width: '100%', marginTop: 16 }}>ادامه فرآیند خرید</button>
        </div>
      </div>
    </section>
  );
}

const Footer = () => (
  <footer className="foot"><div className="wrap">
    <div className="fcols">
      <div><a className="logo" href="#top" style={{ color: '#fff' }}><i />CaseLine</a><p style={{ fontSize: 13, lineHeight: 1.9, maxWidth: 320 }}>فروشگاه نسل جدید قاب گوشی و لوازم جانبی موبایل؛ برای کسانی که متفاوت انتخاب می‌کنند.</p>
        <form className="news" onSubmit={(e) => e.preventDefault()}><input className="inp" id="news" dir="ltr" placeholder="ایمیل شما" style={{ textAlign: 'right' }} /><button className="btn btn-p">عضویت</button></form></div>
      <div><h5>فروشگاه</h5><a href="#top">قاب گوشی</a><a href="#top">محافظ صفحه</a><a href="#top">شارژر</a><a href="#top">کابل</a></div>
      <div><h5>پشتیبانی</h5><a href="#top">تماس با ما</a><a href="#top">سوالات متداول</a><a href="#top">شرایط ارسال</a><a href="#top">شرایط بازگشت</a></div>
      <div><h5>شبکه‌ها</h5><a href="#top">Instagram</a><a href="#top">Telegram</a><a href="#top">TikTok</a></div>
    </div>
    <div className="copy">© تمامی حقوق برای CaseLine محفوظ است.</div>
  </div></footer>
);

function Admin() {
  const nav = [['داشبورد', LayoutDashboard], ['محصولات', Package], ['سفارش‌ها', Tag], ['مشتریان', Users], ['موجودی', Boxes], ['گزارش‌ها', BarChart3], ['تنظیمات', Settings]] as const;
  const data = [34, 52, 41, 68, 59, 83, 76, 95, 88, 112];
  const W = 460, H = 150, max = 120;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * W, H - (v / max) * H] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const rows = [['CL-10501', 'مینا کریمی', 1_295_000, 'در انتظار پرداخت', 'var(--orange)'], ['CL-10495', 'رضا نادری', 1_485_000, 'در حال آماده‌سازی', 'var(--blue)'], ['CL-10482', 'علی رضایی', 1_125_000, 'ارسال شد', 'var(--magenta)'], ['CL-10391', 'سارا محمدی', 1_395_000, 'تحویل داده شد', 'var(--ok)']] as const;
  return (
    <section className="sec wrap">
      <Head tag="۰۷ · Admin Dashboard" title="نمونه پنل مدیریت" text="سبک Linear روی همان سطح‌بندی تیره: کارت‌های ۱۵ پیکسلی، مرز نازک و وضعیت با نقطه‌ی رنگی." />
      <div className="adm">
        <aside className="side">{nav.map(([l, I], i) => <a key={l} href="#top" aria-current={i === 0 ? 'page' : undefined}><I size={16} />{l}</a>)}</aside>
        <div className="main">
          <div className="atop"><h4>داشبورد</h4><div className="btnrow"><button className="btn btn-s">۷ روز گذشته</button><button className="btn btn-p"><Plus size={16} />محصول جدید</button></div></div>
          <div className="kpis">{[['درآمد', formatPrice(18_450_000), '+۱۲٪', ''], ['سفارش‌ها', toFa(128), '+۸٪', ''], ['مشتریان جدید', toFa(41), '+۵٪', ''], ['هشدار موجودی', toFa(4), 'نیاز به بررسی', 'w']].map(([k, v, d, c]) => <div className="kpi" key={k}><small>{k}</small><b>{v}</b><em className={c}>{d}</em></div>)}</div>
          <div className="two">
            <div className="card2"><h5>فروش روزانه (میلیون تومان)</h5>
              <svg viewBox={`-6 -8 ${W + 12} ${H + 28}`} role="img" aria-label="نمودار فروش" style={{ width: '100%' }}>
                <defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6a4cf5" stopOpacity=".45" /><stop offset="1" stopColor="#6a4cf5" stopOpacity="0" /></linearGradient></defs>
                {[0, 40, 80, 120].map((g) => <line key={g} x1="0" x2={W} y1={H - (g / max) * H} y2={H - (g / max) * H} stroke="#262626" strokeWidth="1" />)}
                <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#ar)" /><path d={line} fill="none" stroke="#8a73ff" strokeWidth="2.5" strokeLinejoin="round" />
                <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="5" fill="#fff" stroke="#6a4cf5" strokeWidth="3" />
              </svg></div>
            <div className="card2"><h5>موجودی کم</h5>{products.filter((p) => p.stock - p.reserved <= p.minStock).slice(0, 4).map((p) => <div className="low" key={p.id}><span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span><span className="st"><i style={{ background: p.stock === 0 ? 'var(--coral)' : 'var(--orange)' }} />{p.stock === 0 ? 'ناموجود' : `${toFa(p.stock)} عدد`}</span></div>)}</div>
          </div>
          <div className="card2"><h5>آخرین سفارش‌ها</h5><div className="tbl"><table><thead><tr><th>سفارش</th><th>مشتری</th><th>مبلغ</th><th>وضعیت</th></tr></thead><tbody>{rows.map(([id, n, a, s, c]) => <tr key={id}><td dir="ltr" style={{ textAlign: 'right' }}>{id}</td><td>{n}</td><td>{formatPrice(a)}</td><td><span className="st"><i style={{ background: c }} />{s}</span></td></tr>)}</tbody></table></div></div>
        </div>
      </div>
    </section>
  );
}

export default function DesignDemo() {
  useSEO({ title: 'Design System Demo' });
  return (
    <div className="fd" dir="rtl">
      <Tag_Bar />
      <Header /><Hero /><Categories /><Products /><Detail /><Forms /><CartPreview /><Admin /><Footer />
    </div>
  );
}
function Tag_Bar() {
  return <div style={{ background: 'var(--s1)', fontSize: 12, textAlign: 'center', padding: '8px 16px', color: 'var(--muted)' }}>دموی Design System — پایه: Framer DESIGN.md + لایه‌ی سازگاری CaseLine · همه بخش‌ها نمایشی هستند</div>;
}
