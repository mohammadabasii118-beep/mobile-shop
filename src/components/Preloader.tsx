import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export default function Preloader({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const duration = 1400
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setProgress(Math.round(eased * 100))
      if (t < 1) raf = requestAnimationFrame(tick)
      else setTimeout(onDone, 260)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [onDone])

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ink-950"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }}
    >
      <div className="studio-glow pointer-events-none absolute inset-0 opacity-60" />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-col items-center"
      >
        <span className="font-latin text-5xl font-extrabold tracking-tight text-gradient sm:text-6xl">
          Aurora
        </span>
        <span className="mt-3 text-sm text-silver-400">لوازم جانبی آیفون</span>

        <div className="mt-8 h-px w-56 overflow-hidden bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-accent-soft to-accent"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="font-latin mt-3 text-xs tabular-nums text-silver-400">
          {progress}%
        </span>
      </motion.div>
    </motion.div>
  )
}
