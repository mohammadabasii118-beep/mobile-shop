import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, BarChart3, Boxes, Check, ChevronDown, Grid2X2, Heart, Home, LayoutDashboard, Menu, Minus, Package, Plus, Search, Settings, ShoppingBag, SlidersHorizontal, ArrowDownUp, Star, Tag, Trash2, User, Users, X, AlertTriangle, MoreHorizontal } from 'lucide-react';
import '@/features/design-demo/design-demo.css';
import { products } from '@/data/products';
import { categories } from '@/data/categories';
import { ProductArt } from '@/components/ProductArt';
import { discountPercent, formatPrice, toFa } from '@/utils/format';
import { useSEO } from '@/utils/seo';
import type { ArtKind, Product } from '@/types';
import { buildVariants, variantAvailable, variantPrice } from '@/data/variants';

const HeroProduct3D = lazy(() => import('@/three/HeroProduct3D'));
const artOf: Record<string, ArtKind> = { cases: 'case', 'screen-protectors': 'glass', chargers: 'charger', cables: 'cable', 'power-banks': 'powerbank', accessories: 'holder' };
const artColor = (p: Product) => (p.colors[0].name === 'شفاف' || p.colors[0].name === 'سفید' ? '#7357f6' : p.colors[0].hex);

const Head = ({ tag, title, text }: { tag: string; title: string; text?: string }) => (
  <div className="head"><div className="tag">{tag}</div><h2 className="h-lg">{title}</h2>{text && <p className="lead">{text}</p>}</div>
);

/* ───────── Header + mobile bottom bar ───────── */
function Header() {
  const [open, setOpen] = useState(false);
  const links = ['خانه', 'فروشگاه', 'قاب گوشی', 'لوازم جانبی', 'محصولات جدید', 'پرفروش‌ها'];
  return (
    <>
      <header className="nav">
        <div className="wrap in">
          <a href="#top" className="logo"><i />CaseLine</a>
          <nav className="links" aria-label="منوی اصلی">{links.map((l, i) => <a key={l} href="#shop" aria-current={i === 1 ? 'page' : undefined}>{l}</a>)}</nav>
          <div className="acts">
            <button className="ic" aria-label="جستجو"><Search size={18} /></button>
            <a className="ic acct" href="#top" aria-label="حساب کاربری"><User size={18} /></a>
            <button className="ic" aria-label="علاقه‌مندی‌ها"><Heart size={18} /></button>
            <button className="ic" aria-label="سبد خرید"><ShoppingBag size={18} /><span className="cnt">{toFa(2)}</span></button>
            <button className="ic burger" aria-label="منو" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={18} /> : <Menu size={18} />}</button>
          </div>
        </div>
        <div className={`drawer ${open ? 'open' : ''}`}>{links.map((l) => <a key={l} href="#top" onClick={() => setOpen(false)}>{l}</a>)}</div>
      </header>
      <nav className="bbar" aria-label="ناوبری موبایل">
        {[[Home, 'خانه'], [Grid2X2, 'دسته‌ها'], [Search, 'جستجو'], [ShoppingBag, 'سبد'], [User, 'حساب']].map(([I, l], i) => { const Ic = I as typeof Home; return <a key={l as string} href="#top" aria-current={i === 0 ? 'page' : undefined}><Ic size={20} />{l as string}</a>; })}
      </nav>
    </>
  );
}

/* ───────── Hero ───────── */
function Hero() {
  return (
    <section className="hero wrap" id="top">
      <div className="tag" style={{ marginBlockEnd: 16 }}>کالکشن جدید ۱۴۰۵</div>
      <div className="hero-grid">
        <div>
          <h1>قاب گوشی،<br /><span className="grad">استایل تو.</span></h1>
          <p className="lead">قاب‌های خاص و لوازم جانبی موبایل برای کسانی که متفاوت انتخاب می‌کنند.</p>
          <div className="cta-row"><a className="btn btn-p btn-lg" href="#shop">مشاهده فروشگاه<ArrowLeft size={18} /></a><a className="btn btn-s btn-lg" href="#shop">محصولات جدید</a></div>
          <div className="stats"><div><b className="num">{toFa(20000)}+</b><span className="cap">مشتری راضی</span></div><div><b className="num">{toFa(48)}٪</b><span className="cap">تخفیف تا</span></div><div><b className="num">{toFa(2)} روز</b><span className="cap">ارسال سریع</span></div></div>
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="spot sp-v" style={{ minHeight: 300 }}>
            <span className="badge" style={{ background: 'rgba(255,255,255,.2)', color: '#fff', alignSelf: 'flex-start' }}>پرفروش این هفته</span>
            <div className="copy"><b>قاب شفاف مگ‌سیف</b><p>آیفون ۱۶ پرو مکس</p><a className="btn btn-p" style={{ marginBlockStart: 14 }} href="#shop">خرید محصول</a></div>
            <ProductArt kind="case" color="#ec4899" className="art" />
          </div>
        </div>
      </div>
      <div className="stage3d" aria-label="گوشی سه‌بعدی"><Suspense fallback={null}><HeroProduct3D className="absolute inset-0 h-full w-full" color="#7357f6" /></Suspense></div>
    </section>
  );
}

