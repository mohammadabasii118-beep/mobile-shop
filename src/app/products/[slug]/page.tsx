import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProduct, products, productsByCategory } from "@/lib/products";
import ProductDetail from "@/components/product/ProductDetail";
import ProductRail from "@/components/home/ProductRail";
import { SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const product = getProduct(params.slug);
  if (!product) return { title: "محصول یافت نشد" };
  return {
    title: product.name,
    description: product.shortDesc,
  };
}

export default function ProductPage({
  params,
}: {
  params: { slug: string };
}) {
  const product = getProduct(params.slug);
  if (!product) notFound();

  const related = productsByCategory(product.categorySlug).filter(
    (p) => p.id !== product.id
  );
  const fallback = products.filter((p) => p.id !== product.id).slice(0, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDesc,
    sku: product.id,
    ...(product.image
      ? { image: `${SITE_URL}${product.image}` }
      : {}),
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: product.rating,
      reviewCount: product.reviews,
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "IRT",
      price: product.price,
      availability:
        product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: `${SITE_URL}/products/${product.slug}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetail product={product} />
      <ProductRail
        title="محصولات مرتبط"
        products={related.length ? related : fallback}
        href={`/products?cat=${product.categorySlug}`}
      />
    </>
  );
}
