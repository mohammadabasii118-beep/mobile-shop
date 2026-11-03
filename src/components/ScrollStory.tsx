import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '../lib/gsap'
import type { ArtKey } from '../data/products'
import ProductArt from './art/ProductArt'
import { scrollToId } from '../lib/scrollTo'

interface Layer {
  key: string
  art: ArtKey
  color?: string
  /** final resting place within the stage */
  pos: { left: string; top: string; width: string; z: number }
  /** entry transform applied before the stage reveal */
  entry: gsap.TweenVars
  /** timeline time at which this layer flies in */
  stage: number
  delay?: number
}

const PHONE: Layer = {
  key: 'phone',
  art: 'iphone',
  pos: { left: '50%', top: '50%', width: 'clamp(150px, 29vw, 258px)', z: 20 },
  entry: { opacity: 0, scale: 0.82, y: 46 },
  stage: 0,
}

const LAYERS: Layer[] = [
  {
    key: 'case',
    art: 'case',
    color: '#20232b',
    pos: { left: '19%', top: '47%', width: 'clamp(96px, 16vw, 158px)', z: 10 },
    entry: { opacity: 0, x: 360, y: -30, rotate: 42, scale: 1.25 },
    stage: 1,
  },
  {
    key: 'glass',
    art: 'glass',
    pos: { left: '81%', top: '43%', width: 'clamp(86px, 15vw, 146px)', z: 30 },
    entry: { opacity: 0, scale: 1.95, y: -8 },
    stage: 2,
  },
  {
    key: 'adapter',
    art: 'adapter',
    pos: { left: '25%', top: '79%', width: 'clamp(86px, 15vw, 140px)', z: 12 },
    entry: { opacity: 0, x: -40, y: 380, rotate: -24, scale: 0.6 },
    stage: 3,
  },
  {
    key: 'cable',
    art: 'cable',
    color: '#1b1b1f',
    pos: { left: '20%', top: '19%', width: 'clamp(84px, 14vw, 132px)', z: 11 },
    entry: { opacity: 0, x: -300, y: -220, rotate: -55, scale: 0.8 },
    stage: 3,
    delay: 0.18,
  },
  {
    key: 'powerbank',
    art: 'powerbank',
    color: '#1b1b20',
    pos: { left: '76%', top: '79%', width: 'clamp(74px, 12vw, 122px)', z: 12 },
    entry: { opacity: 0, x: 380, y: 120, rotate: 35, scale: 0.8 },
    stage: 4,
  },
  {
    key: 'airpods',
    art: 'airpods',
    pos: { left: '80%', top: '19%', width: 'clamp(96px, 16vw, 152px)', z: 13 },
    entry: { opacity: 0, x: 80, y: -360, rotate: -26, scale: 0.7 },
    stage: 5,
  },
]

const CAPTIONS = [
  {
    title: 'تجربه‌ای فراتر از یک گوشی',
    sub: 'هر چیزی که آیفون شما به آن نیاز دارد، اینجاست.',
  },
  { title: 'زیبایی در کنار محافظت', sub: 'قابی که با گوشی شما یکی می‌شود.' },
  {
    title: 'محافظت نامرئی، شفافیت بی‌نهایت',
    sub: 'گلسی که هست، اما دیده نمی‌شود.',
  },
  { title: 'همیشه آماده شارژ', sub: 'شارژ سریع، هر جا که باشید.' },
  { title: 'انرژی بدون محدودیت', sub: 'اتصال مغناطیسی، انرژی همیشگی.' },
  { title: 'صدایی فراتر از انتظار', sub: 'سکوت را بشنوید، موسیقی را زندگی کنید.' },
  {
    title: 'تمام چیزی که آیفون شما نیاز دارد',
    sub: 'همه لوازم جانبی مورد نیاز شما، در یک مقصد.',
  },
]

const STAGES = CAPTIONS.length // 7

interface ScrollStoryProps {
  reduced: boolean
}

