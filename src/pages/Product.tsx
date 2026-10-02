import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Box, Minus, Plus, RotateCcw, Truck, Image as ImageIcon } from 'lucide-react';
import { getProduct, products } from '@/data/products';
import { categories, categoryName } from '@/data/categories';
import { useShop } from '@/store';
import { discountPercent, toFa } from '@/utils/format';
import { useSEO } from '@/utils/seo';
import { flyToCart } from '@/utils/flyToCart';
import { ProductArt } from '@/components/ProductArt';
import { Price } from '@/components/Price';
import { Rating } from '@/components/Rating';
import { Badge } from '@/components/Badge';
import { WishlistButton } from '@/components/WishlistButton';
import { ProductCard } from '@/components/ProductCard';
import { SectionHeading } from '@/components/SectionHeading';

const ProductViewer3D = lazy(() => import('@/three/ProductViewer3D'));

export default function ProductPage() {
  const { slug } = useParams();
  const p = getProduct(slug ?? '');
  const nav = useNavigate();
  const addToCart = useShop((s) => s.addToCart);
  const [model, setModel] = useState(p?.models[0]);
  const [color, setColor] = useState(p?.colors[0].name);
  const [qty, setQty] = useState(1);
  const [view, setView] = useState<'img' | '3d'>('img');
  const [shot, setShot] = useState(0);

  const jsonLd = useMemo(() => p && ({
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.description, sku: p.sku, brand: { '@type': 'Brand', name: p.brand },
    aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating, reviewCount: p.reviewCount },
    offers: { '@type': 'Offer', priceCurrency: 'IRT', price: p.price, availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
  }), [p]);
  useSEO({ title: p?.name ?? 'محصول یافت نشد', description: p?.description, path: `/product/${slug}`, jsonLd });

  if (!p) return <div className="container-x pt-40 text-center"><h1 className="text-3xl font-black text-white">محصول پیدا نشد</h1><Link to="/shop" className="btn btn-primary mt-6">بازگشت به فروشگاه</Link></div>;
  const hex = p.colors.find((c) => c.name === color)?.hex ?? '#8B5CF6';
  const hue = categories.find((c) => c.slug === p.category)!.hue;
  const art = hex === '#cfd8df' || hex === '#f1f5f9' ? hue : hex;
  const related = products.filter((x) => x.category === p.category && x.id !== p.id).slice(0, 4);
  const off = discountPercent(p.price, p.oldPrice);
  const available = p.stock - p.reserved;

  return (
    <div className="container-x pb-10 pt-28 md:pt-36">
      <nav className="mb-6 flex gap-2 text-xs text-mist/50"><Link to="/">خانه</Link>/<Link to={`/category/${p.category}`}>{categoryName(p.category)}</Link>/<span className="text-mist">{p.name}</span></nav>
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-surface2 to-surface">
            {view === 'img' ? <ProductArt kind={p.art} color={art} className="h-full w-full p-10" /> : <Suspense fallback={<div className="grid h-full place-items-center text-mist/50">در حال بارگذاری…</div>}><ProductViewer3D art={p.art} color={art} /></Suspense>}
            <div className="absolute right-4 top-4 z-10 flex gap-2">{[['img', ImageIcon, 'تصویر'], ['3d', Box, 'سه‌بعدی']].map(([k, I, l]) => { const Ic = I as typeof Box; return <button key={k as string} onClick={() => setView(k as 'img' | '3d')} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold backdrop-blur ${view === k ? 'bg-white text-ink' : 'bg-black/50 text-white'}`}><Ic size={14} />{l as string}</button>; })}</div>
            <WishlistButton id={p.id} className="absolute left-4 top-4 z-10" />
          </div>
          <div className="mt-3 flex gap-3">{[0, 1, 2, 3].map((i) => <button key={i} onClick={() => { setShot(i); setView('img'); }} className={`aspect-square w-20 overflow-hidden rounded-2xl border bg-surface ${shot === i ? 'border-violet' : 'border-line'}`}><ProductArt kind={p.art} color={art} className="h-full w-full" /></button>)}</div>
        </div>
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">{p.isNew && <Badge tone="sky">جدید</Badge>}{p.isBestseller && <Badge tone="violet">پرفروش</Badge>}{off > 0 && <Badge tone="pink">{toFa(off)}٪ تخفیف</Badge>}<span className="text-xs text-mist/50">برند: {p.brand} · کد: {p.sku}</span></div>
          <h1 className="text-3xl font-black leading-snug text-white md:text-4xl">{p.name}</h1>
          <div className="flex items-center gap-4"><Rating value={p.rating} /><span className="text-xs text-mist/60">{toFa(p.reviewCount)} نظر</span></div>
          <Price price={p.price} oldPrice={p.oldPrice} size="lg" />
          <p className="leading-8 text-mist/70">{p.description}</p>
          <div><h4 className="mb-2 text-sm font-black text-white">مدل گوشی</h4><div className="flex flex-wrap gap-2">{p.models.map((m) => <button key={m} onClick={() => setModel(m)} className={`chip ${model === m ? 'chip-on' : 'text-mist/70'}`}>{m}</button>)}</div></div>
          <div><h4 className="mb-2 text-sm font-black text-white">رنگ: {color}</h4><div className="flex gap-3">{p.colors.map((c) => <button key={c.name} aria-label={c.name} onClick={() => setColor(c.name)} className={`h-9 w-9 rounded-full border-2 transition ${color === c.name ? 'scale-110 border-white' : 'border-white/20'}`} style={{ background: c.hex }} />)}</div></div>
          <div className="flex items-center gap-4">
            <div className="flex items-center rounded-full border border-line"><button aria-label="افزایش" className="grid h-11 w-11 place-items-center" onClick={() => setQty(Math.min(available, qty + 1))}><Plus size={16} /></button><span className="w-8 text-center font-black text-white">{toFa(qty)}</span><button aria-label="کاهش" className="grid h-11 w-11 place-items-center" onClick={() => setQty(Math.max(1, qty - 1))}><Minus size={16} /></button></div>
            <span className={`text-sm font-bold ${available > 10 ? 'text-emerald-400' : available > 0 ? 'text-amber' : 'text-red-400'}`}>{available > 10 ? 'موجود در انبار' : available > 0 ? `فقط ${toFa(available)} عدد باقی مانده` : 'ناموجود'}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <button disabled={available <= 0} className="btn btn-primary flex-1 !py-4" onClick={(e) => { flyToCart(e.currentTarget); addToCart(p.id, { model, color, quantity: qty }); }}>افزودن به سبد</button>
            <button disabled={available <= 0} className="btn btn-light flex-1 !py-4" onClick={() => { addToCart(p.id, { model, color, quantity: qty }); nav('/checkout'); }}>خرید فوری</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="card flex items-start gap-3 p-4"><Truck className="mt-0.5 text-violet" size={20} /><div><b className="text-sm text-white">ارسال سریع</b><p className="text-xs leading-6 text-mist/60">تهران ۱ تا ۲ روز، شهرستان ۲ تا ۵ روز کاری</p></div></div>
            <div className="card flex items-start gap-3 p-4"><RotateCcw className="mt-0.5 text-violet" size={20} /><div><b className="text-sm text-white">بازگشت کالا</b><p className="text-xs leading-6 text-mist/60">تا ۷ روز با شرایط بازگشت</p></div></div>
          </div>
        </div>
      </div>
      {related.length > 0 && <section className="mt-24"><SectionHeading title="محصولات مرتبط" /><div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{related.map((r) => <ProductCard key={r.id} product={r} />)}</div></section>}
    </div>
  );
}
