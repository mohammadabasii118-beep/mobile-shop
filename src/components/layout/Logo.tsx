export default function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="lx-metal" x1="0" y1="0" x2="48" y2="48">
          <stop offset="0" stopColor="#f7f8fa" />
          <stop offset="0.45" stopColor="#b4bac4" />
          <stop offset="0.65" stopColor="#6f7686" />
          <stop offset="1" stopColor="#e9ebef" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="13"
        stroke="url(#lx-metal)"
        strokeWidth="2"
      />
      {/* stylized "L" monogram as a phone outline */}
      <path
        d="M17 13c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v22a2 2 0 0 1-2 2H19a2 2 0 0 1-2-2V13Z"
        stroke="url(#lx-metal)"
        strokeWidth="2"
      />
      <path
        d="M22 31h7"
        stroke="url(#lx-metal)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="24" cy="18" r="2" fill="url(#lx-metal)" />
    </svg>
  );
}
