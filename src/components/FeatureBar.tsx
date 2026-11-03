const FEATURES = [
  {
    title: 'ارسال سریع',
    sub: 'تحویل اکسپرس در تهران',
    icon: (
      <>
        <path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z" strokeLinejoin="round" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
      </>
    ),
  },
  {
    title: 'ضمانت اصالت',
    sub: '۱۸ ماه گارانتی',
    icon: (
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" strokeLinejoin="round" />
    ),
  },
  {
    title: 'پرداخت امن',
    sub: 'درگاه معتبر بانکی',
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18" />
      </>
    ),
  },
  {
    title: 'پشتیبانی ۲۴/۷',
    sub: 'همیشه در دسترس',
    icon: (
      <>
        <path d="M4 12a8 8 0 0 1 16 0" />
        <rect x="3" y="12" width="4" height="6" rx="1.5" />
        <rect x="17" y="12" width="4" height="6" rx="1.5" />
      </>
    ),
  },
]

export default function FeatureBar() {
  return (
    <section className="border-y border-white/8 bg-ink-900/60">
      <div className="mx-auto grid max-w-8xl grid-cols-2 gap-px px-5 sm:px-8 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="flex items-center gap-4 py-6 lg:justify-center"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-accent-soft">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                {f.icon}
              </svg>
            </span>
            <div>
              <p className="text-sm font-bold text-white">{f.title}</p>
              <p className="text-xs text-silver-400">{f.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
