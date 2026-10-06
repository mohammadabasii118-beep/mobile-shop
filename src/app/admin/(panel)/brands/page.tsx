import type { Metadata } from 'next';
import Link from 'next/link';
import { Pencil, Plus } from 'lucide-react';
import { all } from '@/lib/db';
import { fa } from '@/lib/format';
import { Card, EmptyState, PageHead, Pill, one } from '@/components/admin/ui';
import { ActionForm, ConfirmForm } from '@/components/admin/client';
import { deleteBrand, saveBrand } from '@/lib/actions/admin-catalog';
import ImageField from '@/components/admin/ImageField';

export const metadata: Metadata = { title: 'برندها' };

export default async function BrandsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const brands = all<{ id: number; slug: string; name: string; logo: string | null; sort: number; active: number; n: number }>('SELECT b.*, (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id) n FROM brands b ORDER BY sort, name');
  const cur = brands.find((b) => b.id === Number(one(sp.edit)));
  return (
    <>
      <PageHead title="برندها" desc="برندهای کالا (مثل Apple، Anker) در فیلتر فروشگاه و بخش «برندهای معتبر» صفحه‌ی اصلی نمایش داده می‌شوند.">{cur && <Link className="btn btn-secondary" href="/admin/brands"><Plus />برند جدید</Link>}</PageHead>
      <div className="ad-cols">
        <Card title="همه‌ی برندها" tight>
          {brands.length === 0 ? <EmptyState title="هنوز برندی ندارید" /> : (
            <div className="ad-tablewrap"><table className="ad-table cards">
              <thead><tr><th>برند</th><th>نشانی</th><th className="num-col">محصولات</th><th>وضعیت</th><th /></tr></thead>
              <tbody>{brands.map((b) => (
                <tr key={b.id}>
                  <td className="full"><b dir="auto" style={{ color: 'var(--ink)' }}>{b.name}</b></td>
                  <td data-label="نشانی" className="mute" dir="ltr" style={{ textAlign: 'right' }}>{b.slug}</td>
                  <td data-label="محصولات" className="num-col">{fa(b.n)}</td>
                  <td data-label="وضعیت"><Pill tone={b.active ? 'success' : 'muted'}>{b.active ? 'فعال' : 'مخفی'}</Pill></td>
                  <td className="full"><div className="actions"><Link className="btn btn-secondary btn-sm" href={`/admin/brands?edit=${b.id}`}><Pencil />ویرایش</Link></div></td>
                </tr>))}</tbody>
            </table></div>
          )}
        </Card>
        <Card title={cur ? `ویرایش «${cur.name}»` : 'برند جدید'}>
          <ActionForm key={cur?.id ?? 'new'} action={saveBrand.bind(null, cur?.id ?? null)} reset={!cur}>
            <div className="fld"><label htmlFor="bn">نام برند</label><input id="bn" className="input" name="name" defaultValue={cur?.name} required /></div>
            <div className="fld"><label htmlFor="bs">نشانی (slug)</label><input id="bs" className="input" name="slug" dir="ltr" defaultValue={cur?.slug} placeholder="خودکار" /></div>
            <ImageField name="logo" defaultValue={cur?.logo} label="لوگو (اختیاری)" aspect="3 / 1" />
            <div className="ad-grid2">
              <div className="fld"><label htmlFor="bso">ترتیب نمایش</label><input id="bso" className="input num" name="sort" inputMode="numeric" defaultValue={cur?.sort ?? 0} /></div>
              <div className="fld" style={{ alignContent: 'end' }}><label className="switch"><input type="checkbox" name="active" value="1" defaultChecked={cur ? !!cur.active : true} /><span className="tr" /><span>نمایش در سایت</span></label></div>
            </div>
          </ActionForm>
          {cur && <ConfirmForm action={deleteBrand.bind(null, cur.id)} label="حذف این برند" message="حذف شود؟ محصولاتش بدون برند می‌شوند." />}
        </Card>
      </div>
    </>
  );
}
