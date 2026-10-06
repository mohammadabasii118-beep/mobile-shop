import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProductFull } from '@/lib/catalog';
import { get } from '@/lib/db';
import { PageHead } from '@/components/admin/ui';
import ProductEditor from '@/components/admin/ProductEditor';
import { loadEditorRefs } from '../editor-data';

export const metadata: Metadata = { title: 'ویرایش محصول' };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const p = Number.isInteger(id) ? getProductFull({ id }, { includeDraft: true }) : null;
  if (!p) notFound();
  const updated = get<{ updated_at: string }>('SELECT updated_at FROM products WHERE id = ?', id)!.updated_at;
  const refs = loadEditorRefs();
  const rawBrand = get<{ brand_id: number | null; category_id: number | null }>('SELECT brand_id, category_id FROM products WHERE id = ?', id)!;
  return (
    <>
      <PageHead title={p.name} crumbs={[{ label: 'محصولات', href: '/admin/products' }, { label: 'ویرایش' }]} />
      <ProductEditor
        key={`${id}-${updated}-${p.variations.map((v) => v.id).join(',')}`}
        isNew={false} {...refs}
        initial={{
          id: p.id, name: p.name, slug: p.slug, short_desc: p.short_desc, description: p.description, type: p.type, brand_id: rawBrand.brand_id, category_id: rawBrand.category_id,
          status: p.status, featured: p.featured, badge: p.badge, sku: p.sku ?? '', price: p.type === 'simple' ? p.price : null, sale_price: p.sale_price, stock: p.stock, images: p.images, specs: p.specs,
          attributes: p.attributes.map((a) => ({ attribute_id: a.attribute.id, term_ids: a.terms.map((t) => t.id), for_variations: a.for_variations })),
          variations: p.variations.map((v) => ({ id: v.id, attrs: v.attrs, sku: v.sku ?? '', price: v.price, sale_price: v.sale_price, stock: v.stock, image: v.image, status: v.status })),
        }}
      />
    </>
  );
}
