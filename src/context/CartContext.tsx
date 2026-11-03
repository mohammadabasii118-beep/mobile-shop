import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react'
import { getProduct, type Product } from '../data/products'

export interface CartLine {
  id: string
  color: string
  qty: number
}

interface CartState {
  lines: CartLine[]
}

type Action =
  | { type: 'add'; id: string; color: string; qty?: number }
  | { type: 'remove'; id: string; color: string }
  | { type: 'setQty'; id: string; color: string; qty: number }
  | { type: 'clear' }
  | { type: 'hydrate'; lines: CartLine[] }

const STORAGE_KEY = 'aurora-cart-v1'

function reducer(state: CartState, action: Action): CartState {
  switch (action.type) {
    case 'add': {
      const existing = state.lines.find(
        (l) => l.id === action.id && l.color === action.color,
      )
      if (existing) {
        return {
          lines: state.lines.map((l) =>
            l === existing ? { ...l, qty: l.qty + (action.qty ?? 1) } : l,
          ),
        }
      }
      return {
        lines: [
          ...state.lines,
          { id: action.id, color: action.color, qty: action.qty ?? 1 },
        ],
      }
    }
    case 'remove':
      return {
        lines: state.lines.filter(
          (l) => !(l.id === action.id && l.color === action.color),
        ),
      }
    case 'setQty':
      return {
        lines: state.lines
          .map((l) =>
            l.id === action.id && l.color === action.color
              ? { ...l, qty: Math.max(0, action.qty) }
              : l,
          )
          .filter((l) => l.qty > 0),
      }
    case 'clear':
      return { lines: [] }
    case 'hydrate':
      return { lines: action.lines }
    default:
      return state
  }
}

export interface EnrichedLine extends CartLine {
  product: Product
  lineTotal: number
}

interface CartContextValue {
  lines: EnrichedLine[]
  count: number
  subtotal: number
  isOpen: boolean
  open: () => void
  close: () => void
  add: (id: string, color: string, qty?: number) => void
  remove: (id: string, color: string) => void
  setQty: (id: string, color: string, qty: number) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { lines: [] })
  const [isOpen, setIsOpen] = useState(false)

  // Hydrate from localStorage once.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as CartLine[]
        if (Array.isArray(parsed)) dispatch({ type: 'hydrate', lines: parsed })
      }
    } catch {
      /* ignore storage errors (private mode, blocked, etc.) */
    }
  }, [])

  // Persist.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.lines))
    } catch {
      /* ignore */
    }
  }, [state.lines])

  const add = useCallback((id: string, color: string, qty = 1) => {
    dispatch({ type: 'add', id, color, qty })
    setIsOpen(true)
  }, [])
  const remove = useCallback(
    (id: string, color: string) => dispatch({ type: 'remove', id, color }),
    [],
  )
  const setQty = useCallback(
    (id: string, color: string, qty: number) =>
      dispatch({ type: 'setQty', id, color, qty }),
    [],
  )
  const clear = useCallback(() => dispatch({ type: 'clear' }), [])

  const enriched = useMemo<EnrichedLine[]>(() => {
    return state.lines
      .map((l) => {
        const product = getProduct(l.id)
        if (!product) return null
        return { ...l, product, lineTotal: product.price * l.qty }
      })
      .filter((x): x is EnrichedLine => x !== null)
  }, [state.lines])

  const count = useMemo(
    () => enriched.reduce((sum, l) => sum + l.qty, 0),
    [enriched],
  )
  const subtotal = useMemo(
    () => enriched.reduce((sum, l) => sum + l.lineTotal, 0),
    [enriched],
  )

  const value: CartContextValue = {
    lines: enriched,
    count,
    subtotal,
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    add,
    remove,
    setQty,
    clear,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
