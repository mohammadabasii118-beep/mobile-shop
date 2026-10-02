import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartLine, Toast, User } from '@/types';
import { products } from '@/data/products';

interface ShopState {
  // cart (persisted)
  cart: CartLine[];
  addToCart: (productId: string, opts?: { model?: string; color?: string; quantity?: number; custom?: CartLine['custom'] }) => void;
  removeFromCart: (key: string) => void;
  setQuantity: (key: string, q: number) => void;
  clearCart: () => void;
  coupon: { code: string; percent: number } | null;
  applyCoupon: (code: string) => boolean;
  // wishlist (persisted)
  wishlist: string[];
  toggleWishlist: (id: string) => void;
  // user (persisted)
  user: User;
  login: (u: Partial<User>) => void;
  logout: () => void;
  // search (persisted)
  recentSearches: string[];
  addRecentSearch: (q: string) => void;
  clearRecent: () => void;
  // UI (not persisted)
  toasts: Toast[];
  notify: (message: string, type?: Toast['type']) => void;
  dismissToast: (id: number) => void;
  cartOpen: boolean; setCartOpen: (v: boolean) => void;
  searchOpen: boolean; setSearchOpen: (v: boolean) => void;
  menuOpen: boolean; setMenuOpen: (v: boolean) => void;
  quickView: string | null; setQuickView: (id: string | null) => void;
  cartPulse: number;
}

let toastId = 1;
const COUPONS: Record<string, number> = { WELCOME10: 10, CASE20: 20 };

export const useShop = create<ShopState>()(
  persist(
    (set, get) => ({
      cart: [],
      coupon: null,
      addToCart: (productId, opts = {}) => {
        const p = products.find((x) => x.id === productId);
        if (!p || p.stock <= 0) { get().notify('این محصول ناموجود است', 'error'); return; }
        const model = opts.model ?? p.models[0];
        const color = opts.color ?? p.colors[0]?.name;
        const key = [productId, model, color, opts.custom?.text ?? ''].join('|');
        const qty = opts.quantity ?? 1;
        set((s) => {
          const ex = s.cart.find((l) => l.key === key);
          const cart = ex
            ? s.cart.map((l) => (l.key === key ? { ...l, quantity: Math.min(p.stock, l.quantity + qty) } : l))
            : [...s.cart, { key, productId, model, color, quantity: qty, custom: opts.custom }];
          return { cart, cartPulse: s.cartPulse + 1 };
        });
        get().notify('محصول به سبد خرید اضافه شد.');
      },
      removeFromCart: (key) => set((s) => ({ cart: s.cart.filter((l) => l.key !== key) })),
      setQuantity: (key, q) =>
        set((s) => ({ cart: q <= 0 ? s.cart.filter((l) => l.key !== key) : s.cart.map((l) => (l.key === key ? { ...l, quantity: q } : l)) })),
      clearCart: () => set({ cart: [], coupon: null }),
      applyCoupon: (code) => {
        const percent = COUPONS[code.trim().toUpperCase()];
        if (!percent) { get().notify('کد تخفیف معتبر نیست', 'error'); return false; }
        set({ coupon: { code: code.trim().toUpperCase(), percent } });
        get().notify(`کد تخفیف ${percent}٪ اعمال شد`);
        return true;
      },
      wishlist: [],
      toggleWishlist: (id) => {
        const has = get().wishlist.includes(id);
        set((s) => ({ wishlist: has ? s.wishlist.filter((x) => x !== id) : [...s.wishlist, id] }));
        get().notify(has ? 'از علاقه‌مندی‌ها حذف شد' : 'به علاقه‌مندی‌ها اضافه شد', 'info');
      },
      user: { id: 'u1', name: 'علی رضایی', phone: '09121234567', email: 'ali@example.com', loggedIn: false },
      login: (u) => set((s) => ({ user: { ...s.user, ...u, loggedIn: true } })),
      logout: () => set((s) => ({ user: { ...s.user, loggedIn: false } })),
      recentSearches: ['قاب آیفون 16', 'شارژر 33 وات'],
      addRecentSearch: (q) => q.trim() && set((s) => ({ recentSearches: [q.trim(), ...s.recentSearches.filter((x) => x !== q.trim())].slice(0, 6) })),
      clearRecent: () => set({ recentSearches: [] }),
      toasts: [],
      notify: (message, type = 'success') => {
        const id = toastId++;
        set((s) => ({ toasts: [...s.toasts, { id, message, type }].slice(-3) }));
        setTimeout(() => get().dismissToast(id), 2800);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      cartOpen: false, setCartOpen: (v) => set({ cartOpen: v }),
      searchOpen: false, setSearchOpen: (v) => set({ searchOpen: v }),
      menuOpen: false, setMenuOpen: (v) => set({ menuOpen: v }),
      quickView: null, setQuickView: (id) => set({ quickView: id }),
      cartPulse: 0,
    }),
    {
      name: 'caseline-store',
      partialize: (s) => ({ cart: s.cart, wishlist: s.wishlist, user: s.user, recentSearches: s.recentSearches, coupon: s.coupon }),
    },
  ),
);

// Filters store for the shop page
export interface Filters {
  q: string; categories: string[]; brands: string[]; models: string[]; colors: string[];
  maxPrice: number; inStock: boolean; discounted: boolean; sort: 'new' | 'cheap' | 'expensive' | 'popular' | 'discount';
}
export const defaultFilters: Filters = { q: '', categories: [], brands: [], models: [], colors: [], maxPrice: 2_000_000, inStock: false, discounted: false, sort: 'popular' };

interface FilterState { filters: Filters; set: (p: Partial<Filters>) => void; reset: () => void; filterOpen: boolean; sortOpen: boolean; setFilterOpen: (v: boolean) => void; setSortOpen: (v: boolean) => void }
export const useFilters = create<FilterState>((set) => ({
  filters: defaultFilters,
  set: (p) => set((s) => ({ filters: { ...s.filters, ...p } })),
  reset: () => set({ filters: defaultFilters }),
  filterOpen: false, sortOpen: false,
  setFilterOpen: (v) => set({ filterOpen: v }), setSortOpen: (v) => set({ sortOpen: v }),
}));

// Theme (dark only for now, ready to extend)
export const useTheme = create<{ theme: 'dark'; }>(() => ({ theme: 'dark' }));
