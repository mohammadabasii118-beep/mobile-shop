import type { Metadata } from 'next';
import './admin.css';

export const metadata: Metadata = { title: { default: 'پنل مدیریت', template: '%s | پنل مدیریت' }, robots: { index: false, follow: false } };

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="ad">{children}</div>;
}
