"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useSyncExternalStore } from "react";

export interface CartLine {
  id: string;
  qty: number;
}

interface CartState {
  items: CartLine[];
  add: (id: string, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  increment: (id: string) => void;
  decrement: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const MAX_QTY = 20;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (id, qty = 1) =>
        set((s) => {
          const found = s.items.find((i) => i.id === id);
          if (found) {
            return { items: s.items.map((i) => (i.id === id ? { ...i, qty: Math.min(MAX_QTY, i.qty + qty) } : i)) };
          }
          return { items: [...s.items, { id, qty: Math.min(MAX_QTY, qty) }] };
        }),
      setQty: (id, qty) =>
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, qty: Math.max(1, Math.min(MAX_QTY, qty)) } : i)) })),
      increment: (id) =>
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, qty: Math.min(MAX_QTY, i.qty + 1) } : i)) })),
      decrement: (id) =>
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, qty: Math.max(1, i.qty - 1) } : i)) })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    { name: "hamidi-cart", storage: createJSONStorage(() => localStorage), version: 1 },
  ),
);

const noop = () => () => {};
/** true only after the first client render, so persisted cart values never cause hydration mismatches */
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}

export function useCartCount() {
  const hydrated = useHydrated();
  const count = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));
  return hydrated ? count : 0;
}
