import { Link, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { orders, orderStatusSteps, paymentLabel, walletTxs, pointTxs } from '@/data/account';
import { products } from '@/data/products';
import { useShop } from '@/store';
import { faDate, formatPrice, toFa } from '@/utils/format';
import { loyalty, wallet } from '@/features/wallet-loyalty';
import { Badge } from '@/components/Badge';
import { ProductCard } from '@/components/ProductCard';
import { ProductArt } from '@/components/ProductArt';

const Stat = ({ label, value, to }: { label: string; value: string; to: string }) => (
  <Link to={to} className="card p-5 transition hover:border-violet/40"><p className="text-xs text-mist/60">{label}</p><p className="mt-2 text-xl font-black text-white">{value}</p></Link>
);
const shipTone = { registered: 'gray', paid: 'sky', preparing: 'orange', shipped: 'violet', delivered: 'green' } as const;

export function Dashboard() {
  const wl = useShop((s) => s.wishlist.length);
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="موجودی کیف پول" value={formatPrice(wallet.balance)} to="/account/wallet" /><Stat label="امتیاز وفاداری" value={`${toFa(loyalty.points)} امتیاز`} to="/account/points" />
        <Stat label="علاقه‌مندی‌ها" value={toFa(wl)} to="/account/wishlist" /><Stat label="کل سفارش‌ها" value={toFa(orders.length)} to="/account/orders" />
      </div>
      <h3 className="font-black text-white">آخرین سفارش‌ها</h3><OrdersTable list={orders.slice(0, 3)} />
    </div>
  );
}

function OrdersTable({ list }: { list: typeof orders }) {
  return (
    <div className="space-y-3">{list.map((o) => (
      <Link key={o.id} to={`/account/orders/${o.id}`} className="card flex flex-wrap items-center justify-between gap-3 p-4 transition hover:border-violet/40">
        <div><b className="text-white">{o.id}</b><p className="text-xs text-mist/60">{faDate(o.date)} · {toFa(o.items.reduce((s, i) => s + i.quantity, 0))} کالا</p></div>
        <div className="flex gap-1">{o.items.slice(0, 3).map((i) => { const p = products.find((x) => x.id === i.productId)!; return <ProductArt key={i.productId} kind={p.art} color={p.colors[0].hex} className="h-10 w-10 rounded-lg bg-surface2" />; })}</div>
        <div className="flex items-center gap-2"><Badge tone={o.paymentStatus === 'paid' ? 'green' : 'orange'}>{paymentLabel[o.paymentStatus]}</Badge><Badge tone={shipTone[o.status]}>{orderStatusSteps.find((s) => s.key === o.status)!.label}</Badge></div>
        <b className="text-white">{formatPrice(o.total)}</b>
      </Link>))}</div>
  );
}
export const Orders = () => <OrdersTable list={orders} />;

export function OrderDetail() {
  const { id } = useParams();
  const o = orders.find((x) => x.id === id);
  if (!o) return <p className="text-mist/60">سفارش پیدا نشد.</p>;
  const idx = orderStatusSteps.findIndex((s) => s.key === o.status);
  return (
    <div className="space-y-6">
      <div className="card p-6"><h3 className="mb-6 font-black text-white">سفارش {o.id}</h3>
        <ol className="grid gap-5 md:grid-cols-5">{orderStatusSteps.map((s, i) => (
          <li key={s.key} className="flex items-center gap-3 md:flex-col md:text-center"><span className={`grid h-10 w-10 place-items-center rounded-full border-2 ${i <= idx ? 'border-violet bg-violet text-white' : 'border-line text-mist/40'}`}>{i <= idx ? <Check size={18} /> : toFa(i + 1)}</span><span className={`text-xs font-bold ${i <= idx ? 'text-white' : 'text-mist/40'}`}>{s.label}</span></li>))}</ol></div>
      <div className="card divide-y divide-line">{o.items.map((i) => { const p = products.find((x) => x.id === i.productId)!; return <div key={i.productId} className="flex items-center gap-3 p-4"><ProductArt kind={p.art} color={p.colors[0].hex} className="h-14 w-14" /><span className="flex-1 text-sm font-bold text-white">{p.name}</span><span className="text-sm text-mist/70">× {toFa(i.quantity)}</span></div>; })}<div className="flex justify-between p-4 font-black text-white"><span>مبلغ کل</span><span>{formatPrice(o.total)}</span></div></div>
      <div className="card p-5 text-sm text-mist/70"><b className="text-white">آدرس تحویل:</b> {o.address}</div>
    </div>
  );
}

