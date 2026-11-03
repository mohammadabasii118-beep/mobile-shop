import { useId } from 'react'

interface ArtProps {
  className?: string
}

/** Compact GaN wall adapter with dual USB-C ports and folding prongs. */
export default function AdapterArt({ className }: ArtProps) {
  const id = useId().replace(/[:]/g, '')
  const g = (n: string) => `${id}-${n}`
  return (
    <svg
      viewBox="0 0 320 340"
      className={className}
      role="img"
      aria-label="آداپتور شارژ"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={g('body')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#e7e9ee" />
          <stop offset="1" stopColor="#c3c7cf" />
        </linearGradient>
        <linearGradient id={g('side')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c7cbd2" />
          <stop offset="1" stopColor="#f2f3f6" />
        </linearGradient>
        <radialGradient id={g('port')} cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#2a2d34" />
          <stop offset="1" stopColor="#0c0d11" />
        </radialGradient>
        <filter id={g('sh')} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      <ellipse cx="160" cy="300" rx="110" ry="20" fill="#000" opacity="0.4" filter={`url(#${g('sh')})`} />

      {/* prongs */}
      <g>
        <rect x="128" y="18" width="16" height="54" rx="4" fill="#d7dae0" />
        <rect x="176" y="18" width="16" height="54" rx="4" fill="#d7dae0" />
        <rect x="128" y="18" width="5" height="54" rx="2" fill="#f6f7f9" />
        <rect x="176" y="18" width="5" height="54" rx="2" fill="#f6f7f9" />
      </g>

      {/* body */}
      <rect x="64" y="66" width="192" height="206" rx="46" fill={`url(#${g('body')})`} />
      <rect x="64" y="66" width="192" height="206" rx="46" fill="none" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="1.5" />
      <rect x="70" y="72" width="20" height="194" rx="10" fill={`url(#${g('side')})`} opacity="0.6" />

      {/* USB-C ports */}
      {[128, 192].map((cy, i) => (
        <g key={i}>
          <rect x="112" y={cy} width="96" height="26" rx="13" fill={`url(#${g('port')})`} />
          <rect x="128" y={cy + 9} width="64" height="8" rx="4" fill="#3a3e47" />
        </g>
      ))}

      {/* label line */}
      <rect x="104" y="240" width="112" height="4" rx="2" fill="#aeb3bc" opacity="0.6" />
      <circle cx="160" cy="92" r="3" fill="#9aa0ab" />
      {/* top sheen */}
      <rect x="84" y="78" width="152" height="30" rx="15" fill="#ffffff" opacity="0.5" />
    </svg>
  )
}
