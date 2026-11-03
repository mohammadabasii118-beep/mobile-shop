import { useId } from 'react'

interface ArtProps {
  className?: string
}

/** Tempered-glass screen protector — translucent with a raking light reflection. */
export default function GlassArt({ className }: ArtProps) {
  const id = useId().replace(/[:]/g, '')
  const g = (n: string) => `${id}-${n}`

  return (
    <svg
      viewBox="0 0 300 612"
      className={className}
      role="img"
      aria-label="گلس محافظ"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={g('pane')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#dCEBFF" stopOpacity="0.30" />
          <stop offset="0.5" stopColor="#aec9ef" stopOpacity="0.14" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id={g('streak')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={g('edge')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="0.5" stopColor="#bcd3f4" stopOpacity="0.25" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.7" />
        </linearGradient>
        <filter id={g('sh')} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <ellipse
        cx="150"
        cy="590"
        rx="104"
        ry="14"
        fill="#2b4a7a"
        opacity="0.3"
        filter={`url(#${g('sh')})`}
      />

      {/* glass pane */}
      <rect
        x="34"
        y="20"
        width="232"
        height="572"
        rx="46"
        fill={`url(#${g('pane')})`}
        stroke={`url(#${g('edge')})`}
        strokeWidth="2"
      />
      {/* thickness edge (2.5D) */}
      <rect
        x="34"
        y="24"
        width="232"
        height="572"
        rx="46"
        fill="none"
        stroke="#9fc0ee"
        strokeOpacity="0.35"
        strokeWidth="1"
      />

      {/* reflection streak */}
      <g opacity="0.8">
        <rect
          x="34"
          y="20"
          width="232"
          height="572"
          rx="46"
          fill="none"
        />
        <polygon
          points="70,20 150,20 70,592 34,592 34,520"
          fill={`url(#${g('streak')})`}
          opacity="0.5"
        />
        <polygon
          points="190,20 230,20 150,592 118,592"
          fill={`url(#${g('streak')})`}
          opacity="0.35"
        />
      </g>

      {/* camera + speaker cut-outs */}
      <circle
        cx="150"
        cy="56"
        r="9"
        fill="#0a0f1a"
        opacity="0.5"
        stroke="#bcd3f4"
        strokeOpacity="0.4"
      />
      <rect
        x="128"
        y="44"
        width="44"
        height="6"
        rx="3"
        fill="#0a0f1a"
        opacity="0.4"
      />

      {/* corner sparkle highlights */}
      {[
        [70, 60],
        [232, 548],
      ].map(([x, y], i) => (
        <g key={i} opacity="0.85">
          <circle cx={x} cy={y} r="2.5" fill="#ffffff" />
          <path
            d={`M${x} ${y - 9} L${x} ${y + 9} M${x - 9} ${y} L${x + 9} ${y}`}
            stroke="#ffffff"
            strokeWidth="1"
            opacity="0.6"
          />
        </g>
      ))}
    </svg>
  )
}
