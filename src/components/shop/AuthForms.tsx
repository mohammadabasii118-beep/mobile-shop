'use client';

import { useActionState, useState } from 'react';
import { login, register, type FormState } from '@/lib/actions/shop';

export default function AuthForms({ next }: { next: string }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [ls, la, lp] = useActionState<FormState, FormData>(login, undefined);
  const [rs, ra, rp] = useActionState<FormState, FormData>(register, undefined);
  return (
    <div className="auth-box">
      <h1>{mode === 'login' ? 'ورود به حساب' : 'ساخت حساب جدید'}</h1>
      <div className="tab-row" role="tablist">
        <button role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>ورود</button>
        <button role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>ثبت‌نام</button>
      </div>
      {mode === 'login' ? (
        <form action={la} className="form">
          <input type="hidden" name="next" value={next} />
          <div className="fld"><label htmlFor="l-login">شماره موبایل</label><input id="l-login" className="input" name="login" dir="ltr" inputMode="tel" autoComplete="username" placeholder="09123456789" defaultValue={ls?.fields?.login} required /></div>
          <div className="fld"><label htmlFor="l-pw">رمز عبور</label><input id="l-pw" className="input" name="password" type="password" dir="ltr" autoComplete="current-password" required /></div>
          {ls?.error && <div className="alert err" role="alert">{ls.error}</div>}
          <button className="btn btn-primary btn-lg" disabled={lp}>{lp ? 'در حال ورود…' : 'ورود'}</button>
        </form>
      ) : (
        <form action={ra} className="form">
          <div className="fld"><label htmlFor="r-name">نام و نام خانوادگی</label><input id="r-name" className="input" name="name" autoComplete="name" defaultValue={rs?.fields?.name} required /></div>
          <div className="fld"><label htmlFor="r-login">شماره موبایل</label><input id="r-login" className="input" name="login" dir="ltr" inputMode="tel" autoComplete="username" placeholder="09123456789" defaultValue={rs?.fields?.login} required /></div>
          <div className="fld"><label htmlFor="r-pw">رمز عبور</label><input id="r-pw" className="input" name="password" type="password" dir="ltr" autoComplete="new-password" minLength={6} required /><span className="help">حداقل ۶ نویسه</span></div>
          {rs?.error && <div className="alert err" role="alert">{rs.error}</div>}
          <button className="btn btn-primary btn-lg" disabled={rp}>{rp ? 'در حال ساخت حساب…' : 'ساخت حساب'}</button>
        </form>
      )}
    </div>
  );
}
