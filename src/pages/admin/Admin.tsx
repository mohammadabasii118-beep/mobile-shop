import { useMemo, useState } from 'react';
import { NavLink, Navigate, useParams } from 'react-router-dom';
import { AlertTriangle, BarChart3, Boxes, CreditCard, Home, MessageSquare, Package, Percent, Settings, ShoppingCart, Sparkles, Tag, Ticket, Users, Wallet, Plus, Trash2, Pencil } from 'lucide-react';
import type { Order, Product, Review } from '@/types';
import { products as seed } from '@/data/products';
import { categories } from '@/data/categories';
import { coupons, orders as seedOrders, reviews as seedReviews, orderStatusSteps, paymentLabel, walletTxs, pointTxs } from '@/data/account';
import { faDate, formatPrice, toFa } from '@/utils/format';
import { useSEO } from '@/utils/seo';
import { useShop } from '@/store';
import { Badge } from '@/components/Badge';
import { Modal } from '@/components/Modal';
import { Logo } from '@/components/Navbar';

const nav = [
  ['dashboard', 'داشبورد', BarChart3], ['products', 'محصولات', Package], ['categories', 'دسته‌بندی‌ها', Tag], ['orders', 'سفارش‌ها', ShoppingCart], ['customers', 'مشتریان', Users],
  ['inventory', 'موجودی', Boxes], ['payments', 'پرداخت‌ها', CreditCard], ['wallet', 'کیف پول', Wallet], ['points', 'امتیازات', Sparkles], ['discounts', 'تخفیف‌ها', Percent],
  ['coupons', 'کدهای تخفیف', Ticket], ['reviews', 'نظرات', MessageSquare], ['homepage', 'صفحه اصلی', Home], ['settings', 'تنظیمات', Settings],
] as const;

const Th = ({ children }: { children: React.ReactNode }) => <th className="whitespace-nowrap p-3 text-right text-xs font-bold text-mist/50">{children}</th>;
const Table = ({ head, children }: { head: string[]; children: React.ReactNode }) => <div className="card overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-line"><tr>{head.map((h) => <Th key={h}>{h}</Th>)}</tr></thead><tbody className="divide-y divide-line [&_td]:whitespace-nowrap [&_td]:p-3 [&_td]:text-mist/80">{children}</tbody></table></div>;

