import type { CartLine, Product, ProductColor } from "@/types/product";

/** snapshot محصول برای سبد (مثل سبدهای واقعی، قیمت لحظهٔ افزودن ثبت می‌شود) */
export function buildLine(product: Product, color: ProductColor): Omit<CartLine, "qty"> {
  return {
    key: `${product.id}:${color.id}`,
    productId: product.id,
    name: product.name,
    brand: product.brand,
    kind: product.kind,
    colorName: color.name,
    colorHex: color.hex,
    unitPrice: product.price,
    oldPrice: product.oldPrice,
  };
}
