import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, BarChart3, Boxes, Check, ChevronDown, LayoutDashboard, MessageSquare, Package, PackageSearch, Percent, Plus, Search, Settings, ShoppingCart, Ticket, Trash2, Users, X, MoreHorizontal } from 'lucide-react';
import '@/features/design-demo/design-demo.css';
import '@/features/design-demo/admin-demo.css';
import { products as seed } from '@/data/products';
import { categories } from '@/data/categories';
import { coupons, orders as seedOrders, reviews as seedReviews, orderStatusSteps, paymentLabel } from '@/data/account';
import { ProductArt } from '@/components/ProductArt';
import { faDate, formatPrice, toFa } from '@/utils/format';
import { useSEO } from '@/utils/seo';
import type { Order, Product, Review } from '@/types';

type View = 'dashboard' | 'products' | 'orders' | 'inventory' | 'customers' | 'reviews' | 'coupons' | 'settings';
const artColor = (p: Product) => (['شفاف', 'سفید'].includes(p.colors[0].name) ? '#7357f6' : p.colors[0].hex);
const statusColor: Record<string, string> = { registered: 'var(--muted)', paid: 'var(--blue)', preparing: 'var(--blue)', shipped: 'var(--pink)', delivered: 'var(--ok)' };
const payColor = { paid: 'var(--ok)', pending: 'var(--warn)', failed: 'var(--danger)', refunded: 'var(--muted)' } as const;
const Status = ({ c, children }: { c: string; children: ReactNode }) => <span className="st"><i style={{ background: c }} />{children}</span>;

function Modal({ title, onClose, children, wide, footer }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  return (
    <div className="modal-bg" onClick={onClose}><div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
      <header><h3>{title}</h3><button className="ic" aria-label="بستن" onClick={onClose}><X size={18} /></button></header>{children}{footer && <footer>{footer}</footer>}
    </div></div>
  );
}

function Dashboard({ go }: { go: (v: View) => void }) {
  const [range, setRange] = useState<'7' | '30'>('7');
  const series = range === '7' ? [34, 52, 41, 68, 59, 83, 112] : [22, 30, 28, 41, 36, 52, 47, 60, 55, 71, 64, 80, 77, 90, 84, 96, 70, 88, 92, 101, 95, 110, 98, 105, 120, 99, 108, 115, 109, 112];
  const W = 640, H = 170, max = 130;
  const pts = series.map((v, i) => [W - (i / (series.length - 1)) * W, H - (v / max) * H] as const); // RTL: latest on the left
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const low = seed.filter((p) => p.stock - p.reserved <= p.minStock).slice(0, 5);
  const top = [...seed].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 5);
  return (
    <>
      <div className="kpis">{[['درآمد', formatPrice(18_450_000), '↑ ۱۲٪', 'var(--ok)'], ['سفارش‌ها', toFa(128), '↑ ۸٪', 'var(--ok)'], ['مشتریان جدید', toFa(41), '↓ ۳٪', 'var(--danger)'], ['میانگین سبد', formatPrice(144_000), '↑ ۲٪', 'var(--ok)']].map(([k, v, d, c]) => <div className="kpi" key={k}><small>{k}</small><b>{v}</b><em style={{ color: c }}>{d}</em></div>)}</div>
      <div className="a2">
        <div className="c2"><div className="row-tools" style={{ justifyContent: 'space-between', marginBlockEnd: 8 }}><h5 style={{ margin: 0 }}>فروش روزانه (میلیون تومان)</h5><div className="seg">{(['7', '30'] as const).map((r) => <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>{toFa(+r)} روز</button>)}</div></div>
          <svg viewBox={`-8 -10 ${W + 52} ${H + 36}`} role="img" aria-label="نمودار فروش" style={{ width: '100%', display: 'block' }}>
            <defs><linearGradient id="ar2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7357f6" stopOpacity=".45" /><stop offset="1" stopColor="#ec4899" stopOpacity="0" /></linearGradient></defs>
            {[0, 40, 80, 120].map((g) => <g key={g}><line x1="0" x2={W} y1={H - (g / max) * H} y2={H - (g / max) * H} stroke="#26262b" /><text x={W + 10} y={H - (g / max) * H + 4} fontSize="11" fill="#868c91" textAnchor="end">{toFa(g)}</text></g>)}
            <path d={`${line} L0,${H} L${W},${H} Z`} fill="url(#ar2)" /><path d={line} fill="none" stroke="#8e78ff" strokeWidth="2.5" strokeLinejoin="round" />
            <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="5" fill="#fff" stroke="#7357f6" strokeWidth="3" />
            <text x={W} y={H + 22} fontSize="11" fill="#868c91" textAnchor="start">{range === '7' ? '۷ روز پیش' : '۳۰ روز پیش'}</text><text x="0" y={H + 22} fontSize="11" fill="#868c91" textAnchor="end">امروز</text>
          </svg></div>
        <div className="c2"><h5>پرفروش‌ترین‌ها</h5>{top.map((p, i) => <div className="lowrow" key={p.id}><span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="cap num">{toFa(i + 1)}</span><ProductArt kind={p.art} color={artColor(p)} className="h-8 w-8" /><span>{p.name}</span></span><span className="cap num">{toFa(p.reviewCount)} فروش</span></div>)}</div>
      </div>
      <div className="a2">
        <div className="c2"><div className="row-tools" style={{ justifyContent: 'space-between', marginBlockEnd: 8 }}><h5 style={{ margin: 0 }}>آخرین سفارش‌ها</h5><button className="btn btn-s btn-sm" onClick={() => go('orders')}>مشاهده همه</button></div>
          {seedOrders.slice(0, 4).map((o) => <div className="lowrow" key={o.id}><span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="mono">{o.id}</span>{o.customer}</span><Status c={statusColor[o.status]}>{orderStatusSteps.find((s) => s.key === o.status)!.label}</Status></div>)}</div>
        <div className="c2"><div className="row-tools" style={{ justifyContent: 'space-between', marginBlockEnd: 8 }}><h5 style={{ margin: 0 }}>موجودی کم</h5><button className="btn btn-s btn-sm" onClick={() => go('inventory')}>انبار</button></div>{low.map((p) => <div className="lowrow" key={p.id}><span>{p.name}</span><Status c={p.stock === 0 ? 'var(--danger)' : 'var(--warn)'}>{p.stock === 0 ? 'ناموجود' : `${toFa(p.stock)} عدد`}</Status></div>)}</div>
      </div>
    </>
  );
}

