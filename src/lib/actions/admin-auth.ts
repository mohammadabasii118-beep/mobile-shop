'use server';

import { redirect } from 'next/navigation';
import { get } from '../db';
import { createSession, destroySession, loginAllowed, loginFailed, loginOk, verifyPassword } from '../auth';
import { normDigits } from '../format';
import type { AState } from '@/components/admin/client';

export async function adminLogin(_p: AState, fd: FormData): Promise<AState> {
  const login = normDigits(String(fd.get('login') ?? '').trim()).toLowerCase();
  const key = `a:${login}`;
  if (!loginAllowed(key)) return { error: 'تلاش‌های ناموفق زیاد بود. ۱۰ دقیقه بعد دوباره امتحان کنید.' };
  const u = get<{ id: number; password_hash: string; active: number; role: string }>('SELECT id, password_hash, active, role FROM users WHERE login = ?', login);
  if (!u || u.role !== 'admin' || !u.active || !verifyPassword(String(fd.get('password') ?? ''), u.password_hash)) {
    loginFailed(key);
    return { error: 'نام کاربری یا رمز عبور درست نیست' };
  }
  loginOk(key);
  await createSession(u.id);
  redirect('/admin');
}

export async function adminLogout() {
  await destroySession();
  redirect('/admin/login');
}
