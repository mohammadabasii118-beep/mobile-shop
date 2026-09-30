/** View models passed from server queries to UI components. */
export interface CardProduct {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  kind: string; // placeholder artwork kind when there is no photo
  hue: number;
  price: number; // effective retail price (Toman)
  oldPrice?: number;
  rating: number;
  reviews: number;
  badge?: string;
  compat?: string;
  img?: string;
  categorySlug: string;
  categoryLabel: string;
  inStock: boolean;
}

export interface MenuCategory {
  slug: string;
  label: string;
  subs: { slug: string; label: string }[];
}

export interface SiteInfo {
  name: string;
  tagline?: string;
  phone: string;
  email: string;
  address: string;
  hours: string;
  telegram: string;
  instagram: string;
  topBar: string;
  footerText: string;
  logo?: string;
  favicon?: string;
}

/** One selectable variant on the product page (phone brand → model → colour), priced and stocked independently. */
export interface VariantOption {
  id: string; sku: string; stock: number;
  brandId: string | null; brandName: string | null;
  modelId: string | null; modelName: string | null;
  colorId: string | null; colorName: string | null; colorHex: string | null;
  price: number; oldPrice?: number;
  wholesale?: { unit: number; min: number } | null;
}
