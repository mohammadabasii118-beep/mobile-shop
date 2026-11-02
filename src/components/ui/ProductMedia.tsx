import Image from "next/image";
import type { Product } from "@/lib/products";
import ProductArt from "./ProductArt";

/**
 * Renders a product's real image (optimized via next/image) when available,
 * otherwise a clean, clearly stylized placeholder — never a random photo passed
 * off as the real product. Drop real images in /public/images/products and set
 * `image` (optionally `gallery`) on the product.
 *
 * `src` can override the product image (e.g. when switching gallery angles).
 */
export default function ProductMedia({
  product,
  src,
  className = "",
  sizes = "(max-width: 768px) 50vw, 25vw",
  priority = false,
}: {
  product: Product;
  src?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const img = src ?? product.image;
  if (img) {
    return (
      <Image
        src={img}
        alt={product.name}
        fill
        sizes={sizes}
        priority={priority}
        className={`object-cover ${className}`}
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