function ProductsView({ toast }: { toast: (m: string) => void }) {
  const [list, setList] = useState<Product[]>(seed); const [q, setQ] = useState(''); const [cat, setCat] = useState('all');
  const [edit, setEdit] = useState<Product | null>(null); const [del, setDel] = useState<Product | null>(null);
  const shown = list.filter((p) => (cat === 'all' || p.category === cat) && (p.name + p.sku).includes(q));
  const blank = (): Product => ({ id: `n${Date.now()}`, slug: `new-${Date.now()}`, name: '', category: 'cases', brand: 'CaseLine', sku: `CL-NEW-${list.length + 1}`, description: '', price: 0, rating: 0, reviewCount: 0, stock: 0, reserved: 0, minStock: 10, models: [], colors: [{ name: 'مشکی', hex: '#1a1a1d' }], tags: [], art: 'case' });
  const save = () => { if (!edit?.name.trim()) { toast('نام محصول الزامی است'); return; } setList((l) => (l.some((x) => x.id === edit.id) ? l.map((x) => (x.id === edit.id ? edit : x)) : [edit, ...l])); setEdit(null); toast('محصول ذخیره شد'); };
  const flag = (id: string, k: 'isFeatured' | 'isBestseller' | 'isNew') => setList((l) => l.map((p) => (p.id === id ? { ...p, [k]: !p[k] } : p)));
  const set = (k: keyof Product, v: string | number | boolean) => setEdit((e) => e && { ...e, [k]: v });
  return (
    <>
      <div className="ftools"><div className="search" style={{ flex: 1, minWidth: 200 }}><Search size={16} /><input className="inp" id="p-q" placeholder="جستجوی نام یا SKU" value={q} onChange={(e) => setQ(e.target.value)} style={{ minHeight: 36 }} /></div>
        <button className="chip" aria-pressed={cat === 'all'} onClick={() => setCat('all')}>همه</button>{categories.map((c) => <button key={c.slug} className="chip" aria-pressed={cat === c.slug} onClick={() => setCat(c.slug)}>{c.name}</button>)}</div>
      <div className="tbl ad-tbl"><table><thead><tr><th>محصول</th><th>SKU</th><th>قیمت</th><th>موجودی</th><th>ویژه</th><th>پرفروش</th><th>جدید</th><th style={{ width: 90 }} /></tr></thead><tbody>
        {shown.map((p) => { const a = p.stock - p.reserved; return (<tr key={p.id}><td><div className="nm"><div className="th"><ProductArt kind={p.art} color={artColor(p)} className="" /></div><span>{p.name}</span></div></td><td><span className="mono">{p.sku}</span></td><td className="num">{formatPrice(p.price)}</td>
          <td><Status c={a <= 0 ? 'var(--danger)' : a <= p.minStock ? 'var(--warn)' : 'var(--ok)'}>{a <= 0 ? 'ناموجود' : toFa(a)}</Status></td>
          {(['isFeatured', 'isBestseller', 'isNew'] as const).map((k) => <td key={k}><button className="sw-t" aria-pressed={!!p[k]} aria-label={k} onClick={() => flag(p.id, k)}><i /></button></td>)}
          <td><button className="ic" style={{ width: 32, height: 32, background: 'transparent' }} aria-label="ویرایش" onClick={() => setEdit(p)}><MoreHorizontal size={16} /></button><button className="ic" style={{ width: 32, height: 32, background: 'transparent' }} aria-label="حذف" onClick={() => setDel(p)}><Trash2 size={15} /></button></td></tr>); })}</tbody></table>
        {!shown.length && <div className="empty"><div className="circ"><PackageSearch size={22} /></div><b style={{ color: 'var(--ink)' }}>محصولی پیدا نشد</b><p>جستجو یا فیلتر را تغییر دهید.</p></div>}</div>
      <div className="pager"><span className="num">{toFa(shown.length)} از {toFa(list.length)} محصول</span><button className="btn btn-p btn-sm" onClick={() => setEdit(blank())}><Plus size={14} />محصول جدید</button></div>
      {edit && <Modal wide title={list.some((x) => x.id === edit.id) ? 'ویرایش محصول' : 'محصول جدید'} onClose={() => setEdit(null)} footer={<><button className="btn btn-p btn-sm" onClick={save}>ذخیره</button><button className="btn btn-s btn-sm" onClick={() => setEdit(null)}>انصراف</button></>}>
        <div className="edit-grid"><div>
          <label className="field"><span>نام محصول</span><input className="inp" id="e-name" value={edit.name} onChange={(e) => set('name', e.target.value)} /></label>
          <div className="two"><label className="field"><span>قیمت (تومان)</span><input className="inp ltr" id="e-price" inputMode="numeric" value={edit.price || ''} onChange={(e) => set('price', +e.target.value.replace(/\D/g, ''))} /></label><label className="field"><span>قیمت قبل از تخفیف</span><input className="inp ltr" id="e-old" inputMode="numeric" value={edit.oldPrice ?? ''} onChange={(e) => set('oldPrice', +e.target.value.replace(/\D/g, ''))} /></label></div>
          <div className="two"><label className="field"><span>SKU</span><input className="inp ltr" id="e-sku" value={edit.sku} onChange={(e) => set('sku', e.target.value)} /></label><label className="field"><span>موجودی</span><input className="inp ltr" id="e-stock" inputMode="numeric" value={edit.stock} onChange={(e) => set('stock', +e.target.value.replace(/\D/g, ''))} /></label></div>
          <label className="field"><span>توضیحات</span><textarea className="inp" id="e-desc" rows={3} value={edit.description} onChange={(e) => set('description', e.target.value)} /></label></div>
          <div><label className="field"><span>دسته‌بندی</span><select className="inp" id="e-cat" value={edit.category} onChange={(e) => set('category', e.target.value)}>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
            <div className="panel" style={{ background: 'var(--canvas)', padding: 16 }}><b style={{ color: 'var(--ink)', fontSize: 13 }}>پیش‌نمایش</b><div style={{ aspectRatio: '1', background: 'var(--s2)', borderRadius: 14, margin: '10px 0', display: 'grid', placeItems: 'center' }}><ProductArt kind={edit.art} color="#7357f6" className="h-24 w-24" /></div><div className="price num">{formatPrice(edit.price)}</div></div></div></div></Modal>}
      {del && <Modal title="حذف محصول" onClose={() => setDel(null)} footer={<><button className="btn btn-d btn-sm" onClick={() => { setList((l) => l.filter((x) => x.id !== del.id)); setDel(null); toast('محصول حذف شد'); }}>حذف «{del.sku}»</button><button className="btn btn-s btn-sm" onClick={() => setDel(null)}>انصراف</button></>}><p className="lead" style={{ fontSize: 15 }}>«{del.name}» برای همیشه حذف می‌شود. این کار قابل بازگشت نیست.</p></Modal>}
    </>
  );
}

