import FadeIn from '../components/FadeIn';
import { categories } from '../data';

export default function ServicesSection() {
  return (
    <section className="relative bg-white rounded-t-[40px] sm:rounded-t-[50px] md:rounded-t-[60px] px-5 sm:px-8 md:px-10 py-20 sm:py-24 md:py-32" style={{ background: '#FFFFFF' }}>
      <FadeIn>
        <h2 className="font-black uppercase text-center mb-16 sm:mb-20 md:mb-28" style={{ color: '#0C0C0C', fontSize: 'clamp(3rem, 12vw, 160px)' }}>
          دسته‌بندی‌ها
        </h2>
      </FadeIn>
      <div className="max-w-5xl mx-auto">
        {categories.map((c, i) => (
          <FadeIn key={c.name} delay={i * 0.1}>
            <div
              className="flex items-start gap-4 sm:gap-8 md:gap-12 py-8 sm:py-10 md:py-12"
              style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(12, 12, 12, 0.15)' }}
            >
              <span className="font-black leading-none" style={{ color: '#0C0C0C', fontSize: 'clamp(3rem, 10vw, 140px)' }}>
                {(i + 1).toLocaleString('fa-IR', { minimumIntegerDigits: 2 })}
              </span>
              <div className="flex flex-col gap-2 sm:gap-3 pt-1">
                <h3 className="font-medium uppercase" style={{ color: '#0C0C0C', fontSize: 'clamp(1rem, 2.2vw, 2.1rem)' }}>
                  {c.name}
                </h3>
                <p className="font-light leading-relaxed max-w-2xl" style={{ color: '#0C0C0C', opacity: 0.6, fontSize: 'clamp(0.85rem, 1.6vw, 1.25rem)' }}>
                  {c.text}
                </p>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
