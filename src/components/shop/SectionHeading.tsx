import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface Props {
  eyebrow?: string
  title: ReactNode
  subtitle?: string
  center?: boolean
}

export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  center,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={center ? 'text-center' : ''}
    >
      {eyebrow && (
        <span className="mb-3 inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-accent-soft">
          {eyebrow}
        </span>
      )}
      <h2 className="text-balance text-3xl font-extrabold tracking-tight text-gradient sm:text-4xl md:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p
          className={
            'mt-4 text-silver-300 ' + (center ? 'mx-auto max-w-2xl' : 'max-w-xl')
          }
        >
          {subtitle}
        </p>
      )}
    </motion.div>
  )
}
