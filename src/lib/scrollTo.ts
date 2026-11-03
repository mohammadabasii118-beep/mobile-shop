import { getLenis } from './useLenis'

/** Smoothly scrolls to an element by id, using Lenis when available. */
export function scrollToId(id: string, offset = 0) {
  const el = document.getElementById(id)
  if (!el) return
  const lenis = getLenis()
  if (lenis) {
    lenis.scrollTo(el, { offset, duration: 1.4 })
  } else {
    const top = el.getBoundingClientRect().top + window.scrollY + offset
    window.scrollTo({ top, behavior: 'smooth' })
  }
}
