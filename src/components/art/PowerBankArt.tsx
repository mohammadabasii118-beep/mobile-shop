import { useId } from 'react'

interface PBProps {
  className?: string
  color?: string
}

/** MagSafe power bank with a magnetic ring and a small digital charge display. */
export default function PowerBankArt({ className, color = '#1a1a1e' }: PBProps) {
  const id = useId().replace(/[:]/g, '')
  const g = (n: string) => `${id}-${n}`
  return (
    <svg
      viewBox="0 0 300 400"
      className={className}
      role="img"
      aria-label="پاوربانک"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={g('body')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="0.5" stopColor="#2a2b31" />
          <stop offset="1" stopColor="#0b0b0e" />
        </linearGradient>
        <linearGradient id={g('rim')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.22" />
        </linearGradient>
        <radialGradient id={g('ring')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.7" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.85" stopColor="#8fb4ff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#8fb4ff" stopOpacity="0" />
        </radialGradient>
        <filter id={g('sh')} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      <ellipse cx="150" cy="378" rx="96" ry="16" fill="#000" opacity="0.4" filter={`url(#${g('sh')})`} />

      {/* body */}
      <rect x="54" y="20" width="192" height="360" rx="42" fill={`url(#${g('body')})`} />
      <rect x="54" y="20" width="192" height="360" rx="42" fill="none" stroke={`url(#${g('rim')})`} strokeWidth="2" />

      {/* magnetic charge ring */}
      <circle cx="150" cy="150" r="66" fill="none" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="2" />
      <circle cx="150" cy="150" r="66" fill={`url(#${g('ring')})`} />
      <circle cx="150" cy="150" r="40" fill="none" stroke="#ffffff" strokeOpacity="0.07" strokeWidth="1.5" />

      {/* digital display */}
      <rect x="110" y="250" width="80" height="44" rx="12" fill="#05060a" stroke="#2a2d34" strokeWidth="1" />
      <text x="150" y="281" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="24" fontWeight="600" fill="#6ea8ff">
        82%
      </text>

      {/* charge bars */}
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={116 + i * 18}
          y="314"
          width="12"
          height="10"
          rx="2"
          fill={i < 3 ? '#6ea8ff' : '#2a2d34'}
          opacity={i < 3 ? 0.9 : 1}
        />
      ))}

      {/* USB-C port */}
      <rect x="128" y="352" width="44" height="12" rx="6" fill="#05060a" stroke="#2a2d34" strokeWidth="1" />

      {/* side sheen */}
      <rect x="64" y="30" width="18" height="340" rx="9" fill="#ffffff" opacity="0.05" />
    </svg>
  )
}