const Categories = () => (
  <section className="sec wrap">
    <Head tag="دسته‌بندی · §6.5" title="دسته‌بندی محصولات" />
    <div className="cats">
      {categories.map((c, i) => (
        <a key={c.slug} href="#shop" className={`cat ${i === 0 ? 'spot sp-v' : ''}`}>
          <span className="n">{toFa(i + 1).padStart(2, '۰')}</span>
          <div className="txt"><h3>{c.name}</h3><p>{c.description}</p></div>
          <ProductArt kind={artOf[c.slug]} color={i === 0 ? '#fff' : c.hue} className="art" />
        </a>
      ))}
    </div>
  </section>
);

/* ───────── Product card (borderless) ───────── */
export function Card({ p }: { p: Product }) {
  const [fav, setFav] = useState(false);
  const off = discountPercent(p.price, p.oldPrice);
  const out = p.stock <= 0; const low = p.stock > 0 && p.stock <= 10;
  return (
    <article className={`pcard ${out ? 'out' : ''}`}>
      <div className="tw">
      <a href="#shop" className="tile" aria-label={p.name}>
        <ProductArt kind={p.art} color={artColor(p)} className="" />
        <div className="bd">{off > 0 && <span className="badge b-off">{toFa(off)}٪ تخفیف</span>}{p.isBestseller && <span className="badge b-best">پرفروش</span>}{p.isNew && !off && <span className="badge">جدید</span>}</div>
        {out && <div className="out-pill"><span>ناموجود</span></div>}
      </a>
      <button className="fav" aria-pressed={fav} aria-label="علاقه‌مندی" onClick={() => setFav(!fav)}><Heart size={17} /></button>
      {!out && <button className="add" aria-label="افزودن به سبد"><Plus size={20} /></button>}
      </div>
      <div className="info">
        {p.colors.length > 1 && <div className="dots">{p.colors.slice(0, 4).map((c) => <i key={c.name} style={{ background: c.hex }} />)}{p.colors.length > 4 && <span>+{toFa(p.colors.length - 4)}</span>}</div>}
        <h4>{p.name}</h4>
        <div className="cap">{categories.find((c) => c.slug === p.category)?.name} · <span className="stars" style={{ display: 'inline-flex', gap: 3 }}><Star size={11} fill="currentColor" />{p.rating.toLocaleString('fa-IR')}</span> ({toFa(p.reviewCount)})</div>
        <div className="pr"><span className="price num">{formatPrice(p.price)}</span>{p.oldPrice && <span className="old num">{formatPrice(p.oldPrice)}</span>}</div>
        <span className={`stock ${out ? 's-out' : low ? 's-low' : 's-in'}`}><i />{out ? 'ناموجود' : low ? `فقط ${toFa(p.stock)} عدد` : 'موجود'}</span>
      </div>
    </article>
  );
}

/* ───────── Shop: filters + grid ───────── */
type F = { cats: string[]; stock: boolean; disc: boolean; max: number; sort: string };
const sorts = [['popular', 'پرفروش‌ترین'], ['new', 'جدیدترین'], ['cheap', 'ارزان‌ترین'], ['expensive', 'گران‌ترین'], ['discount', 'بیشترین تخفیف']];

function Ck({ on, label, count, onClick }: { on: boolean; label: string; count?: number; onClick: () => void }) {
  return <button className="ck" aria-pressed={on} onClick={onClick}><span className="bx">{on && <Check size={13} />}</span>{label}{count !== undefined && <span className="ct">({toFa(count)})</span>}</button>;
}
function Tog({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return <div className="tog">{label}<button className="sw-t" aria-pressed={on} aria-label={label} onClick={onClick}><i /></button></div>;
}
function FilterBody({ f, set }: { f: F; set: (p: Partial<F>) => void }) {
  const toggle = (s: string) => set({ cats: f.cats.includes(s) ? f.cats.filter((x) => x !== s) : [...f.cats, s] });
  return (
    <>
      <div className="fg"><h4>دسته‌بندی</h4>{categories.map((c) => <Ck key={c.slug} on={f.cats.includes(c.slug)} label={c.name} count={products.filter((p) => p.category === c.slug).length} onClick={() => toggle(c.slug)} />)}</div>
      <div className="fg"><h4>رنگ</h4><div className="swgrid">{['#1a1a1d', '#cfd8df', '#7357f6', '#ec4899', '#ff8a3d', '#38bdf8'].map((h, i) => <button key={h} className="swc" aria-label={`رنگ ${toFa(i + 1)}`} aria-pressed={i === 2} style={{ background: h }} />)}</div></div>
      <div className="fg"><h4>مدل گوشی</h4><div className="rowc">{['آیفون ۱۶', 'آیفون ۱۵', 'سامسونگ S25'].map((m, i) => <button key={m} className="chip" aria-pressed={i === 0}>{m}</button>)}</div></div>
      <div className="fg"><h4><span>حداکثر قیمت</span><span className="num" style={{ color: 'var(--muted)', fontWeight: 500 }}>{formatPrice(f.max)}</span></h4><input className="range" type="range" min={100000} max={2000000} step={50000} value={f.max} onChange={(e) => set({ max: +e.target.value })} aria-label="حداکثر قیمت" /></div>
      <div className="fg" style={{ borderBlockEnd: 0 }}><Tog on={f.stock} label="فقط کالاهای موجود" onClick={() => set({ stock: !f.stock })} /><Tog on={f.disc} label="فقط تخفیف‌دار" onClick={() => set({ disc: !f.disc })} /></div>
    </>
  );
}
function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="sheet-bg" onClick={onClose}><div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
      <div className="grab" /><header><h3>{title}</h3><button className="ic" aria-label="بستن" onClick={onClose}><X size={18} /></button></header>
      <div className="body">{children}</div>{footer && <footer>{footer}</footer>}
    </div></div>
  );
}

