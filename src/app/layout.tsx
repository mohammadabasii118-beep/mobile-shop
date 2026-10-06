import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/vazirmatn/wght.css';
import './globals.css';
import Sprite from '@/components/shop/Sprite';
import { getSettings } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const s = getSettings();
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
    title: { default: `${s.store_name} | ${s.tagline}`, template: `%s | ${s.store_name}` },
    description: s.footer_about,
    openGraph: { siteName: s.store_name, locale: 'fa_IR', type: 'website' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#ffffff' }, { media: '(prefers-color-scheme: dark)', color: '#0c0d10' }],
};

const themeScript = `try{var t=localStorage.getItem('vt_theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Sprite />
        {children}
      </body>
    </html>
  );
}
