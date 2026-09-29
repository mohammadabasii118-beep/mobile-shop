"use client";
import { createContext, useContext, useEffect, useState } from "react";

export type CartLine = {
  productId: string;
  // Present only for variable products — identifies the exact chosen
  // brand/model/color combination. Two variants of the same product are
  // distinct cart lines.
  variantId?: string | null;
  variantLabel?: string | null;
  name: string;
  price: number;
  image: string;
  qty: number;
};

// A cart line's identity is its variant when present, otherwise the plain
// product id — so two variants of the same product never collapse into one
// line, but a simple product still behaves as before.
export function lineKey(l: Pick<CartLine, "productId" | "variantId">) {
  return l.variantId || l.productId;
}

type CartCtx = {
  lines: CartLine[];
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  addToCart: (line: Omit<CartLine, "qty">, qty?: number) => void;
  changeQty: (key: string, delta: number) => void;
  removeFromCart: (key: string) => void;
  clearCart: () => void;
  count: number;
  total: number;
};

const Ctx = createContext<CartCtx | null>(null);
// Bumped from v1: stored line shape gained variantId/variantLabel.
const STORAGE_KEY = "caseline_cart_v2";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lines)); } catch {}
  }, [lines, hydrated]);

  function addToCart(line: Omit<CartLine, "qty">, qty = 1) {
    setLines((prev) => {
      const key = lineKey(line);
      const existing = prev.find((l) => lineKey(l) === key);
      if (existing) return prev.map((l) => (lineKey(l) === key ? { ...l, qty: l.qty + qty } : l));
      return [...prev, { ...line, qty }];
    });
  }
  function changeQty(key: string, delta: number) {
    setLines((prev) =>
      prev
        .map((l) => (lineKey(l) === key ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0)
    );
  }
  function removeFromCart(key: string) {
    setLines((prev) => prev.filter((l) => lineKey(l) !== key));
  }
  function clearCart() { setLines([]); }

  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);

  return (
    <Ctx.Provider value={{ lines, cartOpen, setCartOpen, addToCart, changeQty, removeFromCart, clearCart, count, total }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
