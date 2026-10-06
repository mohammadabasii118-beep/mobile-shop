import type { Metadata } from 'next';
import { getBrands, getCategories } from '@/lib/catalog';
import { PageHead } from '@/components/admin/ui';
import BannerEditor from '@/components/admin/BannerEditor';

export const metadata: Metadata = { title: 'بنر جدید' };

export default async function NewBanner({ searchParams }: { searchParams: Promise<{ position?: string }> }) {
  const position = (await searchParams).position === 'promo' ? 'promo' : 'hero';
  return (
    <>
      <PageHead title="بنر جدید" crumbs={[{ label: 'بنرها', href: '/admin/banners' }, { label: 'بنر جدید' }]} />
      <BannerEditor banner={{ position, layout: 'split', theme: position === 'promo' ? 'light' : 'night', art: 'p-charger' }} categories={getCategories(false).map((c) => ({ slug: c.slug, name: c.name }))} brands={getBrands(false).map((b) => ({ slug: b.slug, name: b.name }))} />
    </>
  );
}
