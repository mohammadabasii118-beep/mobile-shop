/** Shape stored in the client cart (localStorage). Shared by server and client code. */
export interface CartItem {
  id: string;
  slug: string;
  name: string;
  sku: string;
  oem: string;
  image: string;
  price: number;
  oldPrice?: number;
  maxQty: number;
  fits: string;
  available: boolean;
}

export type SearchSuggestion = { href: string; name: string; sku: string; image: string; price: number; category: string };
