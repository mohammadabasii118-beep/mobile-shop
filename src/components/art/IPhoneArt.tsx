import { useId } from 'react'

interface ArtProps {
  className?: string
  /** Show the rear (camera) face instead of the front screen. */
  rear?: boolean
}

/**
 * High-detail vector render of a titanium smartphone.
 * Layered frame, reflective glass, dynamic island and camera module —
 * independently styleable and fully transparent for scroll choreography.
 */
export default function IPhoneArt({ className, rear }: ArtProps) {
  const id = useId().replace(/[:]/g, '')
  const g = (n: string) => `${id}-${n}`

  return (
    <svg
      viewBox="0 0 300 612"
      className={className}
      role="img"
      aria-label="آیفون"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={g('frame')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3f5f8" />
          <stop offset="0.14" stopColor="#9aa0ab" />
          <stop offset="0.5" stopColor="#d8dce3" />
          <stop offset="0.86" stopColor="#8a909b" />
          <stop offset="1" stopColor="#eef1f5" />
        </linearGradient>
        <linearGradient id={g('frameEdge')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5c6069" />
          <stop offset="0.08" stopColor="#c6cad2" />
          <stop offset="0.5" stopColor="#f6f8fb" />
          <stop offset="0.92" stopColor="#c6cad2" />
          <stop offset="1" stopColor="#5c6069" />
        </linearGradient>
        <linearGradient id={g('screen')} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#0b1020" />
          <stop offset="0.5" stopColor="#0a0d16" />
          <stop offset="1" stopColor="#05070d" />
        </linearGradient>
        <radialGradient id={g('nebula')} cx="0.32" cy="0.28" r="0.75">
          <stop offset="0" stopColor="#2b5bd0" stopOpacity="0.85" />
          <stop offset="0.4" stopColor="#1c3a86" stopOpacity="0.5" />
          <stop offset="1" stopColor="#05070d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={g('nebula2')} cx="0.78" cy="0.82" r="0.6">
          <stop offset="0" stopColor="#7b3fe4" stopOpacity="0.55" />
          <stop offset="1" stopColor="#05070d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g('gloss')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="0.3" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={g('back')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#23242a" />
          <stop offset="0.5" stopColor="#141519" />
          <stop offset="1" stopColor="#0a0b0e" />
        </linearGradient>
        <radialGradient id={g('lens')} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#3a4a66" />
          <stop offset="0.45" stopColor="#10131b" />
          <stop offset="1" stopColor="#05060a" />
        </radialGradient>
        <filter id={g('soft')} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* drop shadow */}
      <ellipse
        cx="150"
        cy="585"
        rx="120"
        ry="20"
        fill="#000"
        opacity="0.45"
        filter={`url(#${g('soft')})`}
      />

      {/* outer titanium frame */}
      <rect
        x="12"
        y="8"
        width="276"
        height="596"
        rx="60"
        fill={`url(#${g('frame')})`}
      />
      <rect
        x="16"
        y="12"
        width="268"
        height="588"
        rx="56"
        fill="none"
        stroke={`url(#${g('frameEdge')})`}
        strokeWidth="1.5"
        opacity="0.9"
      />

      {rear ? (
        <>
          {/* back glass */}
          <rect
            x="20"
            y="16"
            width="260"
            height="580"
            rx="52"
            fill={`url(#${g('back')})`}
          />
          {/* camera module */}
          <rect
            x="36"
            y="34"
            width="120"
            height="120"
            rx="34"
            fill="#1a1b20"
            stroke="#2c2e35"
            strokeWidth="1.5"
          />
          {[
            { cx: 70, cy: 68 },
            { cx: 122, cy: 68 },
            { cx: 70, cy: 120 },
          ].map((c, i) => (
            <g key={i}>
              <circle cx={c.cx} cy={c.cy} r="22" fill="#2b2d34" />
              <circle cx={c.cx} cy={c.cy} r="17" fill={`url(#${g('lens')})`} />
              <circle cx={c.cx} cy={c.cy} r="7" fill="#05070c" />
              <circle
                cx={c.cx - 5}
                cy={c.cy - 5}
                r="3"
                fill="#8fb4ff"
                opacity="0.7"
              />
            </g>
          ))}
          {/* flash */}
          <circle cx="122" cy="120" r="9" fill="#2b2d34" />
          <circle cx="122" cy="120" r="5" fill="#f4f1e0" opacity="0.85" />
          {/* logo */}
          <circle cx="150" cy="330" r="26" fill="#2a2c33" opacity="0.8" />
          <rect
            x="40"
            y="16"
            width="12"
            height="580"
            rx="6"
            fill="#ffffff"
            opacity="0.05"
          />
        </>
      ) : (
        <>
          {/* screen */}
          <rect
            x="22"
            y="18"
            width="256"
            height="576"
            rx="50"
            fill={`url(#${g('screen')})`}
          />
          <rect
            x="22"
            y="18"
            width="256"
            height="576"
            rx="50"
            fill={`url(#${g('nebula')})`}
          />
          <rect
            x="22"
            y="18"
            width="256"
            height="576"
            rx="50"
            fill={`url(#${g('nebula2')})`}
          />
          {/* dynamic island */}
          <rect x="112" y="40" width="76" height="24" rx="12" fill="#000" />
          <circle cx="172" cy="52" r="5" fill="#0c1424" />
          <circle cx="174" cy="50" r="2" fill="#24407a" />
          {/* clock */}
          <text
            x="150"
            y="150"
            textAnchor="middle"
            fontFamily="Inter, sans-serif"
            fontSize="62"
            fontWeight="300"
            fill="#ffffff"
            opacity="0.92"
          >
            9:41
          </text>
          <text
            x="150"
            y="178"
            textAnchor="middle"
            fontFamily="Inter, sans-serif"
            fontSize="13"
            fontWeight="400"
            fill="#c9d4ea"
            opacity="0.7"
          >
            Tuesday, 12 September
          </text>
          {/* glass gloss reflection */}
          <rect
            x="22"
            y="18"
            width="256"
            height="576"
            rx="50"
            fill={`url(#${g('gloss')})`}
          />
          {/* lock + bottom indicators */}
          <circle cx="150" cy="500" r="18" fill="#ffffff" opacity="0.08" />
          <rect
            x="110"
            y="572"
            width="80"
            height="4"
            rx="2"
            fill="#ffffff"
            opacity="0.6"
          />
        </>
      )}

      {/* side buttons */}
      <rect x="9" y="150" width="3" height="34" rx="1.5" fill="#7b8089" />
      <rect x="9" y="196" width="3" height="52" rx="1.5" fill="#7b8089" />
      <rect x="288" y="176" width="3" height="64" rx="1.5" fill="#7b8089" />
    </svg>
  )
}
