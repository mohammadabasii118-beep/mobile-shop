import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { all } from '@/lib/db';
import { fa } from '@/lib/format';
import { ATTR } from '@/lib/variations';
import { Card, Note, PageHead, Pill } from '@/components/admin/ui';
import { ActionForm } from '@/components/admin/client';
import { saveAttribute } from '@/lib/actions/admin-catalog';

export const metadata: Metadata = { title: 'ویژگی‌ها' };

export default function AttributesPage() {
  const attrs = all<{ id: number; slug: string; name: string; type: string; parent_attribute_id: number | null; terms: number; products: number }>(
    `SELECT a.*, (SELECT COUNT(*) FROM attribute_terms t WHERE t.attribute_id = a.id) terms, (SELECT COUNT(*) FROM product_attributes p WHERE p.attribute_id = a.id) products FROM attributes a ORDER BY sort, id`);
  const name = (id: number | null) => attrs.find((a) => a.id === id)?.name;
  return (
    <>
      <PageHead title="ویژگی‌ها" desc="مثل ووکامرس: یک‌بار ویژگی‌ها و مقدارهایشان را تعریف کنید (رنگ، برند گوشی، مدل گوشی، طول کابل …) و در هر محصول متغیر از آن‌ها استفاده کنید." />
      <div className="ad-cols">
        <div className="ad-stack">
          <Note>
            <b>نمونه:</b> «برند گوشی» ← Apple، Samsung، Xiaomi. «مدل گوشی» هر مقدار را زیر یک برند می‌گیرد (iPhone 15 زیر Apple). در محصول، فقط مدل‌های برند انتخابی نمایش داده می‌شود و ترکیب‌های نادرست (مثل Samsung × iPhone 15) ساخته نمی‌شود.
          </Note>
          <Card title="همه‌ی ویژگی‌ها" tight>
            <div className="ad-tablewrap">
              <table className="ad-table cards">
                <thead><tr><th>ویژگی</th><th>نوع</th><th>زیرمجموعه‌ی</th><th className="num-col">مقدارها</th><th className="num-col">محصولات</th><th /></tr></thead>
                <tbody>
                  {attrs.map((a) => (
                    <tr key={a.id}>
                      <td className="full"><Link className="link" href={`/admin/attributes/${a.id}`}><b>{a.name}</b></Link> {Object.values(ATTR).includes(a.slug as never) && <span className="sys" title="ویژگی پایه‌ی سیستم">سیستمی</span>}<small className="mute" dir="ltr" style={{ display: 'block' }}>{a.slug}</small></td>
                      <td data-label="نوع"><Pill tone={a.type === 'color' ? 'info' : 'muted'}>{a.type === 'color' ? 'رنگ' : 'انتخابی'}</Pill></td>
                      <td data-label="زیرمجموعه‌ی" className="mute">{name(a.parent_attribute_id) ?? '—'}</td>
                      <td data-label="مقدارها" className="num-col">{fa(a.terms)}</td>
                      <td data-label="محصولات" className="num-col">{fa(a.products)}</td>
                      <td className="full"><div className="actions"><Link className="btn btn-secondary btn-sm" href={`/admin/attributes/${a.id}`}>مدیریت مقدارها<ChevronLeft /></Link></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <Card title="ویژگی جدید">
          <ActionForm action={saveAttribute.bind(null, null)} submit="ساخت ویژگی">
            <div className="fld"><label htmlFor="an">نام</label><input id="an" className="input" name="name" placeholder="مثلاً: جنس، طول کابل، ظرفیت" required /></div>
            <div className="fld"><label htmlFor="at">نوع</label>
              <select id="at" className="sel" name="type"><option value="select">انتخابی (متن)</option><option value="color">رنگ (با نمونه‌ی رنگ)</option></select>
              <span className="help">ویژگی «رنگ» برای هر مقدار یک کد رنگ دارد که در سایت به‌صورت دایره‌ی رنگی نمایش داده می‌شود.</span></div>
            <div className="fld"><label htmlFor="ap">زیرمجموعه‌ی ویژگی (اختیاری)</label>
              <select id="ap" className="sel" name="parent"><option value="">مستقل</option>{attrs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
              <span className="help">مثلاً «مدل گوشی» زیرمجموعه‌ی «برند گوشی» است.</span></div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
