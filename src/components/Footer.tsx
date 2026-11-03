import { useState } from 'react'
import { scrollToId } from '../lib/scrollTo'

const SOCIALS = [
  {
    name: 'اینستاگرام',
    href: '#',
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    name: 'تلگرام',
    href: '#',
    icon: <path d="M21 4 3 11l5 2 2 6 3-4 5 4 3-15z" strokeLinejoin="round" />,
  },
  {
    name: 'واتساپ',
    href: '#',
    icon: (
      <path
        d="M20 12a8 8 0 0 1-11.8 7L4 20l1-4.2A8 8 0 1 1 20 12zM8.5 8.5c-.3 0-.6.1-.8.4-.3.3-.9.9-.9 2.1s.9 2.5 1 2.7c.1.2 1.7 2.8 4.3 3.8 2.1.8 2.6.7 3 .6.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.4z"
        strokeLinejoin="round"
      />
    ),
  },
  {
    name: 'آپارات',
    href: '#',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M10 9.5v5l4-2.5z" fill="currentColor" stroke="none" />
      </>
    ),
  },
]

const COLS = [
  {
    title: 'فروشگاه',
    links: ['قاب گوشی', 'گلس محافظ', 'شارژر و کابل', 'پاوربانک', 'ایرپاد'],
    target: 'shop',
  },
  {
    title: 'خدمات',
    links: ['پیگیری سفارش', 'گارانتی', 'بازگشت کالا', 'راهنمای خرید'],
    target: 'contact',
  },
  {
    title: 'آورا',
    links: ['درباره ما', 'تماس با ما', 'فرصت‌های شغلی', 'وبلاگ'],
    target: 'contact',
  },
]

export default function Footer() {
  const [email, setEmail] = useState('')
  const [ok, setOk] = useState(false)

  return (
    <footer className="relative mt-10 border-t border-white/8 bg-ink-900">
      <div className="mx-auto max-w-8xl px-5 py-16 sm:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.4fr_2fr]">
          {/* brand + newsletter */}
          <div>
            <div className="flex items-center gap-2 text-white">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-white to-silver-300 text-ink-950">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M12 2a1 1 0 0 1 .9.56l2.3 4.66 5.14.75a1 1 0 0 1 .56 1.7l-3.72 3.63.88 5.12a1 1 0 0 1-1.45 1.05L12 17.9l-4.6 2.42a1 1 0 0 1-1.45-1.05l.88-5.12-3.72-3.63a1 1 0 0 1 .56-1.7l5.14-.75L11.1 2.56A1 1 0 0 1 12 2z" />
                </svg>
              </span>
              <span className="font-latin text-xl font-bold">Aurora</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-7 text-silver-400">
              مقصد لوازم جانبی آیفون. طراحی‌شده برای کسانی که جزئیات برایشان مهم
              است.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                  setOk(true)
                  setEmail('')
                }
              }}
              className="mt-6 flex max-w-sm overflow-hidden rounded-full border border-white/10 bg-ink-800/60 p-1"
            >
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
                placeholder="ایمیل برای تخفیف‌ها"
                className="flex-1 bg-transparent px-4 text-right text-sm text-white outline-none"
              />
              <button className="rounded-full bg-white px-5 py-2.5 text-xs font-bold text-ink-950">
                عضویت
              </button>
            </form>
            {ok && (
              <p className="mt-2 text-xs text-accent-soft">
                عضویت شما ثبت شد. سپاسگزاریم!
              </p>
            )}

            <div className="mt-6 flex gap-3">
              {SOCIALS.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  aria-label={s.name}
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-silver-200 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                    {s.icon}
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLS.map((col) => (
              <div key={col.title}>
                <h4 className="text-sm font-bold text-white">{col.title}</h4>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l}>
                      <button
                        onClick={() => scrollToId(col.target, -70)}
                        className="text-sm text-silver-400 transition-colors hover:text-white"
                      >
                        {l}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/8 pt-8 text-center sm:flex-row sm:text-right">
          <p className="text-xs text-silver-400">
            © ۱۴۰۳ آورا. تمامی حقوق محفوظ است.
          </p>
          <div className="flex items-center gap-3 text-silver-400">
            <span className="text-xs">نماد اعتماد الکترونیکی</span>
            <span className="h-8 w-8 rounded-md bg-white/5" />
            <span className="h-8 w-8 rounded-md bg-white/5" />
          </div>
        </div>
      </div>
    </footer>
  )
}
