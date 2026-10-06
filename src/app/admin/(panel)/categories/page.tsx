import type { Metadata } from 'next';
import Link from 'next/link';
import { Pencil, Plus } from 'lucide-react';
import { all } from '@/lib/db';
import { fa } from '@/lib/format';
import { Card, EmptyState, PageHead, Pill, one } from '@/components/admin/ui';
import { ActionForm, ConfirmForm } from '@/components/admin/client';
import { deleteCategory, saveCategory } from '@/lib/actions/admin-catalog';
import ImageField from '@/components/admin/ImageField';
import Pic from '@/components/shop/Pic';
import { ART_KEYS, ART_LABELS } from '@/components/shop/Sprite';

export const metadata: Metadata = { title: 'دسته‌بندی‌ها' };

type C = { id: number; slug: string; name: string; parent_id: number | null; art: string | null; image: string | null; sort: number; active: number; n: number };

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const cats = all<C>('SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) n FROM categories c ORDER BY sort, id');
  const flat: (C & { depth: number })[] = [];
  const walk = (parent: number | null, d: number) => { for (const c of cats.filter((x) => x.parent_id === parent)) { flat.push({ ...c, depth: d }); walk(c.id, d + 1); } };
  walk(null, 0);
  const editId = Number(one(sp.edit)) || 0;
  const cur = editId ? cats.find((c) => c.id === editId) : undefined;

  return (
    <>
      <PageHead title="دسته‌بندی‌ها" desc="دسته‌ها در منوی سایت و صفحه‌ی اصلی نمایش داده می‌شوند. می‌توانید زیردسته بسازید.">
        {cur && <Link className="btn btn-secondary" href="/admin/categories"><Plus />دسته‌ی جدید</Link>}
      </PageHead>
      <div className="ad-cols">
        <Card title="همه‌ی دسته‌ها" tight>
          {flat.length === 0 ? <EmptyState title="هنوز دسته‌ای ندارید" desc="از فرم کنار صفحه اولین دسته را بسازید." /> : (
            <div className="ad-tablewrap">
              <table className="ad-table cards">
                <thead><tr><th>نام</th><th>نشانی</th><th className="num-col">محصولات</th><th>وضعیت</th><th /></tr></thead>
                <tbody>
                  {flat.map((c) => (
                    <tr key={c.id}>
                      <td className="full"><div className="pn" style={{ paddingInlineStart: c.depth * 20 }}><span className="thumb"><Pic src={c.image || (c.art ? `art:${c.art}` : null)} /></span><span><b>{c.depth > 0 && '↳ '}{c.name}</b></span></div></td>
                      <td data-label="نشانی" className="mute" dir="ltr" style={{ textAlign: 'right' }}>{c.slug}</td>
                      <td data-label="محصولات" className="num-col">{fa(c.n)}</td>
                      <td data-label="وضعیت"><Pill tone={c.active ? 'success' : 'muted'}>{c.active ? 'فعال' : 'مخفی'}</Pill></td>
                      <td className="full"><div className="actions"><Link className="btn btn-secondary btn-sm" href={`/admin/categories?edit=${c.id}`}><Pencil />ویرایش</Link></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title={cur ? `ویرایش «${cur.name}»` : 'دسته‌ی جدید'}>
          <ActionForm key={cur?.id ?? 'new'} action={saveCategory.bind(null, cur?.id ?? null)} reset={!cur}>
            <div className="fld"><label htmlFor="cn">نام</label><input id="cn" className="input" name="name" defaultValue={cur?.name} required /></div>
            <div className="fld"><label htmlFor="cs">نشانی (slug)</label><input id="cs" className="input" name="slug" dir="ltr" defaultValue={cur?.slug} placeholder="خودکار" /></div>
            <div className="fld"><label htmlFor="cp">زیرمجموعه‌ی</label>
              <select id="cp" className="sel" name="parent" defaultValue={cur?.parent_id ?? ''}><option value="">دسته‌ی اصلی</option>{flat.filter((c) => c.id !== cur?.id).map((c) => <option key={c.id} value={c.id}>{'— '.repeat(c.depth)}{c.name}</option>)}</select></div>
            <div className="fld"><label htmlFor="ca">آیکن نمونه</label>
              <select id="ca" className="sel" name="art" defaultValue={cur?.art ?? ''}><option value="">بدون آیکن</option>{ART_KEYS.map((k) => <option key={k} value={k}>{ART_LABELS[k]}</option>)}</select>
              <span className="help">اگر تصویر آپلود کنید، تصویر جایگزین آیکن می‌شود.</span></div>
            <ImageField name="image" defaultValue={cur?.image} label="تصویر دسته (اختیاری)" aspect="1 / 1" />
            <div className="ad-grid2">
              <div className="fld"><label htmlFor="cso">ترتیب نمایش</label><input id="cso" className="input num" name="sort" inputMode="numeric" defaultValue={cur?.sort ?? 0} /></div>
              <div className="fld" style={{ alignContent: 'end' }}><label className="switch"><input type="checkbox" name="active" value="1" defaultChecked={cur ? !!cur.active : true} /><span className="tr" /><span>نمایش در سایت</span></label></div>
            </div>
          </ActionForm>
          {cur && <ConfirmForm action={deleteCategory.bind(null, cur.id)} label="حذف این دسته" message={cur.n ? `${fa(cur.n)} محصول بدون دسته می‌شود. حذف شود؟` : 'حذف شود؟'} />}
        </Card>
      </div>
    </>
  );
}
