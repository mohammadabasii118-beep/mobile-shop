import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategories } from '@/lib/catalog';
import { decodeSlug } from '@/lib/format';
import Listing, { Crumbs, type SP } from '@/components/shop/Listing';

async function load(params: Promise<{ slug: string }>) {
  const slug = decodeSlug((await params).slug);
  const cats = getCategories();
  const cat = cats.find((c) => c.slug === slug);
  return { cat, parent: cat?.parent_id ? cats.find((c) => c.id === cat.parent_id) : undefined };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { cat } = await load(params);
  return cat ? { title: cat.name, description: `خرید ${cat.name} اصل با گارانتی اصالت و ارسال سریع` } : {};
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  const { cat, parent } = await load(params);
  if (!cat) notFound();
  const sp = await searchParams;
  return (
    <>
      <Crumbs items={[{ label: 'فروشگاه', href: '/shop' }, ...(parent ? [{ label: parent.name, href: `/category/${parent.slug}` }] : []), { label: cat.name }]} />
      <div className="wrap page-head"><h1>{cat.name}</h1></div>
      <Listing basePath={`/category/${cat.slug}`} sp={sp} categoryId={cat.id} />
    </>
  );
}
