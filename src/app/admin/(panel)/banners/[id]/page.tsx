import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { get } from '@/lib/db';
import { getBrands, getCategories } from '@/lib/catalog';
import type { Banner } from '@/lib/types';
import { PageHead } from '@/components/admin/ui';
import BannerEditor from '@/components/admin/BannerEditor';

export const metadata: Metadata = { title: 'ویرایش بنر' };

export default async function EditBanner({ params }: { params: Promise<{ id: string }> }) {
  const b = get<Banner>('SELECT * FROM banners WHERE id = ?', Number((await params).id));
  if (!b) notFound();
  return (
    <>
      <PageHead title="ویرایش بنر" crumbs={[{ label: 'بنرها', href: '/admin/banners' }, { label: b.title.replace(/\*/g, '').replace(/\n/g, ' ') }]} />
      <BannerEditor key={b.id} banner={b} categories={getCategories(false).map((c) => ({ slug: c.slug, name: c.name }))} brands={getBrands(false).map((x) => ({ slug: x.slug, name: x.name }))} />
    </>
  );
}
