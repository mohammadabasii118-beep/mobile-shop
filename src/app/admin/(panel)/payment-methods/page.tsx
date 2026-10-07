import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Pencil, Plus } from 'lucide-react';
import { faDigits, toman } from '@/lib/format';
import { Card, Note, PageHead, Pill, one } from '@/components/admin/ui';
import { ActionForm, ConfirmForm, MoneyInput, QuickAction } from '@/components/admin/client';
import { deleteMethod, moveMethod, saveMethod, toggleMethod } from '@/lib/actions/admin-payments';
import { DRIVERS, MANUAL_NOTE } from '@/lib/payment-drivers';
import { listMethods, isUsable } from '@/lib/payment-methods';

export const metadata: Metadata = { title: 'روش‌های پرداخت' };

export default async function PaymentMethodsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const list = listMethods();
  const cur = list.find((m) => m.id === Number(one(sp.edit)));
  const drv = cur ? DRIVERS[cur.driver] : DRIVERS.card;
  const state = (m: (typeof list)[number]): [string, string] => {
    const d = DRIVERS[m.driver];
    if (!d) return ['danger', 'درایور نامعتبر'];
    if (!d.implemented) return ['muted', 'نیازمند اتصال API'];
    if (m.enabled && !isUsable(m)) return ['warning', m.driver === 'test' ? 'در این محیط پنهان' : 'ناقص'];
    return m.enabled ? ['success', 'روشن'] : ['muted', 'خاموش'];
  };
  return (
    <>
      <PageHead title="روش‌های پرداخت" desc="هر روش را روشن یا خاموش کنید، ترتیب نمایش در تسویه را عوض کنید و کارت‌به‌کارت جدید اضافه کنید.">
        {cur && <Link className="btn btn-secondary" href="/admin/payment-methods"><Plus />کارت‌به‌کارت جدید</Link>}
      </PageHead>
      <Note>{MANUAL_NOTE} برای وصل‌کردن اسنپ‌پی، ترب‌پی یا بله‌پی باید قرارداد پذیرنده و مستندات رسمی هر سرویس را داشته باشید.</Note>
      <div className="ad-cols">
        <Card title="همه‌ی روش‌ها" tight>
          <div>
            {list.map((m, i) => {
              const [tone, label] = state(m);
              const d = DRIVERS[m.driver];
              return (
                <div key={m.id} className="list-rows row" style={{ display: 'flex', flexWrap: 'wrap' }}>
                  <span className="t" style={{ minWidth: 200 }}>
                    <b style={{ whiteSpace: 'normal' }}>{m.title}</b>
                    <small>
                      {d?.label ?? m.driver}{(m.min_amount || m.max_amount) ? ` · ${m.min_amount ? `از ${toman(m.min_amount)}` : ''}${m.max_amount ? ` تا ${toman(m.max_amount)}` : ''} تومان` : ''}{m.driver === 'card' && m.cfg.card_number ? ` · ${faDigits(m.cfg.card_number.slice(-4))}…` : ''}
                    </small>
                  </span>
                  <Pill tone={tone}>{label}</Pill>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                    <QuickAction action={moveMethod.bind(null, m.id, -1)} className="icon-btn" title="بالاتر"><ArrowUp className="i" style={{ width: 17 }} /></QuickAction>
                    <QuickAction action={moveMethod.bind(null, m.id, 1)} className="icon-btn" title="پایین‌تر"><ArrowDown className="i" style={{ width: 17 }} /></QuickAction>
                    <QuickAction action={toggleMethod.bind(null, m.id)} className="btn btn-secondary btn-sm">{m.enabled ? 'خاموش کن' : 'روشن کن'}</QuickAction>
                    <Link className="icon-btn" href={`/admin/payment-methods?edit=${m.id}`} aria-label={`ویرایش ${m.title}`}><Pencil className="i" style={{ width: 17 }} /></Link>
                    {!m.builtin && i >= 0 && <ConfirmForm action={deleteMethod.bind(null, m.id)} label="حذف" message="حذف شود؟" />}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
        <Card title={cur ? `ویرایش ${cur.title}` : 'کارت‌به‌کارت جدید'} desc={drv.summary}>
          <ActionForm key={cur?.id ?? 'new'} action={saveMethod.bind(null, cur?.id ?? null, 'card')} reset={!cur}>
            <div className="fld"><label htmlFor="pt">عنوان در تسویه</label><input id="pt" className="input" name="title" defaultValue={cur?.title ?? 'کارت به کارت'} required /></div>
            <div className="fld"><label htmlFor="pd">توضیح کوتاه</label><input id="pd" className="input" name="description" defaultValue={cur?.description ?? 'واریز به شماره کارت فروشگاه و ثبت کد پیگیری'} /></div>
            {drv.fields.map((f) => (
              <div className="fld" key={f.key}>
                <label htmlFor={`c-${f.key}`}>{f.label}</label>
                {f.type === 'textarea'
                  ? <textarea id={`c-${f.key}`} className="textarea" name={`cfg_${f.key}`} defaultValue={cur?.cfg[f.key] ?? ''} placeholder={f.placeholder} style={{ minHeight: 76 }} />
                  : <input id={`c-${f.key}`} className="input" name={`cfg_${f.key}`} type={f.type === 'password' ? 'password' : 'text'} dir={f.ltr ? 'ltr' : undefined} inputMode={f.type === 'card' ? 'numeric' : undefined}
                      defaultValue={f.type === 'password' ? '' : cur?.cfg[f.key] ?? ''} placeholder={f.type === 'password' && cur?.cfg[f.key] ? 'ذخیره‌شده (برای تغییر، مقدار جدید بنویسید)' : f.placeholder} autoComplete="off" />}
                {f.help && <span className="help">{f.help}</span>}
              </div>
            ))}
            <div className="ad-grid2">
              <div className="fld"><label htmlFor="pmin">حداقل مبلغ سفارش (تومان)</label><MoneyInput id="pmin" name="min_amount" defaultValue={cur?.min_amount} placeholder="بدون حداقل" /></div>
              <div className="fld"><label htmlFor="pmax">حداکثر مبلغ سفارش (تومان)</label><MoneyInput id="pmax" name="max_amount" defaultValue={cur?.max_amount} placeholder="بدون سقف" /></div>
            </div>
            <label className="switch"><input type="checkbox" name="enabled" value="1" defaultChecked={cur ? !!cur.enabled : false} /><span className="tr" /><span>روشن (نمایش در تسویه)</span></label>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
