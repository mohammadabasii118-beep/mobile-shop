import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { getSettings } from '@/lib/catalog';
import LoginForm from './LoginForm';

export const metadata: Metadata = { title: 'ورود مدیر' };

export default async function AdminLoginPage() {
  const u = await getUser();
  if (u?.role === 'admin') redirect('/admin');
  const s = getSettings();
  return (
    <div className="ad-login">
      <div className="box">
        <div><h1>ورود به پنل مدیریت</h1><p>{s.store_name}</p></div>
        <LoginForm />
      </div>
    </div>
  );
}
