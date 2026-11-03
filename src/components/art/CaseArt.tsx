import { useId } from 'react'

interface CaseProps {
  className?: string
  color?: string
}

/** Protective case shell with camera cut-out and soft-touch sheen. */
export default function CaseArt({ className, color = '#1c1c20' }: CaseProps) {
  const id = useId().replace(/[:]/g, '')
  const g = (n: string) => `${id}-${n}`

  return (
    <svg
      viewBox="0 0 300 612"
      className={className}
      role="img"
      aria-label="قاب گوشی"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={g('body')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="0.5" stopColor={color} />
          <stop offset="1" stopColor="#000000" />
        </linearGradient>
        <linearGradient id={g('rim')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.18" />
        </linearGradient>
        <linearGradient id={g('sheen')} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="0.35" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id={g('sh')} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      <ellipse
        cx="150"
        cy="588"
        rx="118"
        ry="18"
        fill="#000"
        opacity="0.4"
        filter={`url(#${g('sh')})`}
      />

      {/* outer shell */}
      <rect
        x="8"
        y="6"
        width="284"
        height="600"
        rx="64"
        fill={`url(#${g('body')})`}
      />
      <rect
        x="8"
        y="6"
        width="284"
        height="600"
        rx="64"
        fill="none"
        stroke={`url(#${g('rim')})`}
        strokeWidth="2"
      />

      {/* inner hollow (where the phone sits) */}
      <rect
        x="26"
        y="24"
        width="248"
        height="564"
        rx="50"
        fill="#000000"
        opacity="0.55"
      />
      <rect
        x="26"
        y="24"
        width="248"
        height="564"
        rx="50"
        fill="none"
        stroke="#000"
        strokeOpacity="0.6"
        strokeWidth="1"
      />

      {/* camera cut-out */}
      <rect
        x="40"
        y="38"
        width="118"
        height="118"
        rx="34"
        fill="#000"
        opacity="0.85"
      />
      <rect
        x="40"
        y="38"
        width="118"
        height="118"
        rx="34"
        fill="none"
        stroke={`url(#${g('rim')})`}
        strokeWidth="1.5"
      />
      {[
        { cx: 72, cy: 70 },
        { cx: 124, cy: 70 },
        { cx: 72, cy: 122 },
      ].map((c, i) => (
        <circle key={i} cx={c.cx} cy={c.cy} r="22" fill="#000" opacity="0.6" />
      ))}

      {/* MagSafe ring hint */}
      <circle
        cx="150"
        cy="330"
        r="54"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.08"
        strokeWidth="6"
      />

      {/* soft-touch sheen */}
      <rect
        x="8"
        y="6"
        width="284"
        height="600"
        rx="64"
        fill={`url(#${g('sheen')})`}
      />

      {/* side button bumps */}
      <rect x="4" y="150" width="6" height="40" rx="3" fill={color} />
      <rect x="4" y="200" width="6" height="58" rx="3" fill={color} />
      <rect x="290" y="178" width="6" height="68" rx="3" fill={color} />
    </svg>
  )
}