export default function ScrollStory({ reduced }: ScrollStoryProps) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reduced) return
    const stage = stageRef.current
    const section = sectionRef.current
    if (!stage || !section) return

    const ctx = gsap.context(() => {
      // The iPhone is present from the very start (it is the hero), so it
      // reveals with a one-off intro rather than being tied to scroll.
      gsap.set('[data-layer="phone"]', { opacity: 1, scale: 1, y: 0 })
      gsap.from('[data-layer="phone"]', {
        opacity: 0,
        scale: 0.86,
        y: 44,
        duration: 1.2,
        ease: 'power3.out',
        delay: 0.15,
      })
      LAYERS.forEach((l) => gsap.set(`[data-layer="${l.key}"]`, l.entry))
      gsap.set('[data-caption]', { opacity: 0, y: 28 })
      gsap.set('[data-caption="0"]', { opacity: 1, y: 0 })
      gsap.set('[data-glow]', { opacity: 0.25 })
      gsap.set('[data-hint]', { opacity: 0 })

      const tl = gsap.timeline({
        defaults: { ease: 'power3.out' },
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: `+=${STAGES * 100}%`,
          scrub: 1,
          pin: stage,
          pinSpacing: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      })

      const rest = { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }

      // Stage 0 — iPhone already visible; just the scroll hint
      tl.to('[data-hint]', { opacity: 1, duration: 0.3 }, 0.3)
      tl.to('[data-hint]', { opacity: 0, duration: 0.3 }, 0.85)

      // Stages 1..5 — accessories fly in
      LAYERS.forEach((l) => {
        tl.to(
          `[data-layer="${l.key}"]`,
          { ...rest, duration: 0.95 },
          l.stage + (l.delay ?? 0),
        )
      })

      // Glow intensifies as the collection builds
      tl.to('[data-glow]', { opacity: 0.75, duration: 2 }, 2)

      // Stage 6 — settle into the full collection
      tl.to('[data-layer="phone"]', { scale: 0.92, duration: 0.8 }, 6)
      tl.to('[data-glow]', { opacity: 1, duration: 0.8 }, 6)

      // Captions cross-fade across stages
      CAPTIONS.forEach((_, i) => {
        if (i > 0) {
          tl.fromTo(
            `[data-caption="${i}"]`,
            { opacity: 0, y: 28 },
            { opacity: 1, y: 0, duration: 0.4 },
            i - 0.1,
          )
        }
        if (i < STAGES - 1) {
          tl.to(
            `[data-caption="${i}"]`,
            { opacity: 0, y: -24, duration: 0.3 },
            i + 0.72,
          )
        }
      })

      // Final CTA reveal
      tl.fromTo(
        '[data-final-cta]',
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.6 },
        6.2,
      )
    }, stageRef)

    // Make sure measurements are correct after fonts/images settle.
    const refresh = () => ScrollTrigger.refresh()
    const t = window.setTimeout(refresh, 300)
    window.addEventListener('load', refresh)

    return () => {
      window.clearTimeout(t)
      window.removeEventListener('load', refresh)
      ctx.revert()
    }
  }, [reduced])

  return (
    <section
      id="story"
      ref={sectionRef}
      className="relative"
      aria-label="داستان مجموعه آورا"
    >
      <div
        ref={stageRef}
        className="relative h-[100svh] w-full overflow-hidden"
      >
        {/* studio backdrop */}
        <div className="absolute inset-0 bg-ink-950" />
        <div
          data-glow
          className="studio-glow pointer-events-none absolute inset-0"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink-950 to-transparent" />

        {/* reflective floor line */}
        <div className="pointer-events-none absolute inset-x-0 top-[72%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* phone */}
        <LayerWrapper layer={PHONE} reduced={reduced} />

        {/* accessories */}
        {LAYERS.map((l) => (
          <LayerWrapper key={l.key} layer={l} reduced={reduced} />
        ))}

        {/* captions */}
        <div className="pointer-events-none absolute inset-x-0 top-[9%] z-40 flex flex-col items-center px-6 text-center">
          <div className="relative h-[210px] w-full max-w-xl">
            {CAPTIONS.map((c, i) => {
              if (reduced && i !== STAGES - 1) return null
              return (
              <div
                key={i}
                data-caption={i}
                className="absolute inset-x-0 top-0 flex flex-col items-center"
                style={reduced ? { opacity: 1 } : undefined}
              >
                <h2 className="text-balance text-3xl font-extrabold leading-tight tracking-tight text-gradient sm:text-4xl md:text-5xl">
                  {c.title}
                </h2>
                <p className="mt-3 max-w-md text-sm text-silver-300 sm:text-base">
                  {c.sub}
                </p>
                {i === STAGES - 1 && (
                  <div
                    data-final-cta
                    className="pointer-events-auto mt-7 flex flex-wrap items-center justify-center gap-3"
                    style={reduced ? { opacity: 1 } : undefined}
                  >
                    <button
                      onClick={() => scrollToId('shop', -70)}
                      className="btn-sheen rounded-full bg-white px-7 py-3 text-sm font-bold text-ink-950 transition-transform hover:scale-[1.03]"
                    >
                      مشاهده محصولات
                    </button>
                    <button
                      onClick={() => scrollToId('bestsellers', -70)}
                      className="rounded-full border border-white/20 bg-white/5 px-7 py-3 text-sm font-bold text-white backdrop-blur transition-colors hover:bg-white/10"
                    >
                      خرید از فروشگاه
                    </button>
                  </div>
                )}
              </div>
              )
            })}
          </div>
        </div>

        {/* scroll hint */}
        {!reduced && (
          <div
            data-hint
            className="pointer-events-none absolute inset-x-0 bottom-8 z-40 flex flex-col items-center gap-2 text-silver-400"
          >
            <span className="text-xs tracking-widest">اسکرول کنید</span>
            <span className="flex h-9 w-5 items-start justify-center rounded-full border border-white/25 p-1">
              <span className="h-2 w-1 animate-float rounded-full bg-white/70" />
            </span>
          </div>
        )}
      </div>
    </section>
  )
}

function LayerWrapper({ layer, reduced }: { layer: Layer; reduced: boolean }) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{
        left: layer.pos.left,
        top: layer.pos.top,
        width: layer.pos.width,
        zIndex: layer.pos.z,
      }}
    >
      <div
        data-layer={layer.key}
        className="will-change-transform"
        style={reduced ? { opacity: 1 } : undefined}
      >
        <ProductArt
          art={layer.art}
          color={layer.color}
          className="h-auto w-full drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)]"
        />
      </div>
    </div>
  )
}
