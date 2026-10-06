import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { all, get } from '@/lib/db';
import { fa } from '@/lib/format';
import { ATTR } from '@/lib/variations';
import type { Attribute, Term } from '@/lib/types';
import { Card, EmptyState, Note, PageHead } from '@/components/admin/ui';
import { ActionForm, ConfirmForm } from '@/components/admin/client';
import { addTerm, deleteAttribute, deleteTerm, saveAttribute, updateTerm } from '@/lib/actions/admin-catalog';

export const metadata: Metadata = { title: 'مقدارهای ویژگی' };

export default async function AttributeDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const a = get<Attribute>('SELECT * FROM attributes WHERE id = ?', id);
  if (!a) notFound();
  const terms = all<Term>('SELECT * FROM attribute_terms WHERE attribute_id = ? ORDER BY sort, id', id);
  const attrs = all<Attribute>('SELECT * FROM attributes ORDER BY sort, id');
  const parentAttr = a.parent_attribute_id ? attrs.find((x) => x.id === a.parent_attribute_id) : undefined;
  const parentTerms = parentAttr ? all<Term>('SELECT * FROM attribute_terms WHERE attribute_id = ? ORDER BY sort, id', parentAttr.id) : [];
  const system = Object.values(ATTR).includes(a.slug as never);
  const color = a.type === 'color';

  return (
    <>
      <PageHead title={a.name} crumbs={[{ label: 'ویژگی‌ها', href: '/admin/attributes' }, { label: a.name }]} desc={`${fa(terms.length)} مقدار${parentAttr ? ` · زیرمجموعه‌ی «${parentAttr.name}»` : ''}`} />
      <div className="ad-cols">
        <div className="ad-stack">
          <Card title="مقدارها" tight>
            {terms.length === 0 ? <EmptyState title="هنوز مقداری ندارد" desc="از فرم کنار صفحه اولین مقدار را اضافه کنید." /> : terms.map((t) => (
              <div className="term-row" key={t.id}>
                <ActionForm action={updateTerm.bind(null, t.id)} className="term-fields" submit="ذخیره" submitClass="btn btn-secondary btn-sm" inline>
                  {color && <input type="color" name="value" defaultValue={t.value ?? '#cccccc'} aria-label={`رنگ ${t.name}`} />}
                  <input className="input" name="name" defaultValue={t.name} aria-label="نام" required />
                  {parentAttr && (
                    <select className="sel" name="parent" defaultValue={t.parent_term_id ?? ''} aria-label={`زیرمجموعه‌ی ${parentAttr.name}`}>
                      <option value="">— بدون {parentAttr.name} —</option>
                      {parentTerms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                  <input className="input num-in num" name="sort" defaultValue={t.sort} inputMode="numeric" aria-label="ترتیب" title="ترتیب نمایش" />
                </ActionForm>
                <div className="row-actions"><ConfirmForm action={deleteTerm.bind(null, t.id)} label="حذف" message="حذف شود؟" /></div>
              </div>
            ))}
          </Card>
        </div>
        <div className="ad-stack">
          <Card title="افزودن مقدار">
            <ActionForm action={addTerm.bind(null, id)} submit="افزودن" reset>
              <div className="fld"><label htmlFor="tn">نام</label><input id="tn" className="input" name="name" placeholder={color ? 'مثلاً: آبی' : parentAttr ? 'مثلاً: iPhone 15 Pro' : 'مثلاً: ۱ متر'} /></div>
              {color && <div className="fld"><label htmlFor="tv">رنگ</label><input id="tv" type="color" name="value" defaultValue="#2f6bff" style={{ width: 64, height: 40, padding: 2, border: '1px solid var(--hairline-strong)', borderRadius: 10, background: 'var(--canvas)' }} /></div>}
              {parentAttr && (
                <div className="fld"><label htmlFor="tp">زیرمجموعه‌ی {parentAttr.name}</label>
                  <select id="tp" className="sel" name="parent"><option value="">انتخاب کنید…</option>{parentTerms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              )}
              <details>
                <summary style={{ cursor: 'pointer', color: 'var(--action)', fontWeight: 600, fontSize: 13 }}>افزودن چندتایی (هر خط یک مقدار)</summary>
                <div className="fld" style={{ marginTop: 10 }}>
                  <textarea className="textarea" name="bulk" dir="auto" placeholder={color ? 'مشکی|#17181c\nسفید|#f3f4f6' : 'iPhone 15\niPhone 15 Pro'} aria-label="افزودن چندتایی" />
                  <span className="help">{color ? 'هر خط: نام|کد رنگ' : parentAttr ? `همه‌ی خط‌ها زیر «${parentAttr.name}» انتخاب‌شده ثبت می‌شوند.` : 'هر خط یک مقدار.'}</span>
                </div>
              </details>
            </ActionForm>
          </Card>
          <Card title="تنظیمات ویژگی">
            <ActionForm action={saveAttribute.bind(null, id)}>
              <div className="fld"><label htmlFor="en">نام</label><input id="en" className="input" name="name" defaultValue={a.name} required /></div>
              {!system && <div className="fld"><label htmlFor="et">نوع</label><select id="et" className="sel" name="type" defaultValue={a.type}><option value="select">انتخابی</option><option value="color">رنگ</option></select></div>}
              <div className="fld"><label htmlFor="ep">زیرمجموعه‌ی</label><select id="ep" className="sel" name="parent" defaultValue={a.parent_attribute_id ?? ''}><option value="">مستقل</option>{attrs.filter((x) => x.id !== id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
            </ActionForm>
            {system ? <Note>این ویژگی پایه‌ی سیستم است (فیلتر «سازگار با گوشی من» از آن استفاده می‌کند) و حذف نمی‌شود.</Note> : <ConfirmForm action={deleteAttribute.bind(null, id)} label="حذف این ویژگی" message="با همه‌ی مقدارهایش حذف شود؟" />}
          </Card>
        </div>
      </div>
    </>
  );
}
