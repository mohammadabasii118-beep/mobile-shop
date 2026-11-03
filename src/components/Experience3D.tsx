import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { AnimatePresence, motion } from 'framer-motion'
import { ScrollTrigger } from '../lib/gsap'
import Scene from '../three/Scene'
import { THRESHOLDS } from '../three/scenes'
import { scrollToId } from '../lib/scrollTo'

const CAPTIONS = [
  { title: 'تجربه‌ای فراتر از یک گوشی', sub: 'آیفون ۱۸ پرومکس — هر چیزی که به آن نیاز دارد، اینجاست.' },
  { title: 'محافظت نامرئی، شفافیت بی‌نهایت', sub: 'گلس دقیقاً روی نمایشگر می‌نشیند؛ هست، اما دیده نمی‌شود.' },
  { title: 'نگهبان دوربین شما', sub: 'گلس لنز با حلقه‌های آلومینیومی، روی هر لنز قفل می‌شود.' },
  { title: 'زیبایی در کنار محافظت', sub: 'قاب مگ‌سیف، مثل یک قطعه، روی بدنه جا می‌افتد.' },
  { title: 'تمام چیزی که آیفون شما نیاز دارد', sub: 'قاب، گلس صفحه و گلس لنز — در یک قاب سینمایی.' },
]

const LAST = CAPTIONS.length - 1

function stageFromProgress(p: number) {
  let s = 0
  for (const t of THRESHOLDS) if (p >= t) s++
  return s
}

function useIsMobile() {
  const [mobile, setMobile] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const on = () => setMobile(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return mobile
}

export default function Experience3D({ reduced }: { reduced: boolean }) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const progress = useRef(0)
  const [stage, setStage] = useState(reduced ? LAST : 0)
  const isMobile = useIsMobile()

  useEffect(() => {
    if (reduced) {
      progress.current = 1
      setStage(LAST)
      return
    }
    const el = sectionRef.current
    const pinEl = pinRef.current
    if (!el || !pinEl) return
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: '+=450%',
      pin: pinEl,
      pinSpacing: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        progress.current = self.progress
        const s = stageFromProgress(self.progress)
        setStage((prev) => (prev === s ? prev : s))
      },
    })
    const r = window.setTimeout(() => ScrollTrigger.refresh(), 300)
    return () => {
      window.clearTimeout(r)
      st.kill()
    }
  }, [reduced])

  const caption = CAPTIONS[Math.min(stage, CAPTIONS.length - 1)]

  return (
    <section
      id="story"
      ref={sectionRef}
      className="relative"
      aria-label="تجربهٔ سه‌بعدی مجموعهٔ آورا"
    >
      <div
        ref={pinRef}
        className="relative flex h-[100svh] w-full items-center justify-center overflow-hidden"
      >
        <Canvas
          className="absolute inset-0"
          shadows={!isMobile}
          dpr={isMobile ? [1, 1.5] : [1, 2]}
          camera={{ fov: 35, position: [0, 0.15, 6.3], near: 0.1, far: 100 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        >
          <Scene progressRef={progress} reduced={reduced} isMobile={isMobile} />
        </Canvas>

        {/* gradient vignette so captions stay legible */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,transparent_55%,rgba(5,5,6,0.65)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink-950/80 to-transparent" />

        {/* captions */}
        <div className="pointer-events-none absolute inset-x-0 top-[8%] z-20 flex flex-col items-center px-6 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={stage}
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -22 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center"
            >
              <h2 className="text-balance text-3xl font-extrabold leading-tight tracking-tight text-gradient sm:text-4xl md:text-5xl">
                {caption.title}
              </h2>
              <p className="mt-3 max-w-md text-sm text-silver-300 sm:text-base">
                {caption.sub}
              </p>
            </motion.div>
          </AnimatePresence>

          {stage === LAST && (
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="pointer-events-auto mt-7 flex flex-wrap items-center justify-center gap-3"
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
            </motion.div>
          )}
        </div>

        {/* scroll hint */}
        {!reduced && stage === 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-8 z-20 flex flex-col items-center gap-2 text-silver-400">
            <span className="text-xs tracking-widest">برای مونتاژ، اسکرول کنید</span>
            <span className="flex h-9 w-5 items-start justify-center rounded-full border border-white/25 p-1">
              <span className="h-2 w-1 animate-float rounded-full bg-white/70" />
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