function OrdersView({ toast }: { toast: (m: string) => void }) {
  const [list, setList] = useState<Order[]>(seedOrders); const [q, setQ] = useState(''); const [st, setSt] = useState('all'); const [open, setOpen] = useState<Order | null>(null);
  const shown = list.filter((o) => (st === 'all' || o.status === st) && (o.id + o.customer + o.phone).includes(q));
  const upd = (id: string, patch: Partial<Order>) => { setList((l) => l.map((o) => (o.id === id ? { ...o, ...patch } : o))); toast('وضعیت سفارش به‌روزرسانی شد'); };
  return (
    <>
      <div className="ftools"><div className="search" style={{ flex: 1, minWidth: 200 }}><Search size={16} /><input className="inp" id="o-q" placeholder="شماره سفارش، مشتری یا موبایل" value={q} onChange={(e) => setQ(e.target.value)} style={{ minHeight: 36 }} /></div>
        <button className="chip" aria-pressed={st === 'all'} onClick={() => setSt('all')}>همه</button>{orderStatusSteps.map((s) => <button key={s.key} className="chip" aria-pressed={st === s.key} onClick={() => setSt(s.key)}>{s.label}</button>)}</div>
      <div className="tbl ad-tbl"><table><thead><tr><th>سفارش</th><th>مشتری</th><th>تاریخ</th><th>مبلغ</th><th>پرداخت</th><th>وضعیت ارسال</th><th style={{ width: 60 }} /></tr></thead><tbody>
        {shown.map((o) => <tr key={o.id}><td><span className="mono">{o.id}</span></td><td>{o.customer}</td><td>{faDate(o.date)}</td><td className="num">{formatPrice(o.total)}</td><td><Status c={payColor[o.paymentStatus]}>{paymentLabel[o.paymentStatus]}</Status></td>
          <td><select className="sel" aria-label="وضعیت" value={o.status} onChange={(e) => upd(o.id, { status: e.target.value as Order['status'] })}>{orderStatusSteps.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></td><td><button className="btn btn-s btn-sm" onClick={() => setOpen(o)}>جزئیات</button></td></tr>)}</tbody></table>
        {!shown.length && <div className="empty"><div className="circ"><ShoppingCart size={22} /></div><b style={{ color: 'var(--ink)' }}>سفارشی پیدا نشد</b></div>}</div>
      {open && <Modal wide title={`سفارش ${open.id}`} onClose={() => setOpen(null)}>
        <div className="edit-grid"><div className="panel" style={{ background: 'var(--canvas)' }}><h4 style={{ fontSize: 15 }}>محصولات</h4>{open.items.map((i) => { const p = seed.find((x) => x.id === i.productId)!; return <div className="lowrow" key={i.productId}><span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><ProductArt kind={p.art} color={artColor(p)} className="h-8 w-8" />{p.name}</span><span className="num">× {toFa(i.quantity)}</span></div>; })}<div className="kv" style={{ borderBottom: 0, fontWeight: 800, color: 'var(--ink)' }}><span style={{ color: 'var(--ink)' }}>مبلغ کل</span><span className="num">{formatPrice(open.total)}</span></div></div>
          <div><div className="kv"><span>مشتری</span><span>{open.customer}</span></div><div className="kv"><span>موبایل</span><span className="mono">{open.phone}</span></div><div className="kv"><span>آدرس</span><span style={{ textAlign: 'end' }}>{open.address}</span></div><div className="kv"><span>پرداخت</span><Status c={payColor[open.paymentStatus]}>{paymentLabel[open.paymentStatus]}</Status></div></div></div></Modal>}
    </>
  );
}

function InventoryView() {
  const low = seed.filter((p) => p.stock - p.reserved <= p.minStock);
  return (
    <>
      <div className="banner"><AlertTriangle size={18} /><span>{toFa(low.length)} محصول به حداقل موجودی رسیده‌اند.</span><button className="btn btn-s btn-sm">ثبت سفارش خرید</button></div>
      <div className="tbl ad-tbl"><table><thead><tr><th>محصول</th><th>SKU</th><th>موجودی</th><th>رزرو</th><th>قابل فروش</th><th>حداقل</th><th>وضعیت</th></tr></thead><tbody>
        {seed.map((p) => { const a = p.stock - p.reserved; const c = a <= 0 ? 'var(--danger)' : a <= p.minStock ? 'var(--warn)' : 'var(--ok)'; return <tr key={p.id}><td><div className="nm"><div className="th"><ProductArt kind={p.art} color={artColor(p)} className="" /></div><span>{p.name}</span></div></td><td><span className="mono">{p.sku}</span></td><td className="num">{toFa(p.stock)}</td><td className="num">{toFa(p.reserved)}</td><td className="num"><span className="meter"><i style={{ width: `${Math.min(100, (a / 60) * 100)}%`, background: c }} /></span> {toFa(a)}</td><td className="num">{toFa(p.minStock)}</td><td><Status c={c}>{a <= 0 ? 'ناموجود' : a <= p.minStock ? 'موجودی کم' : 'موجود'}</Status></td></tr>; })}</tbody></table></div>
    </>
  );
}

function ReviewsView({ toast }: { toast: (m: string) => void }) {
  const [list, setList] = useState<Review[]>(seedReviews);
  const tone = { pending: 'var(--warn)', approved: 'var(--ok)', rejected: 'var(--danger)' }; const lbl = { pending: 'در انتظار بررسی', approved: 'تأیید شده', rejected: 'رد شده' };
  const set = (id: string, status: Review['status']) => { setList((l) => l.map((r) => (r.id === id ? { ...r, status } : r))); toast(status === 'approved' ? 'نظر تأیید شد' : 'نظر رد شد'); };
  return <div className="rvs">{list.map((r) => <div className="rv" key={r.id}><div className="row-tools" style={{ justifyContent: 'space-between' }}><b style={{ color: 'var(--ink)' }}>{r.customer}</b><Status c={tone[r.status]}>{lbl[r.status]}</Status></div><span style={{ color: 'var(--orange)' }}>{'★'.repeat(r.rating)}<span style={{ color: 'var(--s3)' }}>{'★'.repeat(5 - r.rating)}</span></span><p style={{ fontSize: 14 }}>{r.text}</p><span className="cap">{faDate(r.date)} · {seed.find((p) => p.id === r.productId)?.name}</span>
    <div className="row-tools" style={{ marginBlockStart: 4 }}><button className="btn btn-p btn-sm" onClick={() => set(r.id, 'approved')}><Check size={14} />تأیید</button><button className="btn btn-s btn-sm" onClick={() => set(r.id, 'rejected')}>رد</button></div></div>)}</div>;
}

function CouponsView({ toast }: { toast: (m: string) => void }) {
  const [on, setOn] = useState<string[]>(coupons.map((c) => c.code));
  const kind = { percent: 'درصدی', fixed: 'مبلغ ثابت', 'free-shipping': 'ارسال رایگان' };
  return (
    <div className="tbl ad-tbl"><table><thead><tr><th>کد</th><th>نوع</th><th>مقدار</th><th>بازه</th><th>حداقل خرید</th><th>استفاده</th><th>فعال</th></tr></thead><tbody>
      {coupons.map((c) => <tr key={c.code}><td><span className="mono">{c.code}</span></td><td>{kind[c.kind]}</td><td className="num">{c.kind === 'percent' ? `${toFa(c.value)}٪` : c.kind === 'fixed' ? formatPrice(c.value) : '—'}</td><td>{faDate(c.start)} تا {faDate(c.end)}</td><td className="num">{formatPrice(c.minOrder)}</td><td className="num"><span className="meter"><i style={{ width: `${(c.used / c.usageLimit) * 100}%`, background: 'var(--violet)' }} /></span> {toFa(c.used)}/{toFa(c.usageLimit)}</td>
        <td><button className="sw-t" aria-pressed={on.includes(c.code)} aria-label={`فعال‌سازی ${c.code}`} onClick={() => { setOn((s) => (s.includes(c.code) ? s.filter((x) => x !== c.code) : [...s, c.code])); toast('وضعیت کد تخفیف تغییر کرد'); }}><i /></button></td></tr>)}</tbody></table></div>
  );
}

const Info = ({ t }: { t: string }) => <div className="empty panel"><div className="circ"><Settings size={22} /></div><b style={{ color: 'var(--ink)' }}>{t}</b><p>این بخش در دمو نمایش داده نمی‌شود.</p></div>;

export default function AdminDemo() {
  useSEO({ title: 'Admin Demo' });
  const [view, setView] = useState<View>('dashboard'); const [msg, setMsg] = useState<string | null>(null);
  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2400); };
  const nav: [View, string, typeof Package][] = [['dashboard', 'داشبورد', LayoutDashboard], ['products', 'محصولات', Package], ['orders', 'سفارش‌ها', ShoppingCart], ['inventory', 'موجودی', Boxes], ['customers', 'مشتریان', Users], ['reviews', 'نظرات', MessageSquare], ['coupons', 'کدهای تخفیف', Ticket], ['settings', 'تنظیمات', Settings]];
  const titles: Record<View, [string, string]> = { dashboard: ['داشبورد', 'خلاصه‌ی عملکرد فروشگاه'], products: ['محصولات', 'افزودن، ویرایش و مدیریت کاتالوگ'], orders: ['سفارش‌ها', 'پیگیری و تغییر وضعیت سفارش‌ها'], inventory: ['موجودی', 'SKU، رزرو و موجودی قابل فروش'], customers: ['مشتریان', ''], reviews: ['نظرات', 'بررسی نظرات مشتریان'], coupons: ['کدهای تخفیف', 'مدیریت کمپین‌ها'], settings: ['تنظیمات', ''] };
  const customers = useMemo(() => Array.from(new Map(seedOrders.map((o) => [o.phone, o])).values()), []);
  const pending = seedReviews.filter((r) => r.status === 'pending').length;
  return (
    <div className="fd" dir="rtl">
      <div className="ad">
        <aside className="ad-side">
          <div className="ad-brand"><a className="logo" href="#top"><i />CaseLine</a><span className="badge">ادمین</span></div>
          <nav className="ad-nav" aria-label="منوی مدیریت"><span className="grp">فروشگاه</span>
            {nav.map(([k, l, I]) => <button key={k} aria-current={view === k ? 'page' : undefined} onClick={() => setView(k)}><I size={16} />{l}{k === 'reviews' && <span className="pill-n num">{toFa(pending)}</span>}</button>)}</nav>
          <div className="ad-user"><div className="av" style={{ marginInlineStart: 0 }}>ع</div><div><b style={{ color: 'var(--ink)' }}>علی رضایی</b><small>مدیر فروشگاه</small></div></div>
        </aside>
        <div style={{ minWidth: 0 }} id="top">
          <div className="ad-top"><div className="crumb"><span>CaseLine</span>/<b>{titles[view][0]}</b></div><div className="cmd"><Search size={14} />جستجو یا دستور…<kbd>⌘K</kbd></div><div className="av">ع</div></div>
          <main className="ad-main">
            <div className="ph"><div><h4>{titles[view][0]}</h4>{titles[view][1] && <p>{titles[view][1]}</p>}</div>{view === 'dashboard' && <div className="row-tools"><button className="btn btn-s btn-sm"><BarChart3 size={14} />گزارش<ChevronDown size={14} /></button><button className="btn btn-p btn-sm" onClick={() => setView('products')}><Plus size={14} />محصول جدید</button></div>}</div>
            {view === 'dashboard' && <Dashboard go={setView} />}{view === 'products' && <ProductsView toast={toast} />}{view === 'orders' && <OrdersView toast={toast} />}{view === 'inventory' && <InventoryView />}{view === 'reviews' && <ReviewsView toast={toast} />}{view === 'coupons' && <CouponsView toast={toast} />}
            {view === 'customers' && <div className="tbl ad-tbl"><table><thead><tr><th>مشتری</th><th>موبایل</th><th>آدرس</th><th>سفارش‌ها</th></tr></thead><tbody>{customers.map((o) => <tr key={o.phone}><td>{o.customer}</td><td><span className="mono">{o.phone}</span></td><td>{o.address}</td><td className="num">{toFa(seedOrders.filter((x) => x.phone === o.phone).length)}</td></tr>)}</tbody></table></div>}
            {view === 'settings' && <Info t="تنظیمات فروشگاه" />}
          </main>
        </div>
      </div>
      {msg && <div className="toast-wrap" role="status"><span className="toast"><Check size={16} color="#22c55e" />{msg}</span></div>}
    </div>
  );
}
