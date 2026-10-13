import type { MetadataRoute } from 'next';
import { getSettings } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export default function manifest(): MetadataRoute.Manifest {
  const s = getSettings();
  return {
    name: s.store_name,
    short_name: s.store_name,
    description: s.tagline,
    start_url: '/',
    display: 'standalone',
    lang: 'fa',
    dir: 'rtl',
    background_color: '#ffffff',
    theme_color: '#0a5cff',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
