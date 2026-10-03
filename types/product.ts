export type ProductKind = "case" | "charger" | "adapter" | "earbuds" | "powerbank" | "cable" | "glass";

export interface ProductColor {
  id: string;
  name: string;
  hex: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  kind: ProductKind;
  categoryId: string;
  /** تومان */
  price: number;
  oldPrice?: number;
  rating: number;
  reviewCount: number;
  stock: number;
  colors: ProductColor[];
  compatibility: string[];
  badge?: "new" | "bestseller";
  /** آیا مدل 3D procedural دارد */
  has3D: boolean;
  blurb: string;
}

export interface Category {
  id: string;
  name: string;
  kind: ProductKind;
  count: number;
  color: string;
}

export interface CartLine {
  key: string;
  productId: string;
  name: string;
  brand: string;
  kind: ProductKind;
  colorName: string;
  colorHex: string;
  unitPrice: number;
  oldPrice?: number;
  qty: number;
  note?: string;
}