function Shop() {
  const [f, setF] = useState<F>({ cats: [], stock: false, disc: false, max: 2_000_000, sort: 'popular' });
  const [sheet, setSheet] = useState<null | 'filter' | 'sort'>(null);
  const set = (p: Partial<F>) => setF((s) => ({ ...s, ...p }));
  const list = useMemo(() => {
    const r = products.filter((p) => (!f.cats.length || f.cats.includes(p.category)) && p.price <= f.max && (!f.stock || p.stock > 0) && (!f.disc || discountPercent(p.price, p.oldPrice) > 0));
    const k: Record<string, (p: Product) => number> = { popular: (p) => -p.reviewCount, new: (p) => (p.isNew ? 0 : 1), cheap: (p) => p.price, expensive: (p) => -p.price, discount: (p) => -discountPercent(p.price, p.oldPrice) };
    return [...r].sort((a, b) => k[f.sort](a) - k[f.sort](b));
  }, [f]);
  const active = f.cats.length + +f.stock + +f.disc + +(f.max < 2_000_000);
  const reset = () => setF({ cats: [], stock: false, disc: false, max: 2_000_000, sort: f.sort });
  return (
    <section className="sec wrap" id="shop">
      <Head tag="فروشگاه · Product Grid + Filter · §6.4" title="فروشگاه" text="فیلتر کنار صفحه در دسکتاپ، Bottom Sheet در موبایل، شبکه‌ی ۲ ستونه برای محصولات." />
      <div className="mbar"><button className="btn btn-s" style={{ flex: 1 }} onClick={() => setSheet('filter')}><SlidersHorizontal size={16} />فیلتر{active > 0 && ` (${toFa(active)})`}</button><button className="btn btn-s" style={{ flex: 1 }} onClick={() => setSheet('sort')}><ArrowDownUp size={16} />مرتب‌سازی</button></div>
      <div className="shop">
        <aside className="rail" aria-label="فیلترها"><FilterBody f={f} set={set} /></aside>
        <div style={{ minWidth: 0 }}>
          <div className="toolbar">
            <span className="cap" style={{ marginInlineEnd: 6 }}>{toFa(list.length)} محصول</span>
            {f.cats.map((c) => <button key={c} className="chip x" onClick={() => set({ cats: f.cats.filter((x) => x !== c) })}>{categories.find((k) => k.slug === c)?.name}<X size={14} /></button>)}
            {f.stock && <button className="chip x" onClick={() => set({ stock: false })}>موجود<X size={14} /></button>}
            {f.disc && <button className="chip x" onClick={() => set({ disc: false })}>تخفیف‌دار<X size={14} /></button>}
            {active > 0 && <button className="cap" style={{ textDecoration: 'underline', color: 'var(--text)' }} onClick={reset}>پاک کردن همه</button>}
            <div className="sort-d"><select className="inp" aria-label="مرتب‌سازی" style={{ borderRadius: 100, minWidth: 180 }} value={f.sort} onChange={(e) => set({ sort: e.target.value })}>{sorts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          </div>
          {list.length ? <div className="grid g4">{list.slice(0, 12).map((p) => <Card key={p.id} p={p} />)}</div> : <div className="panel" style={{ textAlign: 'center' }}>محصولی با این فیلترها پیدا نشد.</div>}
        </div>
      </div>
      {sheet === 'filter' && <Sheet title="فیلترها" onClose={() => setSheet(null)} footer={<><button className="btn btn-p" onClick={() => setSheet(null)}>نمایش {toFa(list.length)} محصول</button><button className="btn btn-s" style={{ flex: 'none' }} onClick={reset}>پاک کردن</button></>}><FilterBody f={f} set={set} /></Sheet>}
      {sheet === 'sort' && <Sheet title="مرتب‌سازی" onClose={() => setSheet(null)}>{sorts.map(([k, l]) => <button key={k} className="rad" onClick={() => { set({ sort: k }); setSheet(null); }}>{l}{f.sort === k && <Check size={18} />}</button>)}</Sheet>}
    </section>
  );
}

/* ───────── Product detail ───────── */
function Detail() {
  const p = products[0];
  const variants = useMemo(() => buildVariants(p, [], true), [p]);
  const [mi, setMi] = useState(0); const [ci, setCi] = useState(0); const [q, setQ] = useState(1); const [shot, setShot] = useState(0); const [acc, setAcc] = useState(0); const [added, setAdded] = useState(false);
  const find = (m: number, c: number) => variants.find((v) => v.model === p.models[m] && v.color.name === p.colors[c].name)!;
  const v = find(mi, ci); const avail = variantAvailable(v); const price = variantPrice(p, v); const out = avail <= 0; const low = avail > 0 && avail <= 5;
  const pickModel = (m: number) => { setMi(m); if (variantAvailable(find(m, ci)) <= 0) { const alt = p.colors.findIndex((_, c) => variantAvailable(find(m, c)) > 0); if (alt >= 0) setCi(alt); } setQ(1); };
  const hex = p.colors[ci].hex; const art = ['#cfd8df', '#f1f5f9'].includes(hex) ? '#9fb4c4' : hex;
  return (
    <section className="sec wrap">
      <Head tag="صفحه محصول · واریانت مدل × رنگ · §6.4" title="جزئیات محصول" text="هر ترکیب مدل گوشی و رنگ، SKU، موجودی و قیمت خودش را دارد. ترکیب‌های ناموجود خط‌خورده نشان داده می‌شوند." />
      <div className="pd">
        <div className="gal"><div className="stage"><ProductArt kind="case" color={art} className="" /></div>
          <div className="thumbs">{[0, 1, 2, 3].map((i) => <button key={i} aria-pressed={shot === i} aria-label={`تصویر ${toFa(i + 1)}`} onClick={() => setShot(i)}><ProductArt kind="case" color={art} className="" /></button>)}</div></div>
        <div>
          <div className="btnrow"><span className="badge b-best">پرفروش</span><span className="badge b-off">{toFa(22)}٪ تخفیف</span><span className="badge b-ship">ارسال رایگان</span></div>
          <h3>{p.name}</h3>
          <div className="stars"><Star size={14} fill="currentColor" />{(4.8).toLocaleString('fa-IR')} <span>· {toFa(214)} نظر</span></div>
          <div className="big-price num">{formatPrice(price)}<span className="old" style={{ fontSize: 15, fontWeight: 400 }}>{formatPrice(p.oldPrice!)}</span></div>
          <span className={`stock ${out ? 's-out' : low ? 's-low' : 's-in'}`}><i />{out ? 'این ترکیب ناموجود است' : low ? `فقط ${toFa(avail)} عدد از این ترکیب باقی مانده` : 'موجود در انبار — ارسال امروز'}</span>
          <p className="lead" style={{ fontSize: 15, marginBlockStart: 12 }}>{p.description}</p>
          <div className="opt"><label>مدل گوشی: <span className="vlab">{p.models[mi]}</span></label><div className="rowc">{p.models.map((m, i) => { const none = p.colors.every((_, c) => variantAvailable(find(i, c)) <= 0); return <button key={m} className="chip" aria-pressed={mi === i} data-out={none} onClick={() => pickModel(i)}>{m}</button>; })}</div></div>
          <div className="opt"><label>رنگ: <span className="vlab">{p.colors[ci].name}</span></label><div className="rowc">{p.colors.map((c, i) => <button key={c.name} className="sw" aria-label={`${c.name}${variantAvailable(find(mi, i)) <= 0 ? ' (ناموجود)' : ''}`} aria-pressed={ci === i} data-out={variantAvailable(find(mi, i)) <= 0} onClick={() => { setCi(i); setQ(1); }} style={{ background: c.hex }} />)}</div></div>
          <div className="vmeta"><span>SKU: <span className="mono">{v.sku}</span></span><span>مدل × رنگ: {p.models[mi]} · {p.colors[ci].name}</span></div>
          <div className="opt"><label>تعداد</label><div className="qty"><button className="ic" aria-label="افزایش" onClick={() => setQ(Math.min(Math.max(avail, 1), q + 1))}><Plus size={16} /></button><b className="num">{toFa(q)}</b><button className="ic" aria-label="کاهش" onClick={() => setQ(Math.max(1, q - 1))}><Minus size={16} /></button></div></div>
          <div className="btnrow" style={{ marginBlockStart: 24 }}>
            <button className="btn btn-p btn-lg" style={{ flex: 1 }} disabled={out} onClick={() => { setAdded(true); setTimeout(() => setAdded(false), 1800); }}>{out ? 'ناموجود در این ترکیب' : added ? 'به سبد اضافه شد ✓' : 'افزودن به سبد'}</button>
            {out ? <button className="btn btn-s btn-lg" style={{ flex: 1 }}>خبرم کن</button> : <button className="btn btn-s btn-lg" style={{ flex: 1 }}>خرید فوری</button>}</div>
          <div className="infos"><div><b>ارسال سریع</b>تهران ۱ تا ۲ روز، شهرستان ۲ تا ۵ روز</div><div><b>بازگشت کالا</b>تا ۷ روز با شرایط بازگشت</div></div>
          <div className="disc">{[['توضیحات', p.description], ['مشخصات', 'جنس: TPU و پلی‌کربنات · وزن ۳۲ گرم · سازگار با شارژ بی‌سیم'], ['نظرات (۲۱۴)', 'میانگین امتیاز ۴٫۸ از ۵']].map(([t, d], i) => (
            <div key={t}><button onClick={() => setAcc(acc === i ? -1 : i)}>{t}<ChevronDown size={18} style={{ transform: acc === i ? 'rotate(180deg)' : 'none' }} /></button>{acc === i && <p>{d}</p>}</div>))}</div>
        </div>
      </div>
    </section>
  );
}

/* ───────── Tokens + forms + badges + modal ───────── */
function Tokens() {
  const colors: [string, string, string][] = [['canvas', '#0C0C0C', 'پس‌زمینه'], ['surface-1', '#141416', 'پنل'], ['surface-2', '#1C1C1F', 'تایل محصول'], ['surface-3', '#26262B', 'فشرده'], ['text', '#D7E2EA', 'متن اصلی'], ['text-muted', '#868C91', 'ثانویه'], ['violet', '#7357F6', 'برند'], ['pink', '#EC4899', 'سرخابی'], ['orange', '#FF8A3D', 'برند'], ['success', '#22C55E', 'موجود'], ['warning', '#FFB020', 'کم'], ['danger', '#FF5577', 'تخفیف']];
  return (
    <section className="sec wrap">
      <Head tag="Design Tokens · §2–§3" title="رنگ و تایپوگرافی" />
      <div className="swatches">{colors.map(([n, h, d]) => <div className="sw-card" key={n}><i style={{ background: h }} /><div><b className="ltr">{n}</b><span className="ltr" style={{ display: 'block' }}>{h}</span><span>{d}</span></div></div>)}</div>
      <div className="two" style={{ marginBlockStart: 24 }}>
        <div className="panel"><h4>مقیاس تایپوگرافی (Vazirmatn)</h4><div className="tscale">
          <div><span style={{ fontSize: 40, fontWeight: 900, lineHeight: 1.1 }}>قاب گوشی</span><small>display 64→36 / 900</small></div>
          <div><span style={{ fontSize: 28, fontWeight: 800 }}>دسته‌بندی محصولات</span><small>h1 32→26 / 800</small></div>
          <div><span style={{ fontSize: 18, fontWeight: 700 }}>قاب ضدضربه آیفون ۱۶ پرو</span><small>h3 18 / 700</small></div>
          <div><span style={{ fontSize: 15, fontWeight: 400, color: 'var(--text)' }}>متن اصلی با رنگ #D7E2EA و ارتفاع خط ۱٫۸</span><small>body 15 / 400</small></div>
          <div><span style={{ fontSize: 12, color: 'var(--muted)' }}>برچسب و توضیح کوتاه</span><small>caption 12 / 500</small></div>
          <div><span className="num" style={{ fontSize: 26, fontWeight: 900 }}>{formatPrice(1_250_000)}</span><small>price-lg 28 / 900</small></div></div></div>
        <div className="panel"><h4>Badge و وضعیت موجودی</h4>
          <div className="btnrow"><span className="badge b-off">{toFa(22)}٪ تخفیف</span><span className="badge b-best">پرفروش</span><span className="badge">جدید</span><span className="badge b-ship">ارسال رایگان</span><span className="badge b-low">محدود</span></div>
          <div className="btnrow" style={{ marginBlockStart: 16 }}><span className="stock s-in"><i />موجود</span><span className="stock s-low"><i />فقط {toFa(3)} عدد</span><span className="stock s-out"><i />ناموجود</span></div>
          <h4 style={{ marginBlockStart: 24 }}>قیمت</h4><div className="pr" style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}><span className="price num" style={{ fontSize: 22, fontWeight: 900 }}>{formatPrice(690_000)}</span><span className="old num">{formatPrice(890_000)}</span><span className="badge b-off">{toFa(22)}٪</span></div></div>
      </div>
    </section>
  );
}

