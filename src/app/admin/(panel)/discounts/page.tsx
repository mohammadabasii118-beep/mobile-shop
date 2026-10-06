import type { Metadata } from 'next';
import Link from 'next/link';
import { all } from '@/lib/db';
import { getBrands, getCategories } from '@/lib/catalog';
import { fa, toman } from '@/lib/format';
import { Card, EmptyState, Note, PageHead, Pill } from '@/components/admin/ui';
import { ActionForm, QuickAction } from '@/components/admin/client';
import { bulkDiscount, removeProductDiscount } from '@/lib/actions/admin-catalog';
import DiscountScope from '@/components/admin/DiscountScope';

export const metadata: Metadata = { title: 'تخفیف‌ها' };

export default function DiscountsPage() {
  const cats = getCategories(false), brands = getBrands(false);
  const rows = all<{ id: number; name: string; type: string; price: number; sale: number; n: number }>(
    `SELECT p.id, p.name, p.type,
      CASE WHEN p.type='variable' THEN (SELECT MIN(v.price) FROM variations v WHERE v.product_id=p.id AND v.sale_price>0 AND v.sale_price<v.price) ELSE p.price END price,
      CASE WHEN p.type='variable' THEN (SELECT MIN(v.sale_price) FROM variations v WHERE v.product_id=p.id AND v.sale_price>0 AND v.sale_price<v.price) ELSE p.sale_price END sale,
      CASE WHEN p.type='variable' THEN (SELECT COUNT(*) FROM variations v WHERE v.product_id=p.id AND v.sale_price>0 AND v.sale_price<v.price) ELSE 1 END n
     FROM products p WHERE (p.type='simple' AND p.sale_price>0 AND p.sale_price<p.price) OR (p.type='variable' AND EXISTS (SELECT 1 FROM variations v WHERE v.product_id=p.id AND v.sale_price>0 AND v.sale_price<v.price)) ORDER BY p.id DESC`);
  return (
    <>
      <PageHead title="تخفیف‌ها" desc="تخفیف گروهی روی دسته یا برند، و فهرست محصولات تخفیف‌دار. برای تخفیف تکی، قیمت تخفیفی را در صفحه‌ی ویرایش محصول وارد کنید." />
      <div className="ad-cols">
        <Card title={`محصولات تخفیف‌دار (${fa(rows.length)})`} tight>
          {rows.length === 0 ? <EmptyState title="محصولی تخفیف ندارد" desc="از فرم کنار صفحه تخفیف گروهی بسازید." /> : (
            <div className="ad-tablewrap"><table className="ad-table cards">
              <thead><tr><th>محصول</th><th className="num-col">قیمت اصلی</th><th className="num-col">قیمت تخفیفی</th><th>درصد</th><th /></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id}>
                  <td className="full"><Link className="link" href={`/admin/products/${r.id}`}><b>{r.name}</b></Link>{r.type === 'variable' && <small className="mute" style={{ display: 'block' }}>روی {fa(r.n)} متغیر (کمترین قیمت نمایش داده می‌شود)</small>}</td>
                  <td data-label="قیمت اصلی" className="num-col"><s className="mute">{toman(r.price)}</s></td>
                  <td data-label="قیمت تخفیفی" className="num-col"><b>{toman(r.sale)}</b></td>
                  <td data-label="درصد"><Pill tone="danger">{fa(Math.round((1 - r.sale / r.price) * 100))}٪</Pill></td>
                  <td className="full"><div className="actions"><QuickAction action={removeProductDiscount.bind(null, r.id)} className="btn btn-secondary btn-sm">برداشتن تخفیف</QuickAction></div></td>
                </tr>))}</tbody>
            </table></div>
          )}
        </Card>
        <div className="ad-stack">
          <Card title="تخفیف گروهی">
            <ActionForm action={bulkDiscount} submit="اعمال">
              <DiscountScope categories={cats.map((c) => ({ id: c.id, name: c.name }))} brands={brands.map((b) => ({ id: b.id, name: b.name }))} />
              <div className="ad-grid2">
                <div className="fld"><label htmlFor="dp">درصد تخفیف</label><input id="dp" className="input num" name="percent" inputMode="numeric" placeholder="۲۰" /></div>
                <div className="fld"><label htmlFor="dr">گرد کردن قیمت به</label><select id="dr" className="sel" name="round" defaultValue="1000"><option value="1000">هزار تومان</option><option value="10000">ده هزار تومان</option><option value="1">بدون گرد کردن</option></select></div>
              </div>
              <div className="fld"><span className="lab">عملیات</span>
                <label className="opt"><input type="radio" name="mode" value="apply" defaultChecked /> اعمال تخفیف</label>
                <label className="opt"><input type="radio" name="mode" value="remove" /> برداشتن همه‌ی تخفیف‌های این محدوده</label></div>
            </ActionForm>
          </Card>
          <Note>تخفیف گروهی، قیمت تخفیفی را از «قیمت اصلی» حساب می‌کند و قیمت‌های تخفیفی قبلی را جایگزین می‌کند. قیمت اصلی هیچ‌وقت تغییر نمی‌کند.</Note>
        </div>
      </div>
    </>
  );
}
