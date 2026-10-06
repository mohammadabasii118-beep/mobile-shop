import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AuthForms from '@/components/shop/AuthForms';
import { getUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'ورود و ثبت‌نام', robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getUser()) redirect('/account');
  const next = (await searchParams).next ?? '/account';
  return <div className="wrap"><AuthForms next={next} /></div>;
}
