'use client';

import { useActionState, useState } from 'react';
import { Check, Copy, ImagePlus, X } from 'lucide-react';
import { submitCardReceipt, type FormState } from '@/lib/actions/shop';

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button" className="btn btn-secondary btn-sm"
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* مرورگر اجازه نداد */ }
      }}
    >
      {done ? <Check className="i" style={{ width: 16 }} /> : <Copy className="i" style={{ width: 16 }} />}{done ? 'کپی شد' : label}
    </button>
  );
}

export function ReceiptForm({ number }: { number: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitCardReceipt.bind(null, number), undefined);
  const [file, setFile] = useState('');
  const [preview, setPreview] = useState('');
  const [up, setUp] = useState(false);
  const [err, setErr] = useState('');
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setErr(''); setUp(true);
    try {
      const fd = new FormData();
      fd.set('number', number); fd.set('file', f);
      const r = await fetch('/api/receipt', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'آپلود انجام نشد');
      setFile(j.file); setPreview(URL.createObjectURL(f));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'آپلود انجام نشد');
    } finally { setUp(false); }
  };
  return (
    <form action={action} className="card-box" noValidate style={{ textAlign: 'start', width: '100%' }}>
      <h2 style={{ fontSize: 18 }}>ثبت اطلاعات واریز</h2>
      <p className="mute" style={{ fontSize: 13 }}>کد پیگیری را بنویسید یا عکس رسید را بفرستید؛ یکی کافی است.</p>
      <input type="hidden" name="image" value={file} />
      <div className="fld"><label htmlFor="tracking">کد پیگیری / شماره مرجع تراکنش</label><input id="tracking" className="input" name="tracking" dir="ltr" inputMode="numeric" autoComplete="off" /></div>
      <div className="fld">
        <label htmlFor="rimg">عکس رسید</label>
        {preview ? (
          <div className="receipt-prev">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="پیش‌نمایش رسید" />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setFile(''); setPreview(''); }}><X className="i" style={{ width: 16 }} />حذف عکس</button>
          </div>
        ) : (
          <label className="receipt-pick" htmlFor="rimg"><ImagePlus className="i" />{up ? 'در حال آپلود…' : 'انتخاب عکس رسید'}</label>
        )}
        <input id="rimg" className="sr" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        {err && <span className="help" style={{ color: 'var(--sale)' }} role="alert">{err}</span>}
      </div>
      <div className="grid2">
        <div className="fld"><label htmlFor="last4">۴ رقم آخر کارت شما <small className="mute">(اختیاری)</small></label><input id="last4" className="input" name="last4" dir="ltr" inputMode="numeric" maxLength={4} autoComplete="off" /></div>
        <div className="fld"><label htmlFor="rnote">توضیح <small className="mute">(اختیاری)</small></label><input id="rnote" className="input" name="note" maxLength={300} /></div>
      </div>
      {state?.error && <div className="alert err" role="alert">{state.error}</div>}
      <button className="btn btn-buy btn-lg btn-block" disabled={pending || up}>{pending ? 'در حال ثبت…' : 'ثبت اطلاعات واریز'}</button>
    </form>
  );
}
