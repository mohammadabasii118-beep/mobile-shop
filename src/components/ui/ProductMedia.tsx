import type { Product } from "@/lib/products";
import ProductArt from "./ProductArt";

/**
 * Renders a product's real image when available, otherwise a clean, clearly
 * stylized placeholder (never a random photo passed off as the real product).
 * Drop real images in /public/images/products and set `image` on the product.
 */
export default function ProductMedia({
  product,
  className = "",
}: {
  product: Product;
  className?: string;
}) {
  if (product.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={product.image}
        alt={product.name}
        loading="lazy"
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }
  return (
    <ProductArt
      hue={product.hue}
      categorySlug={product.categorySlug}
      className={className}
    />
  );
}
