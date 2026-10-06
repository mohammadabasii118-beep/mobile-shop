import type { Metadata } from 'next';
import { PageHead } from '@/components/admin/ui';
import ProductEditor from '@/components/admin/ProductEditor';
import { loadEditorRefs } from '../editor-data';

export const metadata: Metadata = { title: 'محصول جدید' };

export default function NewProductPage() {
  const refs = loadEditorRefs();
  return (
    <>
      <PageHead title="محصول جدید" crumbs={[{ label: 'محصولات', href: '/admin/products' }, { label: 'محصول جدید' }]} desc="نام و قیمت را وارد کنید. برای قاب و گلس «محصول متغیر» را انتخاب کنید تا برند گوشی، مدل و رنگ تعریف شود." />
      <ProductEditor
        isNew {...refs}
        initial={{ id: null, name: '', slug: '', short_desc: '', description: '', type: 'simple', brand_id: null, category_id: null, status: 'published', featured: false, badge: null, sku: '', price: null, sale_price: null, stock: 0, images: [], specs: [], attributes: [], variations: [] }}
      />
    </>
  );
}
