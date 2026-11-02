"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";

type State = { ids: string[] };
type Action =
  | { type: "TOGGLE"; id: string }
  | { type: "REMOVE"; id: string }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; ids: string[] };

const STORAGE_KEY = "luxe-wishlist-v1";

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE":
      return { ids: action.ids };
    case "TOGGLE":
      return {
        ids: state.ids.includes(action.id)
          ? state.ids.filter((i) => i !== action.id)
          : [...state.ids, action.id],
      };
    case "REMOVE":
      return { ids: state.ids.filter((i) => i !== action.id) };
    case "CLEAR":
      return { ids: [] };
    default:
      return state;
  }
}

type WishlistValue = {
  ids: string[];
  count: number;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const WishlistContext = createContext<WishlistValue | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { ids: [] });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "HYDRATE", ids: JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.ids));
    } catch {
      /* ignore */
    }
  }, [state.ids]);

  const value = useMemo<WishlistValue>(
    () => ({
      ids: state.ids,
      count: state.ids.length,
      has: (id) => state.ids.includes(id),
      toggle: (id) => dispatch({ type: "TOGGLE", id }),
      remove: (id) => dispatch({ type: "REMOVE", id }),
      clear: () => dispatch({ type: "CLEAR" }),
    }),
    [state.ids]
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
