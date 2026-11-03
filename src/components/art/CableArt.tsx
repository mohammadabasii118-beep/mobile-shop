import { useId } from 'react'

interface CableProps {
  className?: string
  color?: string
}

/** Braided USB-C cable gracefully curving between two connectors. */
export default function CableArt({ className, color = '#1b1b1f' }: CableProps) {
  const id = useId().replace(/[:]/g, '')
  const g = (n: string) => `${id}-${n}`
  return (
    <svg
      viewBox="0 0 340 340"
      className={className}
      role="img"
      aria-label="کابل شارژ"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={g('braid')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="0.5" stopColor="#3a3a42" />
          <stop offset="1" stopColor={color} />
        </linearGradient>
        <linearGradient id={g('metal')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3f5f8" />
          <stop offset="0.5" stopColor="#b9bdc6" />
          <stop offset="1" stopColor="#80848d" />
        </linearGradient>
        <filter id={g('sh')} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      <ellipse cx="170" cy="300" rx="130" ry="18" fill="#000" opacity="0.35" filter={`url(#${g('sh')})`} />

      {/* cable body */}
      <path
        d="M70 70 C 70 170, 270 150, 270 260"
        fill="none"
        stroke="#000"
        strokeOpacity="0.4"
        strokeWidth="20"
        strokeLinecap="round"
      />
      <path
        d="M70 70 C 70 170, 270 150, 270 260"
        fill="none"
        stroke={`url(#${g('braid')})`}
        strokeWidth="16"
        strokeLinecap="round"
      />
      {/* braided highlight dashes */}
      <path
        d="M70 70 C 70 170, 270 150, 270 260"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.14"
        strokeWidth="16"
        strokeLinecap="round"
        strokeDasharray="2 10"
      />

      {/* top connector (USB-C) */}
      <g transform="translate(70 36) rotate(0)">
        <rect x="-16" y="0" width="32" height="20" rx="4" fill={`url(#${g('metal')})`} />
        <rect x="-20" y="18" width="40" height="26" rx="9" fill={color} />
        <rect x="-9" y="6" width="18" height="7" rx="3.5" fill="#2a2d34" />
      </g>

      {/* bottom connector (USB-C) */}
      <g transform="translate(270 276)">
        <rect x="-16" y="0" width="32" height="20" rx="4" fill={`url(#${g('metal')})`} />
        <rect x="-20" y="-24" width="40" height="26" rx="9" fill={color} />
        <rect x="-9" y="7" width="18" height="7" rx="3.5" fill="#2a2d34" />
      </g>
    </svg>
  )
}
