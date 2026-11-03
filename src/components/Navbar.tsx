import { useEffect, useState } from 'react'
import { useCart } from '../context/CartContext'
import { scrollToId } from '../lib/scrollTo'

const LINKS = [
  { id: 'story', label: 'داستان' },
  { id: 'bestsellers', label: 'پرفروش‌ها' },
  { id: 'shop', label: 'فروشگاه' },
  { id: 'contact', label: 'ارتباط' },
]

export default function Navbar() {
  const { count, open } = useCart()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const go = (id: string) => {
    setMenuOpen(false)
    scrollToId(id, -70)
  }

  return (
    <header
      className={
        'fixed inset-x-0 top-0 z-50 transition-all duration-500 ' +
        (scrolled
          ? 'glass border-b border-white/5 py-3'
          : 'bg-transparent py-5')
      }
    >
      <nav className="mx-auto flex max-w-8xl items-center justify-between px-5 sm:px-8">
        {/* Logo */}
        <button
          onClick={() => go('top')}
          className="flex items-center gap-2 text-white"
          aria-label="آورا"
        >
          <span className="relative grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-white to-silver-300 text-ink-950">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M12 2a1 1 0 0 1 .9.56l2.3 4.66 5.14.75a1 1 0 0 1 .56 1.7l-3.72 3.63.88 5.12a1 1 0 0 1-1.45 1.05L12 17.9l-4.6 2.42a1 1 0 0 1-1.45-1.05l.88-5.12-3.72-3.63a1 1 0 0 1 .56-1.7l5.14-.75L11.1 2.56A1 1 0 0 1 12 2z" />
            </svg>
          </span>
          <span className="font-latin text-lg font-bold tracking-tight">
            Aurora
          </span>
        </button>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <button
              key={l.id}
              onClick={() => go(l.id)}
              className="rounded-full px-4 py-2 text-sm text-silver-200 transition-colors hover:text-white"
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Cart */}
          <button
            onClick={open}
            className="relative grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10"
            aria-label="سبد خرید"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" strokeLinejoin="round" />
              <path d="M3 6h18M16 10a4 4 0 0 1-8 0" strokeLinecap="round" />
            </svg>
            {count > 0 && (
              <span className="font-latin absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-ink-950">
                {count}
              </span>
            )}
          </button>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-white md:hidden"
            aria-label="منو"
            aria-expanded={menuOpen}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="glass mx-4 mt-3 grid gap-1 rounded-2xl border border-white/10 p-2 md:hidden">
          {LINKS.map((l) => (
            <button
              key={l.id}
              onClick={() => go(l.id)}
              className="rounded-xl px-4 py-3 text-right text-sm text-silver-100 transition-colors hover:bg-white/5"
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </header>
  )
}