function Forms() {
  const [tog, setTog] = useState(true); const [email, setEmail] = useState('abc'); const [modal, setModal] = useState(false);
  return (
    <section className="sec wrap">
      <Head tag="Buttons · Forms · Modal · §6.1–6.2, §6.6" title="دکمه‌ها و فرم‌ها" text="همه‌ی CTAها قرصی‌اند؛ فقط یک دکمه‌ی سفید اصلی در هر صفحه‌نمایش." />
      <div className="two">
        <div className="panel"><h4>دکمه‌ها</h4>
          <div className="btnrow"><button className="btn btn-p">اقدام اصلی</button><button className="btn btn-s">ثانویه</button><button className="btn btn-t">نیمه‌شفاف</button><button className="btn btn-d">حذف</button><button className="btn btn-p" disabled>غیرفعال</button></div>
          <div className="btnrow" style={{ marginBlockStart: 16 }}><button className="btn btn-p btn-lg">بزرگ</button><button className="btn btn-p btn-sm">کوچک (ادمین)</button><button className="ic" aria-label="جستجو"><Search size={18} /></button><button className="ic" aria-label="حذف"><Trash2 size={18} /></button></div>
          <h4 style={{ marginBlockStart: 26 }}>چیپ‌ها</h4><div className="btnrow"><button className="chip" aria-pressed="true">انتخاب‌شده</button><button className="chip" aria-pressed="false">عادی</button><button className="chip x">قاب گوشی<X size={14} /></button></div>
          <div className="btnrow" style={{ marginBlockStart: 22 }}><button className="btn btn-s" onClick={() => setModal(true)}>نمایش Modal / Bottom Sheet</button><span className="toast"><Check size={16} color="#22c55e" />محصول به سبد خرید اضافه شد.</span></div>
        </div>
        <div className="panel"><h4>فرم‌ها</h4>
          <label className="field"><span>نام و نام خانوادگی</span><input className="inp" id="f-name" defaultValue="علی رضایی" /></label>
          <label className="field"><span>ایمیل</span><input className={`inp ltr ${email.includes('@') ? '' : 'bad'}`} id="f-mail" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />{!email.includes('@') && <i className="err">ایمیل معتبر نیست</i>}</label>
          <label className="field"><span>استان</span><select className="inp" id="f-prov" defaultValue="تهران"><option>تهران</option><option>اصفهان</option><option>فارس</option></select></label>
          <label className="field"><span>جستجو</span><div className="search"><Search size={16} /><input className="inp" id="f-s" placeholder="جستجوی محصول…" /></div></label>
          <Tog on={tog} label="ارسال اکسپرس" onClick={() => setTog(!tog)} />
        </div>
      </div>
      {modal && <div className="modal-bg" onClick={() => setModal(false)}><div className="modal" role="dialog" aria-label="نمونه" onClick={(e) => e.stopPropagation()}><header><h3>حذف از علاقه‌مندی‌ها؟</h3><button className="ic" aria-label="بستن" onClick={() => setModal(false)}><X size={18} /></button></header><p className="lead" style={{ fontSize: 15 }}>این محصول از لیست علاقه‌مندی‌های شما حذف می‌شود. می‌توانید دوباره آن را اضافه کنید.</p><footer><button className="btn btn-p" onClick={() => setModal(false)}>تأیید</button><button className="btn btn-s" onClick={() => setModal(false)}>انصراف</button></footer></div></div>}
    </section>
  );
}

