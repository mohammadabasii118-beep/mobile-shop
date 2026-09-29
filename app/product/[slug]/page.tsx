import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductBySlug, getRelatedProducts, getActiveVariants } from "@/lib/products";
import ProductRail from "@/components/ProductRail";
import AddToCartBox from "@/components/AddToCartBox";
import VariantProductView from "@/components/VariantProductView";
import ProductInfoTabs from "@/components/ProductInfoTabs";
import WishlistButton from "@/components/WishlistButton";
import ReviewsSection from "@/components/ReviewsSection";
import { isWishlisted } from "@/lib/actions/wishlist";
import { getProductReviews, getMyReview } from "@/lib/actions/reviews";
import { getProductQuestions } from "@/lib/actions/questions";
import QASection from "@/components/QASection";
import { getMyPhone } from "@/lib/actions/myPhone";
import { isViewerWholesale, effectivePrice } from "@/lib/wholesalePricing";
import { fmtToman, fa } from "@/lib/format";

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const p = await getProductBySlug(params.slug);
  if (!p) return {};
  return {
    title: p.name,
    description: p.description.slice(0, 150),
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: { images: p.images?.length ? [p.images[0]] : [] },
  };
}

export default async function ProductPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const p = await getProductBySlug(params.slug);
  if (!p || !p.isActive) notFound();
  const related = await getRelatedProducts(p.categoryId, p.id);

  const variants = p.hasVariants ? await getActiveVariants(p.id) : [];
  const wishlisted = await isWishlisted(p.id);
  const [reviewData, myReview, myPhone, isWholesale, questions] = await Promise.all([
    getProductReviews(p.id),
    getMyReview(p.id),
    getMyPhone(),
    isViewerWholesale(),
    getProductQuestions(p.id),
  ]);

  // Wholesale price applies only when the viewer is an approved partner AND
  // this specific product/variant has an admin-set wholesalePrice — see
  // lib/wholesalePricing.ts. A retail "قبل" price is hidden whenever the
  // wholesale price is what's actually shown, to avoid a misleading discount.
  const effProductPrice = effectivePrice(p.price, (p as any).wholesalePrice, isWholesale);
  const effProductOldPrice = isWholesale && (p as any).wholesalePrice != null ? null : p.oldPrice;
  const effVariants = variants.map((v) => ({
    ...v,
    price: effectivePrice(v.price, (v as any).wholesalePrice, isWholesale),
    oldPrice: isWholesale && (v as any).wholesalePrice != null ? null : v.oldPrice,
  }));
  const minVariantPrice = effVariants.length ? Math.min(...effVariants.map((v) => v.price)) : effProductPrice;
  const disc = effProductOldPrice ? Math.round((1 - effProductPrice / effProductOldPrice) * 100) : 0;

  const jsonLd: any = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    image: p.images,
    sku: p.sku || p.id,
    brand: p.brand ? { "@type": "Brand", name: p.brand.name } : undefined,
    // Real aggregate rating from actual submitted reviews only — omitted
    // entirely when there are none, never a placeholder/fabricated value.
    aggregateRating:
      reviewData.count > 0
        ? { "@type": "AggregateRating", ratingValue: reviewData.average.toFixed(1), reviewCount: reviewData.count }
        : undefined,
  };

  if (p.hasVariants && effVariants.length) {
    jsonLd.offers = {
      "@type": "AggregateOffer",
      priceCurrency: "IRT",
      lowPrice: minVariantPrice,
      highPrice: Math.max(...effVariants.map((v) => v.price)),
      offerCount: effVariants.length,
      availability: effVariants.some((v) => v.stock > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    };
  } else {
    jsonLd.offers = {
      "@type": "Offer",
      priceCurrency: "IRT",
      price: effProductPrice,
      availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/product/${p.slug}`,
    };
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <p className="text-sm muted mb-6">
        <Link href="/" className="hover:underline">خانه</Link> ← <Link href={`/category/${p.category.slug}`} className="hover:underline">{p.category.name}</Link> ← {p.name}
      </p>

      {p.hasVariants ? (
        <VariantProductView
          productId={p.id}
          productName={p.name}
          categoryName={p.category.name}
          categoryHref={`/category/${p.category.slug}`}
          brandName={p.brand?.name || null}
          description={p.description}
          fallbackImage={p.images?.[0] || ""}
          initialWishlisted={wishlisted}
          myBrandId={myPhone?.brandId ?? null}
          myPhoneModelId={myPhone?.phoneModelId ?? null}
          variants={effVariants.map((v) => ({
            id: v.id,
            brandId: v.brandId,
            brandName: v.brand?.name || null,
            phoneModelId: v.phoneModelId,
            phoneModelName: v.phoneModel?.name || null,
            colorId: v.colorId,
            colorName: v.color?.name || null,
            colorHex: v.color?.hexCode || null,
            price: v.price,
            oldPrice: v.oldPrice,
            stock: v.stock,
            imageUrl: v.imageUrl,
            isActive: v.isActive,
          }))}
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-10">
          <div className="relative aspect-square rounded-3xl overflow-hidden bg-[var(--surface-2)]">
            {p.images?.[0] && <Image src={p.images[0]} alt={p.name} fill sizes="500px" className="object-cover" />}
          </div>
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-sm muted">{p.category.name}{p.brand ? ` · ${p.brand.name}` : ""}</span>
                <h1 className="text-2xl md:text-3xl font-extrabold mt-1 mb-3">{p.name}</h1>
              </div>
              <WishlistButton productId={p.id} initialWishlisted={wishlisted} />
            </div>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl font-extrabold">{fmtToman(effProductPrice)}</span>
              {effProductOldPrice ? (
                <>
                  <span className="muted line-through text-sm">{fmtToman(effProductOldPrice)}</span>
                  <span className="text-xs px-2 py-1 rounded-full text-white font-bold" style={{ background: "var(--ink)" }}>{fa(disc)}٪-</span>
                </>
              ) : null}
            </div>
            <AddToCartBox product={{ id: p.id, name: p.name, price: effProductPrice, image: p.images?.[0] || "" }} inStock={p.stock > 0} />
            <ProductInfoTabs
              description={p.description}
              specs={[
                { label: "دسته‌بندی", value: p.category.name },
                ...(p.brand ? [{ label: "برند", value: p.brand.name }] : []),
                ...(p.sku ? [{ label: "کد کالا", value: p.sku }] : []),
                ...(p.specs && typeof p.specs === "object"
                  ? Object.entries(p.specs as Record<string, string>).map(([label, value]) => ({ label, value }))
                  : []),
              ]}
            />
          </div>
        </div>
      )}

      <ReviewsSection productId={p.id} reviews={reviewData.reviews} average={reviewData.average} count={reviewData.count} myReview={myReview} />
      <QASection productId={p.id} questions={questions} />

      <ProductRail
        title="محصولات مرتبط"
        products={related.map((r) => ({
          id: r.id, slug: r.slug, name: r.name,
          price: effectivePrice(r.price, (r as any).wholesalePrice, isWholesale),
          oldPrice: isWholesale && (r as any).wholesalePrice != null ? null : r.oldPrice,
          images: r.images, isBestSeller: r.isBestSeller, isNew: r.isNew, isTrending: r.isTrending, hasVariants: r.hasVariants,
          avgRating: r.avgRating, reviewCount: r.reviewCount,
        }))}
      />
    </div>
  );
}
