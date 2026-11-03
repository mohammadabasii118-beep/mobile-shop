import { useId } from 'react'

interface ArtProps {
  className?: string
}

/** AirPods charging case, lid open, with two earbuds hovering above. */
export default function AirPodsArt({ className }: ArtProps) {
  const id = useId().replace(/[:]/g, '')
  const g = (n: string) => `${id}-${n}`

  const bud = (x: number, y: number, k: string) => (
    <g key={k} transform={`translate(${x} ${y})`}>
      {/* bud head */}
      <ellipse cx="0" cy="0" rx="20" ry="24" fill={`url(#${g('budBody')})`} />
      <ellipse cx="-5" cy="-8" rx="7" ry="9" fill="#ffffff" opacity="0.65" />
      <circle cx="4" cy="4" r="6" fill="#0c0d11" opacity="0.6" />
      {/* stem */}
      <rect x="-9" y="16" width="18" height="52" rx="9" fill={`url(#${g('stem')})`} />
      <rect x="-9" y="16" width="5" height="52" rx="2.5" fill="#ffffff" opacity="0.5" />
      <ellipse cx="0" cy="68" rx="9" ry="5" fill="#d4d7dd" />
    </g>
  )

  return (
    <svg
      viewBox="0 0 320 360"
      className={className}
      role="img"
      aria-label="ایرپاد"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={g('case')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#eceef2" />
          <stop offset="1" stopColor="#c8ccd3" />
        </linearGradient>
        <linearGradient id={g('lid')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6f7f9" />
          <stop offset="1" stopColor="#d2d6dd" />
        </linearGradient>
        <linearGradient id={g('budBody')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d2d6dd" />
        </linearGradient>
        <linearGradient id={g('stem')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c6cad1" />
        </linearGradient>
        <radialGradient id={g('inner')} cx="0.5" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#3a4a66" stopOpacity="0.35" />
          <stop offset="1" stopColor="#05070d" stopOpacity="0.9" />
        </radialGradient>
        <filter id={g('sh')} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      <ellipse cx="160" cy="336" rx="96" ry="16" fill="#000" opacity="0.35" filter={`url(#${g('sh')})`} />

      {/* earbuds hovering */}
      {bud(118, 70, 'l')}
      {bud(202, 70, 'r')}

      {/* open lid */}
      <g transform="translate(160 176) rotate(-6)">
        <rect x="-96" y="-34" width="192" height="40" rx="18" fill={`url(#${g('lid')})`} />
        <rect x="-96" y="-34" width="192" height="40" rx="18" fill="none" stroke="#ffffff" strokeOpacity="0.8" />
      </g>

      {/* case body */}
      <rect x="64" y="176" width="192" height="150" rx="40" fill={`url(#${g('case')})`} />
      <rect x="64" y="176" width="192" height="150" rx="40" fill="none" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="1.5" />

      {/* inner cavity with two slots */}
      <rect x="84" y="178" width="152" height="60" rx="26" fill={`url(#${g('inner')})`} />
      <ellipse cx="128" cy="210" rx="20" ry="26" fill="#05070d" opacity="0.7" />
      <ellipse cx="192" cy="210" rx="20" ry="26" fill="#05070d" opacity="0.7" />

      {/* status LED */}
      <circle cx="160" cy="268" r="4" fill="#4ade80" />
      <circle cx="160" cy="268" r="8" fill="#4ade80" opacity="0.3" />

      {/* front sheen */}
      <rect x="78" y="188" width="24" height="120" rx="12" fill="#ffffff" opacity="0.45" />
    </svg>
  )
}
