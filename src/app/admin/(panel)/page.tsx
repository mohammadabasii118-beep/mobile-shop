import type { Metadata } from 'next';
import Link from 'next/link';
import { Banknote, Check, ClipboardList, MessageSquare, Package, Plus, ShoppingCart, Ticket, Users, GalleryHorizontal, TrendingUp, Boxes } from 'lucide-react';
import { all, get } from '@/lib/db';
import { getSettings } from '@/lib/catalog';
import { fa, jshort, jdatetime, ORDER_STATUS, toman } from '@/lib/format';
import { lowStockUnits, pctChange, periodTotals, salesByDay, topProducts } from '@/lib/stats';
import { Card, EmptyState, Kpi, Note, PageHead, Pill } from '@/components/admin/ui';
import { getUser, verifyPassword } from '@/lib/auth';
import BarChart from '@/components/admin/BarChart';

export const metadata: Metadata = { title: 'داشبورد' };

export default async function Dashboard() {
  const me = await getUser();
  const row = me ? get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', me.id) : undefined;
  const defaultPw = !!row && verifyPassword('admin123', row.password_hash);
  const s = getSettings();
  const low = Number(s.low_stock) || 5;
  const cur = periodTotals(-6, 0), prev = periodTotals(-13, -7);
  const m30 = periodTotals(-29, 0);
  const days = salesByDay(14);
  const today = days[days.length - 1];
  const pending = get<{ n: number }>("SELECT COUNT(*) n FROM orders WHERE status = 'pending'")!.n;
  const processing = get<{ n: number }>("SELECT COUNT(*) n FROM orders WHERE status = 'processing'")!.n;
  const reviews = get<{ n: number }>('SELECT COUNT(*) n FROM reviews WHERE approved = 0')!.n;
  const lowList = lowStockUnits(low, 6);
  const lowCount = lowStockUnits(low, 1000).length;
  const recent = all<{ id: number; number: string; customer_name: string; total: number; status: string; created_at: string }>('SELECT id, number, customer_name, total, status, created_at FROM orders ORDER BY id DESC LIMIT 7');
  const top = topProducts(30, 5);
  const topMax = Math.max(...top.map((t) => t.qty), 1);
  const hasKey = (k: string) => !!get('SELECT 1 FROM settings WHERE key = ?', k);
  const n = (sql: string) => get<{ n: number }>(sql)!.n;
  const steps = [
    { t: 'اطلاعات و تماس فروشگاه را کامل کنید', d: 'نام، شماره تماس و نشانی در فوتر سایت نمایش داده می‌شود.', href: '/admin/settings', done: hasKey('phone') },
    { t: 'ویژگی‌ها را بسازید (رنگ، برند و مدل گوشی)', d: 'برای محصولات متغیر مثل قاب و گلس لازم است.', href: '/admin/attributes', done: n('SELECT COUNT(*) n FROM attribute_terms') > 0 },
    { t: 'دسته‌بندی‌ها و برندها را ثبت کنید', d: 'مثل قاب، شارژر، Apple و Samsung.', href: '/admin/categories', done: n('SELECT COUNT(*) n FROM categories') > 0 && n('SELECT COUNT(*) n FROM brands') > 0 },
    { t: 'اولین محصول را اضافه کنید', d: 'محصول ساده یا متغیر با رنگ و مدل گوشی.', href: '/admin/products/new', done: n('SELECT COUNT(*) n FROM products') > 0 },
    { t: 'بنرهای اسلایدر صفحه اصلی را تنظیم کنید', d: 'چند بنر بسازید تا در هیرو به‌صورت کشویی نمایش داده شود.', href: '/admin/banners', done: n("SELECT COUNT(*) n FROM banners WHERE position = 'hero' AND active = 1") > 0 },
    { t: 'هزینه‌ی ارسال و روش پرداخت را مشخص کنید', d: 'ارسال رایگان از چه مبلغی؟ پرداخت در محل یا آنلاین؟', href: '/admin/settings#shipping', done: hasKey('shipping_cost') },
  ];
  const doneN = steps.filter((x) => x.done).length;

  return (
    <>
      <PageHead title="داشبورد" desc={`خلاصه‌ی وضعیت فروشگاه ${s.store_name}؛ آمار بر پایه‌ی سفارش‌های غیرلغو و غیرمرجوعی است.`}>
        <Link className="btn btn-secondary" href="/admin/orders?status=pending"><ShoppingCart />سفارش‌های جدید{pending > 0 && <span className="num">({fa(pending)})</span>}</Link>
        <Link className="btn btn-primary" href="/admin/products/new"><Plus />محصول جدید</Link>
      </PageHead>

      {defaultPw && <div style={{ marginBottom: 20 }}><Note warn><b>رمز عبور شما هنوز رمز پیش‌فرض است.</b> برای امنیت فروشگاه همین حالا آن را تغییر دهید: <Link className="link" href="/admin/settings#account">تنظیمات ← حساب من</Link></Note></div>}

      {doneN < steps.length && (
        <div style={{ marginBottom: 20 }}>
          <Card title={`راه‌اندازی فروشگاه (${fa(doneN)} از ${fa(steps.length)})`} desc="این مراحل را انجام دهید تا فروشگاه آماده‌ی فروش شود. بعد از تکمیل، این بخش خودکار ناپدید می‌شود." tight>
            {steps.map((x) => (
              <Link key={x.t} href={x.href} className={`check-row${x.done ? ' done' : ''}`}>
                <span className="dot">{x.done && <Check />}</span>
                <span className="t">{x.t}<small>{x.d}</small></span>
                {!x.done && <span className="link">انجام بده</span>}
              </Link>
            ))}
          </Card>
        </div>
      )}

      <div className="ad-kpis k6">
        <Kpi label="فروش امروز" value={toman(today.revenue / 1)} unit="تومان" icon={<Banknote />} hint={`${fa(today.orders)} سفارش`} />
        <Kpi label="فروش ۷ روز اخیر" value={toman(cur.revenue)} unit="تومان" icon={<TrendingUp />} delta={pctChange(cur.revenue, prev.revenue) === null ? null : { v: pctChange(cur.revenue, prev.revenue)! }} />
        <Kpi label="سفارش‌های ۷ روز اخیر" value={fa(cur.orders)} icon={<ClipboardList />} delta={pctChange(cur.orders, prev.orders) === null ? null : { v: pctChange(cur.orders, prev.orders)! }} href="/admin/orders" />
        <Kpi label="مشتری جدید (۷ روز)" value={fa(cur.customers)} icon={<Users />} href="/admin/users" />
        <Kpi label="میانگین سبد (۳۰ روز)" value={toman(m30.avg)} unit="تومان" icon={<ShoppingCart />} />
        <Kpi label="کم‌موجودی" value={fa(lowCount)} unit="مورد" icon={<Boxes />} href="/admin/inventory?filter=low" hint={`آستانه: ${fa(low)} عدد`} />
      </div>

      <div className="ad-cols">
        <div className="ad-stack">
          <Card title="فروش ۱۴ روز اخیر" desc="روز امروز با رنگ تیره مشخص شده است.">
            <BarChart data={days.map((d, i) => ({ label: jshort(new Date(d.day + 'T12:00:00Z')), value: d.revenue, title: `${jshort(new Date(d.day + 'T12:00:00Z'))}: ${toman(d.revenue)} تومان، ${fa(d.orders)} سفارش`, highlight: i === days.length - 1 }))} />
          </Card>
          <Card title="آخرین سفارش‌ها" actions={<Link className="link" href="/admin/orders">همه‌ی سفارش‌ها</Link>} tight>
            {recent.length === 0 ? <EmptyState title="هنوز سفارشی ثبت نشده" desc="وقتی مشتری‌ها خرید کنند، اینجا نمایش داده می‌شود." /> : (
              <div className="ad-tablewrap">
                <table className="ad-table cards">
                  <thead><tr><th>سفارش</th><th>مشتری</th><th>زمان</th><th>وضعیت</th><th className="num-col">مبلغ</th></tr></thead>
                  <tbody>
                    {recent.map((o) => (
                      <tr key={o.id}>
                        <td data-label="سفارش"><Link className="link num" href={`/admin/orders/${o.id}`}>{fa(o.number)}</Link></td>
                        <td data-label="مشتری">{o.customer_name}</td>
                        <td data-label="زمان" className="mute">{jdatetime(o.created_at)}</td>
                        <td data-label="وضعیت"><Pill tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Pill></td>
                        <td data-label="مبلغ" className="num-col">{toman(o.total)} تومان</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="ad-stack">
          <Card title="نیاز به اقدام" tight>
            <Link className="list-rows row" href="/admin/orders?status=pending" style={{ display: 'flex' }}><span className="t"><b>سفارش در انتظار پردازش</b><small>باید تأیید و آماده شوند</small></span><Pill tone={pending ? 'warning' : 'muted'}>{fa(pending)}</Pill></Link>
            <Link className="list-rows row" href="/admin/orders?status=processing" style={{ display: 'flex' }}><span className="t"><b>سفارش در حال آماده‌سازی</b><small>منتظر ارسال</small></span><Pill tone="info">{fa(processing)}</Pill></Link>
            <Link className="list-rows row" href="/admin/reviews" style={{ display: 'flex' }}><span className="t"><b>نظر منتظر تأیید</b><small>نمایش در سایت پس از تأیید</small></span><Pill tone={reviews ? 'warning' : 'muted'}>{fa(reviews)}</Pill></Link>
          </Card>
          <Card title="پرفروش‌ترین‌ها (۳۰ روز)" tight>
            {top.length === 0 ? <EmptyState title="داده‌ای نیست" /> : (
              <div className="hbar" style={{ padding: 18 }}>
                {top.map((t) => (
                  <div className="r" key={t.name}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.name}>{t.name}</span>
                    <span className="tr"><i style={{ width: `${(t.qty / topMax) * 100}%` }} /></span>
                    <b className="num">{fa(t.qty)}</b>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title="کم‌موجودی" actions={<Link className="link" href="/admin/inventory?filter=low">مدیریت موجودی</Link>} tight>
            {lowList.length === 0 ? <EmptyState title="همه‌چیز موجود است" /> : lowList.map((l, i) => (
              <Link key={i} className="list-rows row" style={{ display: 'flex' }} href={`/admin/products/${l.product_id}`}>
                <span className="t"><b>{l.name}</b>{l.label && <small dir="auto">{l.label}</small>}</span>
                <Pill tone={l.stock <= 0 ? 'danger' : 'warning'}>{l.stock <= 0 ? 'ناموجود' : `${fa(l.stock)} عدد`}</Pill>
              </Link>
            ))}
          </Card>
          <div className="ad-qa">
            <Link href="/admin/products/new"><Package /> محصول<small>افزودن کالا</small></Link>
            <Link href="/admin/banners/new"><GalleryHorizontal /> بنر<small>اسلایدر صفحه اصلی</small></Link>
            <Link href="/admin/coupons"><Ticket /> کد تخفیف<small>ساخت کوپن</small></Link>
            <Link href="/admin/reviews"><MessageSquare /> نظرات<small>تأیید و پاسخ</small></Link>
          </div>
        </div>
      </div>
    </>
  );
}
