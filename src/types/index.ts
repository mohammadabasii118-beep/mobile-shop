export type CategorySlug = 'cases' | 'screen-protectors' | 'chargers' | 'cables' | 'power-banks' | 'accessories';

export interface Category {
  slug: CategorySlug;
  name: string;
  description: string;
  hue: string; // main accent color for the category art
}

export type ArtKind = 'case' | 'glass' | 'charger' | 'cable' | 'powerbank' | 'holder' | 'adapter' | 'lens' | 'bag';

export interface ProductColor { name: string; hex: string }

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: CategorySlug;
  brand: string;
  sku: string;
  description: string;
  price: number; // تومان
  oldPrice?: number;
  rating: number;
  reviewCount: number;
  stock: number;
  reserved: number;
  minStock: number;
  models: string[];
  colors: ProductColor[];
  tags: string[];
  art: ArtKind;
  isFeatured?: boolean;
  isBestseller?: boolean;
  isNew?: boolean;
}

export interface CartLine {
  key: string;
  productId: string;
  model?: string;
  color?: string;
  quantity: number;
  custom?: { text?: string; image?: string };
}

export interface User { id: string; name: string; phone: string; email: string; loggedIn: boolean }

export interface Toast { id: number; message: string; type: 'success' | 'info' | 'error' }

export type OrderStatus = 'registered' | 'paid' | 'preparing' | 'shipped' | 'delivered';

export interface Order {
  id: string;
  date: string;
  items: { productId: string; quantity: number }[];
  total: number;
  paymentStatus: 'paid' | 'pending' | 'failed' | 'refunded';
  status: OrderStatus;
  customer: string;
  phone: string;
  address: string;
}

export interface WalletTx { id: string; date: string; title: string; amount: number }
export interface PointTx { id: string; date: string; title: string; points: number }

export interface Review {
  id: string; productId: string; customer: string; rating: number; text: string; date: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Coupon {
  code: string; kind: 'percent' | 'fixed' | 'free-shipping'; value: number;
  start: string; end: string; minOrder: number; usageLimit: number; used: number; scope: string;
}