export function Profile() {
  const { user, notify } = useShop();
  return <form className="card grid max-w-xl gap-4 p-6" onSubmit={(e) => { e.preventDefault(); notify('پروفایل ذخیره شد'); }}><input className="input" defaultValue={user.name} /><input className="input" defaultValue={user.phone} dir="ltr" /><input className="input" defaultValue={user.email} dir="ltr" /><button className="btn btn-primary">ذخیره</button></form>;
}
export const Addresses = () => <div className="card p-6"><b className="text-white">منزل</b><p className="mt-2 text-sm text-mist/70">تهران، ولیعصر، پلاک ۱۲ — کد پستی ۱۲۳۴۵۶۷۸۹۰</p></div>;
export const Settings = () => <div className="card p-6 text-sm text-mist/70">تنظیمات اعلان‌ها و امنیت حساب در نسخه‌ی بعدی اضافه می‌شود.</div>;

export function Wishlist() {
  const ids = useShop((s) => s.wishlist);
  const list = products.filter((p) => ids.includes(p.id));
  if (!list.length) return <div className="card p-12 text-center text-mist/60">لیست علاقه‌مندی‌های شما خالی است. <Link to="/shop" className="text-violet">مشاهده فروشگاه</Link></div>;
  return <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">{list.map((p) => <ProductCard key={p.id} product={p} />)}</div>;
}

export function WalletPage() {
  const notify = useShop((s) => s.notify);
  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-4 bg-gradient-to-br from-violet/20 to-transparent p-6"><div><p className="text-xs text-mist/60">موجودی کیف پول</p><p className="mt-1 text-3xl font-black text-white">{formatPrice(wallet.balance)}</p></div><button className="btn btn-primary" onClick={() => notify('شارژ کیف پول پس از اتصال درگاه فعال می‌شود', 'info')}>شارژ کیف پول</button></div>
      <p className="text-xs text-mist/50">اعتبار برگشتی سفارش‌ها به کیف پول واریز و هنگام خرید قابل استفاده است. کیف پول مستقل از امتیازات وفاداری است.</p>
      <div className="card divide-y divide-line">{walletTxs.map((t) => <div key={t.id} className="flex justify-between p-4 text-sm"><div><b className="text-white">{t.title}</b><p className="text-xs text-mist/50">{faDate(t.date)}</p></div><b className={t.amount > 0 ? 'text-emerald-400' : 'text-magenta'}>{t.amount > 0 ? '+' : '−'} {formatPrice(Math.abs(t.amount))}</b></div>)}</div>
    </div>
  );
}
export function Points() {
  return (
    <div className="space-y-6">
      <div className="card bg-gradient-to-br from-amber/20 to-transparent p-6"><p className="text-xs text-mist/60">امتیاز فعلی</p><p className="mt-1 text-3xl font-black text-white">{toFa(loyalty.points)} امتیاز</p></div>
      <div className="card divide-y divide-line">{pointTxs.map((t) => <div key={t.id} className="flex justify-between p-4 text-sm"><div><b className="text-white">{t.title}</b><p className="text-xs text-mist/50">{faDate(t.date)} · {t.points > 0 ? 'دریافت' : 'مصرف'}</p></div><b className={t.points > 0 ? 'text-emerald-400' : 'text-magenta'}>{t.points > 0 ? '+' : '−'}{toFa(Math.abs(t.points))}</b></div>)}</div>
    </div>
  );
}
