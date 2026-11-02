"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type { Product, ColorOption } from "./products";

export type CartItem = {
  id: string;
  slug: string;
  name: string;
  price: number;
  hue: number;
  color: ColorOption;
  qty: number;
};

type State = { items: CartItem[] };

type Action =
  | { type: "ADD"; product: Product; color: ColorOption; qty?: number }
  | { type: "REMOVE"; id: string; colorHex: string }
  | { type: "SET_QTY"; id: string; colorHex: string; qty: number }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; items: CartItem[] };

const STORAGE_KEY = "luxe-cart-v1";

function keyOf(id: string, colorHex: string) {
  return `${id}__${colorHex}`;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE":
      return { items: action.items };
    case "ADD": {
      const { product, color, qty = 1 } = action;
      const idx = state.items.findIndex(
        (i) => keyOf(i.id, i.color.hex) === keyOf(product.id, color.hex)
      );
      if (idx >= 0) {
        const items = [...state.items];
        items[idx] = { ...items[idx], qty: items[idx].qty + qty };
        return { items };
      }
      return {
        items: [
          ...state.items,
          {
            id: product.id,
            slug: product.slug,
            name: product.name,
            price: product.price,
            hue: product.hue,
            color,
            qty,
          },
        ],
      };
    }
    case "REMOVE":
      return {
        items: state.items.filter(
          (i) => keyOf(i.id, i.color.hex) !== keyOf(action.id, action.colorHex)
        ),
      };
    case "SET_QTY":
      return {
        items: state.items.map((i) =>
          keyOf(i.id, i.color.hex) === keyOf(action.id, action.colorHex)
            ? { ...i, qty: Math.max(1, action.qty) }
            : i
        ),
      };
    case "CLEAR":
      return { items: [] };
    default:
      return state;
  }
}

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (product: Product, color: ColorOption, qty?: number) => void;
  remove: (id: string, colorHex: string) => void;
  setQty: (id: string, colorHex: string, qty: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [] });

  // Hydrate from localStorage (per-viewer convenience only).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "HYDRATE", items: JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      /* ignore */
    }
  }, [state.items]);

  const value = useMemo<CartContextValue>(() => {
    const count = state.items.reduce((s, i) => s + i.qty, 0);
    const subtotal = state.items.reduce((s, i) => s + i.qty * i.price, 0);
    return {
      items: state.items,
      count,
      subtotal,
      add: (product, color, qty) => dispatch({ type: "ADD", product, color, qty }),
      remove: (id, colorHex) => dispatch({ type: "REMOVE", id, colorHex }),
      setQty: (id, colorHex, qty) =>
        dispatch({ type: "SET_QTY", id, colorHex, qty }),
      clear: () => dispatch({ type: "CLEAR" }),
    };
  }, [state.items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
