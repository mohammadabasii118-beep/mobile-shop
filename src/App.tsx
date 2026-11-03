import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import Preloader from './components/Preloader'
import Navbar from './components/Navbar'
import ScrollStory from './components/ScrollStory'
import FeatureBar from './components/FeatureBar'
import CategoryShowcase from './components/shop/CategoryShowcase'
import Highlights from './components/shop/Highlights'
import CategoryShop from './components/shop/CategoryShop'
import Contact from './components/Contact'
import Footer from './components/Footer'
import CartDrawer from './components/CartDrawer'
import ProductModal from './components/shop/ProductModal'
import { CartProvider } from './context/CartContext'
import { useLenis } from './lib/useLenis'
import { useReducedMotion } from './lib/useReducedMotion'
import type { Product } from './data/products'
import { ScrollTrigger } from './lib/gsap'

export default function App() {
  const reduced = useReducedMotion()
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<Product | null>(null)

  // Smooth scroll (disabled under reduced-motion).
  useLenis(!reduced && !loading)

  // Recalculate ScrollTrigger once the intro finishes and layout is final.
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => ScrollTrigger.refresh(), 200)
      return () => clearTimeout(t)
    }
  }, [loading])

  return (
    <CartProvider>
      <AnimatePresence>
        {loading && <Preloader onDone={() => setLoading(false)} />}
      </AnimatePresence>

      <div id="top" />
      <Navbar />

      <main>
        <ScrollStory reduced={reduced} />
        <FeatureBar />
        <CategoryShowcase />
        <Highlights onOpen={setActive} />
        <CategoryShop onOpen={setActive} />
        <Contact />
      </main>

      <Footer />

      <CartDrawer />
      <ProductModal product={active} onClose={() => setActive(null)} />
    </CartProvider>
  )
}
