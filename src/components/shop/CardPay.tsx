'use client';

import { useActionState, useState } from 'react';
import { Check, Copy } from 'lucide-react';
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
  return (
    <form action={action} className="card-box" noValidate style={{ textAlign: 'start', width: '100%' }}>
      <h2 style={{ fontSize: 18 }}>ثبت اطلاعات واریز</h2>
      <div className="fld"><label htmlFor="tracking">کد پیگیری / شماره مرجع تراکنش</label><input id="tracking" className="input" name="tracking" dir="ltr" inputMode="numeric" autoComplete="off" required /></div>
      <div className="grid2">
        <div className="fld"><label htmlFor="last4">۴ رقم آخر کارت شما <small className="mute">(اختیاری)</small></label><input id="last4" className="input" name="last4" dir="ltr" inputMode="numeric" maxLength={4} autoComplete="off" /></div>
        <div className="fld"><label htmlFor="rnote">توضیح <small className="mute">(اختیاری)</small></label><input id="rnote" className="input" name="note" maxLength={300} /></div>
      </div>
      {state?.error && <div className="alert err" role="alert">{state.error}</div>}
      <button className="btn btn-buy btn-lg btn-block" disabled={pending}>{pending ? 'در حال ثبت…' : 'ثبت اطلاعات واریز'}</button>
    </form>
  );
}
