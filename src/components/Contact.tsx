import { useState, type FormEvent } from 'react'
import SectionHeading from './shop/SectionHeading'

const CHANNELS = [
  { label: 'پشتیبانی تلفنی', value: '۰۲۱ - ۹۱۰۰ ۰۰۰۰', icon: 'phone' },
  { label: 'ایمیل', value: 'support@aurora.shop', icon: 'mail' },
  { label: 'آدرس', value: 'تهران، خیابان ولیعصر، برج آورا', icon: 'pin' },
]

function Icon({ name }: { name: string }) {
  const common = 'h-5 w-5'
  if (name === 'phone')
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-1z" strokeLinejoin="round" />
      </svg>
    )
  if (name === 'mail')
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    )
  return (
    <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

export default function Contact() {
  const [sent, setSent] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [error, setError] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.message.trim()) {
      setError('لطفاً نام و پیام را کامل کنید.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('ایمیل معتبر وارد کنید.')
      return
    }
    setError('')
    setSent(true)
  }

  return (
    <section id="contact" className="mx-auto max-w-8xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeading
            eyebrow="ارتباط با ما"
            title="همیشه کنار شما هستیم"
            subtitle="سوالی دارید یا به مشاوره نیاز دارید؟ تیم آورا آماده پاسخگویی است."
          />
          <div className="mt-8 space-y-4">
            {CHANNELS.map((c) => (
              <div
                key={c.label}
                className="flex items-center gap-4 rounded-2xl border border-white/8 bg-ink-800/50 p-4"
              >
                <span className="grid h-11 w-11 place-items-center rounded-full bg-white/5 text-accent-soft">
                  <Icon name={c.icon} />
                </span>
                <div>
                  <p className="text-xs text-silver-400">{c.label}</p>
                  <p className="text-sm font-semibold text-white">{c.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* form */}
        <div className="glass rounded-3xl border border-white/10 p-6 sm:p-8">
          {sent ? (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-accent/20 text-accent">
                <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">پیام شما ارسال شد</h3>
              <p className="text-sm text-silver-300">
                به‌زودی با شما تماس می‌گیریم. سپاس از همراهی‌تان.
              </p>
              <button
                onClick={() => {
                  setSent(false)
                  setForm({ name: '', email: '', message: '' })
                }}
                className="mt-2 rounded-full border border-white/15 px-6 py-2.5 text-sm font-bold text-white hover:bg-white/5"
              >
                ارسال پیام جدید
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div>
                <label className="mb-1.5 block text-xs text-silver-400">
                  نام و نام خانوادگی
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-ink-900/60 px-4 py-3 text-sm text-white outline-none transition focus:border-accent/60"
                  placeholder="مثلاً علی رضایی"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-silver-400">ایمیل</label>
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  dir="ltr"
                  className="w-full rounded-xl border border-white/10 bg-ink-900/60 px-4 py-3 text-right text-sm text-white outline-none transition focus:border-accent/60"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-silver-400">پیام</label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-white/10 bg-ink-900/60 px-4 py-3 text-sm text-white outline-none transition focus:border-accent/60"
                  placeholder="چطور می‌توانیم کمکتان کنیم؟"
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                className="btn-sheen w-full rounded-full bg-white py-3.5 text-sm font-bold text-ink-950 transition-transform hover:scale-[1.02] active:scale-95"
              >
                ارسال پیام
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
