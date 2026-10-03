"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import type { CartLine } from "@/types/product";
import { COUPONS, cartTotals } from "@/lib/pricing";

type Action =
  | { type: "hydrate"; lines: CartLine[] }
  | { type: "add"; line: Omit<CartLine, "qty">; qty: number }
  | { type: "qty"; key: string; qty: number }
  | { type: "remove"; key: string };

function reducer(state: CartLine[], action: Action): CartLine[] {
  switch (action.type) {
    case "hydrate":
      return action.lines;
    case "add": {
      const existing = state.find((l) => l.key === action.line.key);
      if (existing) return state.map((l) => (l.key === existing.key ? { ...l, qty: Math.min(l.qty + action.qty, 10) } : l));
      return [...state, { ...action.line, qty: action.qty }];
    }
    case "qty":
      return state.map((l) => (l.key === action.key ? { ...l, qty: Math.max(1, Math.min(10, action.qty)) } : l));
    case "remove":
      return state.filter((l) => l.key !== action.key);
  }
}

interface CartApi {
  lines: CartLine[];
  totals: ReturnType<typeof cartTotals>;
  open: boolean;
  setOpen: (v: boolean) => void;
  /** شمارندهٔ افزایشی برای انیمیشن badge */
  bump: number;
  coupon: string | null;
  couponError: boolean;
  add: (line: Omit<CartLine, "qty">, qty?: number, openDrawer?: boolean) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  applyCoupon: (code: string) => boolean;
  clearCoupon: () => void;
}

const CartContext = createContext<CartApi | null>(null);
const STORAGE_KEY = "volta-cart-v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, dispatch] = useReducer(reducer, []);
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(0);
  const [coupon, setCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "hydrate", lines: JSON.parse(raw) });
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {}
  }, [lines, hydrated]);

  const add = useCallback<CartApi["add"]>((line, qty = 1, openDrawer = true) => {
    dispatch({ type: "add", line, qty });
    setBump((b) => b + 1);
    if (openDrawer) setOpen(true);
  }, []);

  const value = useMemo<CartApi>(
    () => ({
      lines,
      totals: cartTotals(lines, coupon),
      open,
      setOpen,
      bump,
      coupon,
      couponError,
      add,
      setQty: (key, qty) => dispatch({ type: "qty", key, qty }),
      remove: (key) => dispatch({ type: "remove", key }),
      applyCoupon: (code) => {
        const c = code.trim().toUpperCase();
        const ok = c in COUPONS;
        setCoupon(ok ? c : null);
        setCouponError(!ok);
        return ok;
      },
      clearCoupon: () => {
        setCoupon(null);
        setCouponError(false);
      },
    }),
    [lines, coupon, couponError, open, bump, add],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