/* ───────── Cart / Checkout ───────── */
function CartPreview() {
  const items = [products[0], products[8], products[11]]; const [step, setStep] = useState(0);
  const sub = items.reduce((s, p) => s + (p.oldPrice ?? p.price), 0); const pay = items.reduce((s, p) => s + p.price, 0);
  return (
    <section className="sec wrap">
      <Head tag="Cart / Checkout · §6.4" title="سبد خرید و تسویه حساب" />
      <div className="steps">{['اطلاعات مشتری', 'آدرس', 'روش ارسال', 'پرداخت', 'بررسی'].map((s, i) => <button key={s} className="chip" aria-pressed={step === i} onClick={() => setStep(i)}>{toFa(i + 1)}. {s}</button>)}</div>
      <div className="cc">
        <div className="panel"><h4>سبد خرید ({toFa(items.length)} کالا)</h4>
          {items.map((p) => (<div className="line" key={p.id}><div className="t"><ProductArt kind={p.art} color={artColor(p)} className="" /></div>
            <div className="b"><h5>{p.name}</h5><span className="cap">{p.models[0]} · {p.colors[0].name}</span><span className="price num">{formatPrice(p.price)}</span></div>
            <div className="qty" style={{ alignSelf: 'flex-start' }}><button className="ic" aria-label="کاهش"><Minus size={14} /></button><b className="num">{toFa(1)}</b><button className="ic" aria-label="افزایش"><Plus size={14} /></button></div></div>))}
        </div>
        <div className="panel sum"><h4>خلاصه سفارش</h4>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }} className="num">{formatPrice(120_000)} تا ارسال رایگان</div><div className="bar"><i style={{ width: '66%' }} /></div>
          <div className="coupon"><input className="inp ltr" id="coupon" placeholder="کد تخفیف" /><button className="btn btn-s">ثبت</button></div>
          <div className="r"><span>جمع محصولات</span><b className="num">{formatPrice(sub)}</b></div><div className="r"><span>تخفیف</span><b className="num" style={{ color: 'var(--danger)' }}>− {formatPrice(sub - pay)}</b></div><div className="r"><span>هزینه ارسال</span><b className="num">{formatPrice(45_000)}</b></div>
          <div className="r tot"><span>مبلغ نهایی</span><span className="num">{formatPrice(pay + 45_000)}</span></div>
          <button className="btn btn-p btn-lg" style={{ width: '100%', marginBlockStart: 16 }}>ادامه فرآیند خرید</button>
        </div>
      </div>
    </section>
  );
}

