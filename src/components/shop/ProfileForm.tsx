'use client';

import { useActionState } from 'react';
import { updateProfile, type FormState } from '@/lib/actions/shop';

export default function ProfileForm({ name, login }: { name: string; login: string }) {
  const [s, a, p] = useActionState<FormState, FormData>(updateProfile, undefined);
  return (
    <form action={a} className="form card-box" style={{ maxWidth: 520 }}>
      <div className="fld"><label htmlFor="pf-login">نام کاربری</label><input id="pf-login" className="input" value={login} dir="ltr" disabled readOnly /></div>
      <div className="fld"><label htmlFor="pf-name">نام و نام خانوادگی</label><input id="pf-name" className="input" name="name" defaultValue={name} required /></div>
      <div className="fld"><label htmlFor="pf-pw">رمز عبور جدید</label><input id="pf-pw" className="input" name="password" type="password" dir="ltr" autoComplete="new-password" placeholder="برای تغییر نکردن خالی بگذارید" /></div>
      {s?.error && <div className="alert err" role="alert">{s.error}</div>}
      {s?.ok && <div className="alert ok" role="status">{s.ok}</div>}
      <button className="btn btn-primary" style={{ width: 'fit-content' }} disabled={p}>{p ? 'در حال ذخیره…' : 'ذخیره'}</button>
    </form>
  );
}
