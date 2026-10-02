import { Link } from 'react-router-dom';
import { useShop } from '@/store';
import { products } from '@/data/products';
import { Modal } from './Modal';
import { ProductArt } from './ProductArt';
import { Price } from './Price';
import { Rating } from './Rating';

export function QuickView() {
  const { quickView, setQuickView, addToCart } = useShop();
  const p = products.find((x) => x.id === quickView);
  return (
    <Modal open={!!p} onClose={() => setQuickView(null)} title="مشاهده سریع">
      {p && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-surface2"><ProductArt kind={p.art} color={p.colors[0].hex} className="aspect-square w-full p-6" /></div>
          <div className="flex flex-col gap-3">
            <h4 className="text-xl font-black text-white">{p.name}</h4>
            <Rating value={p.rating} count={p.reviewCount} />
            <p className="text-sm leading-7 text-mist/70">{p.description}</p>
            <Price price={p.price} oldPrice={p.oldPrice} size="lg" />
            <div className="mt-auto flex gap-2 pt-4">
              <button disabled={p.stock <= 0} className="btn btn-primary flex-1" onClick={() => { addToCart(p.id); setQuickView(null); }}>افزودن به سبد</button>
              <Link to={`/product/${p.slug}`} onClick={() => setQuickView(null)} className="btn btn-ghost">مشاهده محصول</Link>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
