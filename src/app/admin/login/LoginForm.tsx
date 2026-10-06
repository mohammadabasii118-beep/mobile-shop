'use client';

import { useActionState } from 'react';
import { adminLogin } from '@/lib/actions/admin-auth';
import type { AState } from '@/components/admin/client';

export default function LoginForm() {
  const [s, a, p] = useActionState<AState, FormData>(adminLogin, undefined);
  return (
    <form action={a} className="form">
      <div className="fld"><label htmlFor="login">نام کاربری</label><input id="login" className="input" name="login" dir="ltr" autoComplete="username" autoFocus required /></div>
      <div className="fld"><label htmlFor="password">رمز عبور</label><input id="password" className="input" name="password" type="password" dir="ltr" autoComplete="current-password" required /></div>
      {s?.error && <div className="alert err" role="alert">{s.error}</div>}
      <button className="btn btn-primary btn-lg" disabled={p}>{p ? 'در حال ورود…' : 'ورود'}</button>
    </form>
  );
}
