import type { Metadata } from 'next';
import Link from 'next/link';
import { Pencil, Plus } from 'lucide-react';
import { all } from '@/lib/db';
import { fa, jdate, toman } from '@/lib/format';
import { Card, EmptyState, PageHead, Pill, one } from '@/components/admin/ui';
import { ActionForm, ConfirmForm, QuickAction } from '@/components/admin/client';
import { deleteCoupon, saveCoupon, toggleCoupon } from '@/lib/actions/admin-catalog';
import type { Coupon } from '@/lib/orders';
import CouponType from '@/components/admin/CouponType';

export const metadata: Metadata = { title: 'کد تخفیف' };

export default async function CouponsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const list = all<Coupon & { note: string }>('SELECT * FROM coupons ORDER BY id DESC');
  const cur = list.find((c) => c.id === Number(one(sp.edit)));
  const today = new Date().toISOString().slice(0, 10);
  const state = (c: Coupon) => !c.active ? ['muted', 'غیرفعال'] : c.ends_at && c.ends_at.slice(0, 10) < today ? ['danger', 'منقضی'] : c.max_uses !== null && c.used >= c.max_uses ? ['danger', 'تمام‌شده'] : c.starts_at && c.starts_at.slice(0, 10) > today ? ['warning', 'شروع نشده'] : ['success', 'فعال'];
  return (
    <>
      <PageHead title="کد تخفیف" desc="کوپن برای مشتری‌ها؛ درصدی یا مبلغ ثابت، با حداقل خرید، سقف تخفیف، تاریخ و تعداد استفاده.">{cur && <Link className="btn btn-secondary" href="/admin/coupons"><Plus />کد جدید</Link>}</PageHead>
      <div className="ad-cols">
        <Card title="همه‌ی کدها" tight>
          {list.length === 0 ? <EmptyState title="هنوز کدی نساخته‌اید" desc="از فرم کنار صفحه اولین کد را بسازید، مثلاً WELCOME10." /> : (
            <div className="ad-tablewrap"><table className="ad-table cards">
              <thead><tr><th>کد</th><th>تخفیف</th><th>حداقل خرید</th><th className="num-col">استفاده</th><th>اعتبار</th><th>وضعیت</th><th /></tr></thead>
              <tbody>{list.map((c) => { const [tone, label] = state(c); return (
                <tr key={c.id}>
                  <td className="full"><b dir="ltr" style={{ color: 'var(--ink)', letterSpacing: '.05em' }}>{c.code}</b>{c.note && <small className="mute" style={{ display: 'block' }}>{c.note}</small>}</td>
                  <td data-label="تخفیف" className="num">{c.type === 'percent' ? `${fa(c.value)}٪${c.max_discount ? ` (حداکثر ${toman(c.max_discount)})` : ''}` : `${toman(c.value)} تومان`}</td>
                  <td data-label="حداقل خرید" className="num">{c.min_total ? `${toman(c.min_total)} تومان` : '—'}</td>
                  <td data-label="استفاده" className="num-col">{fa(c.used)}{c.max_uses !== null ? ` / ${fa(c.max_uses)}` : ''}</td>
                  <td data-label="اعتبار" className="mute">{c.starts_at || c.ends_at ? `${c.starts_at ? jdate(c.starts_at) : '…'} تا ${c.ends_at ? jdate(c.ends_at) : '…'}` : 'بدون محدودیت'}</td>
                  <td data-label="وضعیت"><Pill tone={tone}>{label}</Pill></td>
                  <td className="full"><div className="actions">
                    <Link className="icon-btn" href={`/admin/coupons?edit=${c.id}`} aria-label="ویرایش"><Pencil className="i" style={{ width: 17 }} /></Link>
                    <QuickAction action={toggleCoupon.bind(null, c.id)} className="btn btn-secondary btn-sm">{c.active ? 'غیرفعال' : 'فعال'}</QuickAction>
                    <ConfirmForm action={deleteCoupon.bind(null, c.id)} label="حذف" message="حذف شود؟" />
                  </div></td>
                </tr>); })}</tbody>
            </table></div>
          )}
        </Card>
        <Card title={cur ? `ویرایش ${cur.code}` : 'کد جدید'}>
          <ActionForm key={cur?.id ?? 'new'} action={saveCoupon.bind(null, cur?.id ?? null)} reset={!cur}>
            <div className="fld"><label htmlFor="cc">کد</label><input id="cc" className="input" name="code" dir="ltr" defaultValue={cur?.code} placeholder="WELCOME10" style={{ textTransform: 'uppercase' }} required /><span className="help">فقط حروف انگلیسی، عدد، خط تیره</span></div>
            <CouponType defaults={{ type: cur?.type ?? 'percent', value: cur?.value ?? 10, max: cur?.max_discount ?? null }} />
            <div className="ad-grid2">
              <div className="fld"><label htmlFor="cm">حداقل مبلغ خرید (تومان)</label><input id="cm" className="input num" name="min_total" inputMode="numeric" defaultValue={cur?.min_total || ''} placeholder="بدون حداقل" /></div>
              <div className="fld"><label htmlFor="cu">حداکثر تعداد استفاده</label><input id="cu" className="input num" name="max_uses" inputMode="numeric" defaultValue={cur?.max_uses ?? ''} placeholder="نامحدود" /></div>
              <div className="fld"><label htmlFor="cs">شروع اعتبار</label><input id="cs" className="input" type="date" name="starts_at" defaultValue={cur?.starts_at?.slice(0, 10) ?? ''} /></div>
              <div className="fld"><label htmlFor="ce">پایان اعتبار</label><input id="ce" className="input" type="date" name="ends_at" defaultValue={cur?.ends_at?.slice(0, 10) ?? ''} /></div>
            </div>
            <div className="fld"><label htmlFor="cn">یادداشت داخلی</label><input id="cn" className="input" name="note" defaultValue={cur?.note} /></div>
            <label className="switch"><input type="checkbox" name="active" value="1" defaultChecked={cur ? !!cur.active : true} /><span className="tr" /><span>فعال</span></label>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