function Products() {
  const [list, setList] = useState<Product[]>(seed);
  const [edit, setEdit] = useState<Product | null>(null);
  const notify = useShop((s) => s.notify);
  const blank = (): Product => ({ id: `p${Date.now()}`, slug: `new-${Date.now()}`, name: '', category: 'cases', brand: 'CaseLine', sku: `CL-NEW-${list.length + 1}`, description: '', price: 0, rating: 0, reviewCount: 0, stock: 0, reserved: 0, minStock: 10, models: [], colors: [{ name: 'مشکی', hex: '#1a1a1d' }], tags: [], art: 'case' });
  const save = () => { if (!edit?.name) return notify('نام محصول الزامی است', 'error'); setList((l) => (l.some((x) => x.id === edit.id) ? l.map((x) => (x.id === edit.id ? edit : x)) : [edit, ...l])); setEdit(null); notify('محصول ذخیره شد'); };
  const F = (k: keyof Product, label: string, num = false) => <label className="block text-xs font-bold text-mist/70">{label}<input className="input mt-1" type={num ? 'number' : 'text'} value={String(edit?.[k] ?? '')} onChange={(e) => setEdit({ ...edit!, [k]: num ? +e.target.value : e.target.value })} /></label>;
  return (
    <div className="space-y-4">
      <button className="btn btn-primary" onClick={() => setEdit(blank())}><Plus size={16} />محصول جدید</button>
      <Table head={['نام', 'SKU', 'قیمت', 'موجودی', 'برچسب‌ها', '']}>
        {list.map((p) => <tr key={p.id}><td className="font-bold !text-white">{p.name}</td><td dir="ltr">{p.sku}</td><td>{formatPrice(p.price)}</td><td>{toFa(p.stock)}</td>
          <td className="space-x-1 space-x-reverse">{p.isFeatured && <Badge tone="violet">ویژه</Badge>}{p.isBestseller && <Badge tone="orange">پرفروش</Badge>}{p.isNew && <Badge tone="sky">جدید</Badge>}</td>
          <td><button aria-label="ویرایش" onClick={() => setEdit(p)} className="p-1.5 hover:text-white"><Pencil size={15} /></button><button aria-label="حذف" onClick={() => { setList((l) => l.filter((x) => x.id !== p.id)); notify('محصول حذف شد', 'info'); }} className="p-1.5 hover:text-red-400"><Trash2 size={15} /></button></td></tr>)}
      </Table>
      <Modal open={!!edit} onClose={() => setEdit(null)} title="محصول">
        {edit && <div className="grid gap-3 sm:grid-cols-2">{F('name', 'نام')}{F('sku', 'SKU')}{F('price', 'قیمت (تومان)', true)}{F('oldPrice', 'قیمت قبل', true)}{F('stock', 'موجودی', true)}{F('brand', 'برند')}
          <label className="block text-xs font-bold text-mist/70">دسته‌بندی<select className="input mt-1" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value as Product['category'] })}>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
          <label className="block text-xs font-bold text-mist/70">مدل‌های سازگار (با کاما)<input className="input mt-1" value={edit.models.join('، ')} onChange={(e) => setEdit({ ...edit, models: e.target.value.split(/[,،]/).map((x) => x.trim()).filter(Boolean) })} /></label>
          <label className="block text-xs font-bold text-mist/70 sm:col-span-2">توضیحات<textarea className="input mt-1" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></label>
          <div className="flex flex-wrap gap-4 text-sm text-white sm:col-span-2">{([['isFeatured', 'ویژه'], ['isBestseller', 'پرفروش'], ['isNew', 'جدید']] as const).map(([k, l]) => <label key={k} className="flex items-center gap-2"><input type="checkbox" className="accent-violet" checked={!!edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.checked })} />{l}</label>)}</div>
          <div className="flex gap-2 sm:col-span-2"><button className="btn btn-primary" onClick={save}>ذخیره</button><button className="btn btn-ghost" onClick={() => setEdit(null)}>انصراف</button></div></div>}
      </Modal>
    </div>
  );
}

