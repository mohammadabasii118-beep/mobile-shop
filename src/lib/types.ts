export type Attribute = {
  id: number;
  slug: string;
  name: string;
  type: 'select' | 'color';
  parent_attribute_id: number | null;
  sort: number;
};

export type Term = {
  id: number;
  attribute_id: number;
  slug: string;
  name: string;
  value: string | null;
  parent_term_id: number | null;
  sort: number;
};

export type Variation = {
  id: number;
  product_id: number;
  sku: string | null;
  price: number;
  sale_price: number | null;
  stock: number;
  image: string | null;
  attrs: Record<string, string>;
  status: 'active' | 'disabled';
};

export type ProductAttr = {
  attribute: Attribute;
  terms: Term[];
  for_variations: boolean;
};

export type Badge = 'new' | 'best' | 'promo';

export type CardData = {
  id: number;
  slug: string;
  name: string;
  brand: string | null;
  image: string | null;
  color: string | null;
  price: number;
  old: number | null;
  off: number;
  stock: number;
  variable: boolean;
  rating: number;
  ratingCount: number;
  badge: Badge | null;
  colors: string[];
};

export type Spec = { k: string; v: string };

export type ProductFull = {
  id: number;
  slug: string;
  name: string;
  brand: { id: number; name: string; slug: string } | null;
  category: { id: number; name: string; slug: string } | null;
  short_desc: string;
  description: string;
  type: 'simple' | 'variable';
  sku: string | null;
  price: number;
  sale_price: number | null;
  stock: number;
  images: string[];
  specs: Spec[];
  badge: Badge | null;
  status: 'published' | 'draft';
  featured: boolean;
  attributes: ProductAttr[];
  variations: Variation[];
  rating: number;
  ratingCount: number;
};

export type Banner = {
  id: number;
  position: 'hero' | 'promo';
  layout: 'split' | 'cover';
  theme: 'night' | 'light' | 'brand';
  badge: string;
  title: string;
  subtitle: string;
  cta_text: string;
  link: string;
  image: string | null;
  image_mobile: string | null;
  art: string | null;
  sort: number;
  active: number;
  starts_at: string | null;
  ends_at: string | null;
};

export type CartLine = {
  key: string;
  productId: number;
  variationId: number | null;
  qty: number;
  name: string;
  slug: string;
  label: string;
  image: string | null;
  color: string | null;
  price: number;
  old: number | null;
  stock: number;
  ok: boolean;
  issue?: string;
};

export type CartInput = { productId: number; variationId: number | null; qty: number };