const Footer = () => (
  <footer className="foot pad-b"><div className="wrap">
    <div className="fcols">
      <div><a className="logo" href="#top"><i />CaseLine</a><p style={{ fontSize: 13, lineHeight: 1.9, maxWidth: 320, marginBlockStart: 12 }}>فروشگاه نسل جدید قاب گوشی و لوازم جانبی موبایل؛ برای کسانی که متفاوت انتخاب می‌کنند.</p>
        <form className="news" onSubmit={(e) => e.preventDefault()}><input className="inp ltr" id="news" placeholder="ایمیل شما" /><button className="btn btn-p">عضویت</button></form></div>
      <div><h5>فروشگاه</h5><a href="#shop">قاب گوشی</a><a href="#shop">محافظ صفحه</a><a href="#shop">شارژر</a><a href="#shop">کابل</a></div>
      <div><h5>پشتیبانی</h5><a href="#top">تماس با ما</a><a href="#top">سوالات متداول</a><a href="#top">شرایط ارسال</a><a href="#top">شرایط بازگشت</a></div>
      <div><h5>شبکه‌ها</h5><a href="#top"><bdi>Instagram</bdi></a><a href="#top"><bdi>Telegram</bdi></a><a href="#top"><bdi>TikTok</bdi></a></div>
    </div>
    <div className="copyr">© تمامی حقوق برای CaseLine محفوظ است.</div>
  </div></footer>
);