function Orders() {
  const [list, setList] = useState<Order[]>(seedOrders);
  const [q, setQ] = useState(''); const [st, setSt] = useState(''); const [open, setOpen] = useState<Order | null>(null);
  const shown = list.filter((o) => (o.id + o.customer + o.phone).includes(q) && (!st || o.status === st));
  const upd = (id: string, patch: Partial<Order>) => { setList((l) => l.map((o) => (o.id === id ? { ...o, ...patch } : o))); setOpen((o) => (o && o.id === id ? { ...o, ...patch } : o)); };
  return (
    <div className="space-y-4">
      <div className="flex gap-2"><input className="input" placeholder="جستجوی شماره سفارش / مشتری" value={q} onChange={(e) => setQ(e.target.value)} /><select className="input !w-48" value={st} onChange={(e) => setSt(e.target.value)}><option value="">همه وضعیت‌ها</option>{orderStatusSteps.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></div>
      <Table head={['سفارش', 'مشتری', 'تاریخ', 'مبلغ', 'پرداخت', 'وضعیت', '']}>
        {shown.map((o) => <tr key={o.id}><td className="font-bold !text-white">{o.id}</td><td>{o.customer}</td><td>{faDate(o.date)}</td><td>{formatPrice(o.total)}</td>
          <td><select className="input !w-36 !py-1.5" value={o.paymentStatus} onChange={(e) => upd(o.id, { paymentStatus: e.target.value as Order['paymentStatus'] })}>{Object.entries(paymentLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
          <td><select className="input !w-40 !py-1.5" value={o.status} onChange={(e) => upd(o.id, { status: e.target.value as Order['status'] })}>{orderStatusSteps.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></td>
          <td><button className="text-violet" onClick={() => setOpen(o)}>جزئیات</button></td></tr>)}
      </Table>
      <Modal open={!!open} onClose={() => setOpen(null)} title={`سفارش ${open?.id}`}>{open && <div className="space-y-2 text-sm text-mist/80"><p><b className="text-white">مشتری:</b> {open.customer} · {open.phone}</p><p><b className="text-white">آدرس:</b> {open.address}</p><p><b className="text-white">محصولات:</b> {open.items.map((i) => `${seed.find((p) => p.id === i.productId)?.name} × ${toFa(i.quantity)}`).join('، ')}</p><p><b className="text-white">مبلغ:</b> {formatPrice(open.total)}</p></div>}</Modal>
    </div>
  );
}

function Inventory() {
  return (
    <Table head={['محصول', 'SKU', 'موجودی', 'رزرو شده', 'قابل فروش', 'حداقل', '']}>
      {seed.map((p) => { const avail = p.stock - p.reserved; const low = avail <= p.minStock; return (
        <tr key={p.id}><td className="font-bold !text-white">{p.name}</td><td dir="ltr">{p.sku}</td><td>{toFa(p.stock)}</td><td>{toFa(p.reserved)}</td><td>{toFa(avail)}</td><td>{toFa(p.minStock)}</td>
          <td>{low && <span className="flex items-center gap-1 text-xs font-bold text-amber"><AlertTriangle size={14} />{avail <= 0 ? 'ناموجود' : 'موجودی کم'}</span>}</td></tr>); })}
    </Table>
  );
}

function Reviews() {
  const [list, setList] = useState<Review[]>(seedReviews);
  const tone = { pending: 'orange', approved: 'green', rejected: 'red' } as const; const lbl = { pending: 'در انتظار بررسی', approved: 'تأیید شده', rejected: 'رد شده' };
  return (
    <div className="space-y-3">{list.map((r) => (
      <div key={r.id} className="card flex flex-wrap items-center justify-between gap-3 p-4"><div><b className="text-white">{r.customer}</b> <span className="text-amber">{'★'.repeat(r.rating)}</span><p className="text-sm text-mist/70">{r.text}</p><p className="text-xs text-mist/40">{faDate(r.date)} · {seed.find((p) => p.id === r.productId)?.name}</p></div>
        <div className="flex items-center gap-2"><Badge tone={tone[r.status]}>{lbl[r.status]}</Badge><button className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setList((l) => l.map((x) => (x.id === r.id ? { ...x, status: 'approved' } : x)))}>تأیید</button><button className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setList((l) => l.map((x) => (x.id === r.id ? { ...x, status: 'rejected' } : x)))}>رد</button></div></div>))}</div>
  );
}

function Coupons() {
  return (
    <div className="space-y-4">
      <Table head={['کد', 'نوع', 'مقدار', 'شروع', 'پایان', 'حداقل خرید', 'استفاده', 'محدوده']}>
        {coupons.map((c) => <tr key={c.code}><td className="font-bold !text-white" dir="ltr">{c.code}</td><td>{{ percent: 'درصدی', fixed: 'مبلغ ثابت', 'free-shipping': 'ارسال رایگان' }[c.kind]}</td><td>{c.kind === 'percent' ? `${toFa(c.value)}٪` : c.kind === 'fixed' ? formatPrice(c.value) : '—'}</td><td>{faDate(c.start)}</td><td>{faDate(c.end)}</td><td>{formatPrice(c.minOrder)}</td><td>{toFa(c.used)} / {toFa(c.usageLimit)}</td><td>{c.scope}</td></tr>)}
      </Table>
    </div>
  );
}

function Dashboard() {
  const revenue = seedOrders.filter((o) => o.paymentStatus === 'paid').reduce((s, o) => s + o.total, 0);
  const low = seed.filter((p) => p.stock - p.reserved <= p.minStock).length;
  const stats = [['درآمد', formatPrice(revenue)], ['سفارش‌ها', toFa(seedOrders.length)], ['محصولات', toFa(seed.length)], ['هشدار موجودی', toFa(low)]];
  const bars = [40, 65, 52, 80, 70, 95, 88];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{stats.map(([k, v]) => <div key={k} className="card p-5"><p className="text-xs text-mist/60">{k}</p><p className="mt-2 text-xl font-black text-white">{v}</p></div>)}</div>
      <div className="card p-6"><p className="mb-4 text-sm font-bold text-white">فروش هفتگی</p><div className="flex h-40 items-end gap-3">{bars.map((h, i) => <div key={i} className="flex-1 rounded-t-xl bg-brand-gradient" style={{ height: `${h}%` }} />)}</div></div>
    </div>
  );
}

function Simple({ title, rows, head }: { title: string; head: string[]; rows: (string | number)[][] }) {
  return <div className="space-y-3"><h3 className="font-black text-white">{title}</h3><Table head={head}>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</Table></div>;
}

export default function Admin() {
  useSEO({ title: 'پنل مدیریت' });
  const { section = 'dashboard' } = useParams();
  const customers = useMemo(() => Array.from(new Map(seedOrders.map((o) => [o.phone, o])).values()), []);
  if (!nav.some(([k]) => k === section)) return <Navigate to="/admin" replace />;
  const body: Record<string, JSX.Element> = {
    dashboard: <Dashboard />, products: <Products />, orders: <Orders />, inventory: <Inventory />, reviews: <Reviews />, coupons: <Coupons />,
    categories: <Simple title="دسته‌بندی‌ها" head={['نام', 'Slug', 'تعداد محصول']} rows={categories.map((c) => [c.name, c.slug, toFa(seed.filter((p) => p.category === c.slug).length)])} />,
    customers: <Simple title="مشتریان" head={['نام', 'موبایل', 'آدرس']} rows={customers.map((o) => [o.customer, o.phone, o.address])} />,
    payments: <Simple title="پرداخت‌ها" head={['سفارش', 'مبلغ', 'وضعیت']} rows={seedOrders.map((o) => [o.id, formatPrice(o.total), paymentLabel[o.paymentStatus]])} />,
    wallet: <Simple title="تراکنش‌های کیف پول" head={['عنوان', 'تاریخ', 'مبلغ']} rows={walletTxs.map((t) => [t.title, faDate(t.date), formatPrice(t.amount)])} />,
    points: <Simple title="امتیازات وفاداری" head={['عنوان', 'تاریخ', 'امتیاز']} rows={pointTxs.map((t) => [t.title, faDate(t.date), toFa(t.points)])} />,
    discounts: <Simple title="تخفیف‌های فعال" head={['محصول', 'قیمت', 'قیمت قبل']} rows={seed.filter((p) => p.oldPrice).map((p) => [p.name, formatPrice(p.price), formatPrice(p.oldPrice!)])} />,
    homepage: <div className="card p-6 text-sm text-mist/70">مدیریت بخش‌های صفحه اصلی (Hero، محصولات ویژه، پرفروش‌ها) از طریق نشانه‌های «ویژه / پرفروش / جدید» در بخش محصولات انجام می‌شود.</div>,
    settings: <div className="card p-6 text-sm text-mist/70">تنظیمات فروشگاه، درگاه‌های پرداخت و حمل‌ونقل (به‌زودی).</div>,
  };
  return (
    <div className="min-h-screen bg-ink lg:flex">
      <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-l">
        <div className="p-5"><Logo /></div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-y-auto">{nav.map(([k, l, I]) => <NavLink key={k} to={`/admin/${k}`} className={({ isActive }) => `flex shrink-0 items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold ${isActive ? 'bg-violet/20 text-white' : 'text-mist/60 hover:bg-white/5'}`}><I size={17} />{l}</NavLink>)}</nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-8"><h1 className="mb-6 text-2xl font-black text-white">{nav.find(([k]) => k === section)![1]}</h1>{body[section]}</main>
    </div>
  );
}
