import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Star } from 'lucide-react';
import { getProductFull, getProductReviews, getSettings, listProducts } from '@/lib/catalog';
import { decodeSlug, fa, jdate, toman } from '@/lib/format';
import { effectivePrice } from '@/lib/variations';
import ProductView, { type PVProps } from '@/components/shop/ProductView';
import ProductGrid from '@/components/shop/ProductGrid';
import { Crumbs } from '@/components/shop/Listing';
import { parseArt } from '@/components/shop/Pic';
import ReviewForm from '@/components/shop/ReviewForm';
import { getUser } from '@/lib/auth';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = getProductFull({ slug: decodeSlug((await params).slug) });
  if (!p) return {};
  const img = p.images.find((i) => !parseArt(i));
  return {
    title: p.name,
    description: p.short_desc || p.description.slice(0, 150),
    openGraph: { title: p.name, description: p.short_desc, images: img ? [img] : undefined, type: 'website' },
  };
}

const BADGES = { new: ['جدید', 'b-new'], best: ['پرفروش', 'b-best'], promo: ['تخفیف ویژه', 'b-promo'] } as const;

export default async function ProductPage({ params }: Params) {
  const p = getProductFull({ slug: decodeSlug((await params).slug) });
  if (!p) notFound();
  const settings = getSettings();
  const user = await getUser();
  const reviews = getProductReviews(p.id);
  const related = listProducts({ categoryId: p.category?.id, excludeId: p.id, limit: 4, sort: 'popular' }).items;

  const varAttrs = p.attributes.filter((a) => a.for_variations && p.type === 'variable');
  const slugSet = new Set(varAttrs.map((a) => a.attribute.slug));
  const idToSlug = new Map<number, string>();
  for (const a of p.attributes) idToSlug.set(a.attribute.id, a.attribute.slug);
  const termSlugById = new Map<number, string>();
  for (const a of p.attributes) for (const t of a.terms) termSlugById.set(t.id, t.slug);

  const pv: PVProps = {
    id: p.id, name: p.name, type: p.type, images: p.images.length ? p.images : [],
    badge: p.badge ? { label: BADGES[p.badge][0], cls: BADGES[p.badge][1] } : null,
    price: p.price, sale_price: p.sale_price, stock: p.stock, low: Number(settings.low_stock) || 5,
    attrs: varAttrs.map((a) => ({
      slug: a.attribute.slug, name: a.attribute.name, type: a.attribute.type,
      parent: a.attribute.parent_attribute_id && slugSet.has(idToSlug.get(a.attribute.parent_attribute_id) ?? '') ? idToSlug.get(a.attribute.parent_attribute_id)! : null,
      terms: a.terms.map((t) => ({ slug: t.slug, name: t.name, value: t.value, parent: t.parent_term_id ? termSlugById.get(t.parent_term_id) ?? null : null })),
    })),
    variations: p.variations.map((v) => ({ id: v.id, attrs: v.attrs, price: v.price, sale_price: v.sale_price, stock: v.stock, image: v.image, status: v.status })),
  };

  const active = p.variations.filter((v) => v.status === 'active');
  const prices = p.type === 'variable' ? active.map((v) => effectivePrice(v.price, v.sale_price)) : [effectivePrice(p.price, p.sale_price)];
  const inStock = p.type === 'variable' ? active.some((v) => v.stock > 0) : p.stock > 0;
  const firstImg = p.images.find((i) => !parseArt(i));
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.short_desc || undefined,
    sku: p.sku || undefined, brand: p.brand ? { '@type': 'Brand', name: p.brand.name } : undefined,
    image: firstImg ? `${siteUrl}${firstImg}` : undefined,
    aggregateRating: p.ratingCount ? { '@type': 'AggregateRating', ratingValue: Math.round(p.rating * 10) / 10, reviewCount: p.ratingCount } : undefined,
    offers: prices.length ? {
      '@type': 'AggregateOffer', priceCurrency: 'IRR', lowPrice: Math.min(...prices) * 10, highPrice: Math.max(...prices) * 10,
      offerCount: prices.length, availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    } : undefined,
  };

  const infoAttrs = p.attributes.filter((a) => !(a.for_variations && p.type === 'variable'));
  const specRows = [
    ...(p.brand ? [{ k: 'برند', v: p.brand.name }] : []),
    ...p.specs.map((s) => ({ k: s.k, v: s.v })),
    ...infoAttrs.map((a) => ({ k: a.attribute.name, v: a.terms.map((t) => t.name).join('، ') })),
    ...(p.sku ? [{ k: 'کد محصول', v: p.sku }] : []),
  ];

  const header = (
    <>
      {p.brand && <Link className="p-brand" href={`/shop?brand=${p.brand.slug}`}>{p.brand.name}</Link>}
      <h1>{p.name}</h1>
      {p.ratingCount > 0 && (
        <a href="#reviews" className="rate" style={{ fontSize: 13 }}>
          <Star aria-hidden /> <b className="num">{fa(Math.round(p.rating * 10) / 10)}</b> <span className="num">({fa(p.ratingCount)} نظر)</span>
        </a>
      )}
      {p.short_desc && <p className="short">{p.short_desc}</p>}
    </>
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Crumbs items={[{ label: 'فروشگاه', href: '/shop' }, ...(p.category ? [{ label: p.category.name, href: `/category/${p.category.slug}` }] : []), { label: p.name }]} />
      <div className="wrap">
        <ProductView {...pv} header={header} />

        <div className="tabs">
          <div style={{ display: 'grid', gap: 32, alignContent: 'start' }}>
            {p.description && (
              <section>
                <h2>معرفی محصول</h2>
                <div className="prose">{p.description.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}</div>
              </section>
            )}
            <section id="reviews">
              <h2>نظرات کاربران{p.ratingCount > 0 && <small className="mute num" style={{ fontWeight: 500, fontSize: 14 }}> ({fa(p.ratingCount)})</small>}</h2>
              <div className="rv-list">
                {reviews.length === 0 && <p className="mute">هنوز نظری ثبت نشده است. اولین نفر باشید.</p>}
                {reviews.map((r) => (
                  <div key={r.id} className="rv-item">
                    <div className="top"><span><b>{r.author}</b> · {jdate(r.created_at)}</span><span className="stars" role="img" aria-label={`امتیاز ${fa(r.rating)} از ۵`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={n > r.rating ? 'off' : ''} />)}</span></div>
                    <p>{r.body}</p>
                  </div>
                ))}
              </div>
              <ReviewForm productId={p.id} loggedIn={!!user} defaultName={user?.name ?? ''} />
            </section>
          </div>
          <div>
            {specRows.length > 0 && (
              <section>
                <h2>مشخصات</h2>
                <table className="spec-table"><tbody>{specRows.map((r, i) => <tr key={i}><th scope="row">{r.k}</th><td>{r.v}</td></tr>)}</tbody></table>
              </section>
            )}
            <p className="mute" style={{ marginTop: 16, fontSize: 13 }}>قیمت‌ها به تومان و شامل مالیات بر ارزش افزوده است. {p.type === 'variable' && prices.length > 0 && <>محدوده‌ی قیمت: <span className="num">{toman(Math.min(...prices))}</span> تا <span className="num">{toman(Math.max(...prices))}</span>.</>}</p>
          </div>
        </div>

        {related.length > 0 && (
          <section style={{ paddingBlock: '48px 64px' }}>
            <div className="sh"><h2>محصولات مرتبط</h2></div>
            <ProductGrid items={related} low={Number(settings.low_stock) || 5} />
          </section>
        )}
      </div>
    </>
  );
}