/* ───────── Admin ───────── */
function Admin() {
  const [tab, setTab] = useState(0); const [edit, setEdit] = useState(false); const [sel, setSel] = useState<string[]>([]);
  const nav: [string, typeof Home][] = [['داشبورد', LayoutDashboard], ['محصولات', Package], ['سفارش‌ها', Tag], ['مشتریان', Users], ['موجودی', Boxes], ['گزارش‌ها', BarChart3], ['تنظیمات', Settings]];
  const data = [34, 52, 41, 68, 59, 83, 76, 95, 88, 112]; const W = 480, H = 150, max = 120;
  const pts = data.map((v, i) => [W - (i / (data.length - 1)) * W, H - (v / max) * H] as const); // latest point on the LEFT (RTL time axis)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const orders: [string, string, number, string, string][] = [['CL-10501', 'مینا کریمی', 1_295_000, 'در انتظار پرداخت', 'var(--warn)'], ['CL-10495', 'رضا نادری', 1_485_000, 'در حال آماده‌سازی', 'var(--blue)'], ['CL-10482', 'علی رضایی', 1_125_000, 'ارسال شد', 'var(--pink)'], ['CL-10391', 'سارا محمدی', 1_395_000, 'تحویل داده شد', 'var(--ok)'], ['CL-10277', 'پویا احمدی', 595_000, 'لغو شد', 'var(--danger)']];
  const lowStock = products.filter((p) => p.stock - p.reserved <= p.minStock).slice(0, 4);
  return (
    <section className="sec wrap">
      <Head tag="Admin Dashboard · §7 (Linear + Vercel × CaseLine)" title="نمونه پنل مدیریت" text="ساختار آرام و متراکم با سطح‌های تیره، تب‌های زیرخط‌دار، جدول داده و وضعیت با نقطه‌ی رنگی." />
      <div className="adm">
        <aside className="side"><span className="grp">فروشگاه</span>{nav.map(([l, I], i) => <a key={l} href="#admin" aria-current={i === 0 ? 'page' : undefined}><I size={16} />{l}</a>)}</aside>
        <div style={{ minWidth: 0 }} id="admin">
          <div className="atop"><div className="crumb"><span>CaseLine</span>/<b>داشبورد</b></div><div className="cmd"><Search size={14} />جستجو یا دستور…<kbd>⌘K</kbd></div><div className="av">ع</div></div>
          <div className="amain">
            <div className="ph"><div><h4>داشبورد</h4><p>خلاصه‌ی عملکرد ۷ روز گذشته</p></div><div className="btnrow"><button className="btn btn-s btn-sm">۷ روز گذشته<ChevronDown size={14} /></button><button className="btn btn-p btn-sm" onClick={() => setEdit(true)}><Plus size={14} />محصول جدید</button></div></div>
            <div className="tabs" role="tablist">{['نمای کلی', 'سفارش‌ها', 'موجودی'].map((t, i) => <button key={t} role="tab" aria-selected={tab === i} onClick={() => setTab(i)}>{t}</button>)}</div>
            <div className="kpis">{[['درآمد', formatPrice(18_450_000), '↑ ۱۲٪', 'var(--ok)'], ['سفارش‌ها', toFa(128), '↑ ۸٪', 'var(--ok)'], ['مشتریان جدید', toFa(41), '↓ ۳٪', 'var(--danger)'], ['هشدار موجودی', toFa(4), 'نیاز به بررسی', 'var(--warn)']].map(([k, v, d, c]) => <div className="kpi" key={k}><small>{k}</small><b>{v}</b><em style={{ color: c }}>{d}</em></div>)}</div>
            {tab !== 1 && <div className="a2">
              <div className="c2"><h5>فروش روزانه (میلیون تومان)</h5>
                <svg viewBox={`-6 -8 ${W + 12} ${H + 12}`} role="img" aria-label="نمودار فروش" style={{ width: '100%', display: 'block' }}>
                  <defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7357f6" stopOpacity=".45" /><stop offset="1" stopColor="#ec4899" stopOpacity="0" /></linearGradient></defs>
                  {[0, 40, 80, 120].map((g) => <line key={g} x1="0" x2={W} y1={H - (g / max) * H} y2={H - (g / max) * H} stroke="#26262b" strokeWidth="1" />)}
                  <path d={`${line} L0,${H} L${W},${H} Z`} fill="url(#ar)" /><path d={line} fill="none" stroke="#8e78ff" strokeWidth="2.5" strokeLinejoin="round" />
                  <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="5" fill="#fff" stroke="#7357f6" strokeWidth="3" />
                </svg></div>
              <div className="c2"><h5>موجودی کم</h5>{lowStock.map((p) => <div className="lowrow" key={p.id}><span>{p.name}</span><span className="st"><i style={{ background: p.stock === 0 ? 'var(--danger)' : 'var(--warn)' }} />{p.stock === 0 ? 'ناموجود' : `${toFa(p.stock)} عدد`}</span></div>)}</div>
            </div>}
            {tab === 2 && <div className="banner"><AlertTriangle size={18} /><span>{toFa(lowStock.length)} محصول به حداقل موجودی رسیده‌اند.</span><button className="btn btn-s btn-sm">ثبت سفارش خرید</button></div>}
            <div className="ftools"><div className="search" style={{ flex: 1, minWidth: 180 }}><Search size={16} /><input className="inp" id="a-s" placeholder="جستجوی سفارش یا مشتری" style={{ minHeight: 36 }} /></div><button className="chip">وضعیت<ChevronDown size={12} style={{ display: 'inline', marginInlineStart: 4 }} /></button><button className="chip">پرداخت</button></div>
            <div className="tbl"><table><thead><tr><th style={{ width: 44 }} /><th>سفارش</th><th>مشتری</th><th>مبلغ</th><th>وضعیت</th><th style={{ width: 52 }} /></tr></thead>
              <tbody>{orders.map(([id, n, a, s, c]) => <tr key={id}><td><button className="ck" aria-pressed={sel.includes(id)} aria-label="انتخاب" style={{ minHeight: 0 }} onClick={() => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id])}><span className="bx">{sel.includes(id) && <Check size={13} />}</span></button></td><td><span className="mono">{id}</span></td><td>{n}</td><td className="num">{formatPrice(a)}</td><td><span className="st"><i style={{ background: c }} />{s}</span></td><td><button className="ic" style={{ width: 32, height: 32, background: 'transparent' }} aria-label="بیشتر"><MoreHorizontal size={16} /></button></td></tr>)}</tbody></table></div>
            <div className="pager"><span className="num">{toFa(1)} – {toFa(5)} از {toFa(128)}</span><div className="btnrow"><button className="btn btn-s btn-sm" disabled>قبلی</button><button className="btn btn-s btn-sm">بعدی</button></div></div>
          </div>
        </div>
      </div>
      {edit && <div className="modal-bg" onClick={() => setEdit(false)}><div className="modal" role="dialog" aria-label="محصول جدید" onClick={(e) => e.stopPropagation()}><header><h3>محصول جدید</h3><button className="ic" aria-label="بستن" onClick={() => setEdit(false)}><X size={18} /></button></header>
        <label className="field"><span>نام محصول</span><input className="inp" id="m-name" placeholder="مثلاً قاب شفاف آیفون ۱۶" /></label>
        <div className="two"><label className="field"><span>قیمت (تومان)</span><input className="inp ltr" id="m-price" inputMode="numeric" placeholder="690000" /></label><label className="field"><span>SKU</span><input className="inp ltr" id="m-sku" placeholder="CL-CA-1000" /></label></div>
        <label className="field"><span>دسته‌بندی</span><select className="inp" id="m-cat">{categories.map((c) => <option key={c.slug}>{c.name}</option>)}</select></label>
        <footer><button className="btn btn-p btn-sm" onClick={() => setEdit(false)}>ذخیره</button><button className="btn btn-s btn-sm" onClick={() => setEdit(false)}>انصراف</button></footer></div></div>}
    </section>
  );
}

export default function DesignDemo() {
  useSEO({ title: 'Design System Demo' });
  return (
    <div className="fd" dir="rtl">
      <div style={{ background: 'var(--s1)', fontSize: 12, textAlign: 'center', padding: '8px 16px', color: 'var(--muted)' }}>دموی Design System CaseLine · بر اساس DESIGN.md · همه‌ی بخش‌ها نمایشی هستند</div>
      <Header /><Hero /><Tokens /><Categories /><Shop /><Detail /><Forms /><CartPreview /><Admin /><Footer />
    </div>
  );
}
