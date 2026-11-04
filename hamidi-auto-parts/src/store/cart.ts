"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useSyncExternalStore } from "react";
import type { CartItem } from "@/lib/cart-item";

export interface CartLine {
  id: string;
  qty: number;
  item: CartItem;
}

interface CartState {
  lines: CartLine[];
  add: (item: CartItem, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  restore: (lines: CartLine[]) => void;
  clear: () => void;
}

const clamp = (n: number, max: number) => Math.max(1, Math.min(max, n));

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (item, qty = 1) =>
        set((s) => {
          const found = s.lines.find((l) => l.id === item.id);
          if (found) return { lines: s.lines.map((l) => (l.id === item.id ? { ...l, item, qty: clamp(l.qty + qty, item.maxQty) } : l)) };
          return { lines: [...s.lines, { id: item.id, item, qty: clamp(qty, item.maxQty) }] };
        }),
      setQty: (id, qty) => set((s) => ({ lines: s.lines.map((l) => (l.id === id ? { ...l, qty: clamp(qty, l.item.maxQty) } : l)) })),
      remove: (id) => set((s) => ({ lines: s.lines.filter((l) => l.id !== id) })),
      restore: (lines) => set({ lines }),
      clear: () => set({ lines: [] }),
    }),
    {
      name: "hamidi-cart",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      // v1 stored only ids; those lines cannot be rendered without the catalogue, so drop them
      migrate: () => ({ lines: [] }),
    },
  ),
);

const noop = () => () => {};
/** true only after hydration, so persisted values never cause hydration mismatches */
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}

export function useCartCount() {
  const hydrated = useHydrated();
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  return hydrated ? count : 0;
}
