import { Smartphone, BatteryCharging } from 'lucide-react';
import FadeIn from '../components/FadeIn';
import Magnet from '../components/Magnet';
import ContactButton from '../components/ContactButton';

const links = ['Shop', 'Categories', 'Products', 'Contact'];

export default function HeroSection() {
  return (
    <section className="relative h-screen flex flex-col" style={{ background: '#0C0C0C', overflowX: 'clip' }}>
      <FadeIn delay={0} y={-20}>
        <nav className="flex justify-between px-6 md:px-10 pt-6 md:pt-8">
          {links.map((l) => (
            <a
              key={l}
              href={`#${l.toLowerCase()}`}
              className="text-[#D7E2EA] font-medium uppercase tracking-wider text-sm md:text-lg lg:text-[1.4rem] hover:opacity-70 transition-opacity duration-200"
            >
              {l}
            </a>
          ))}
        </nav>
      </FadeIn>

      <div className="overflow-hidden">
        <FadeIn delay={0.15} y={40}>
          <h1 className="hero-heading font-black uppercase tracking-tight leading-none whitespace-nowrap w-full text-center text-[12vw] sm:text-[13vw] md:text-[14vw] lg:text-[15vw] mt-6 sm:mt-4 md:-mt-5">
            Jack&apos;s Gear
          </h1>
        </FadeIn>
      </div>

      <div className="mt-auto flex justify-between items-end px-6 md:px-10 pb-7 sm:pb-8 md:pb-10 relative z-20">
        <FadeIn delay={0.35} y={20}>
          <p
            className="text-[#D7E2EA] font-light uppercase tracking-wide leading-snug max-w-[160px] sm:max-w-[220px] md:max-w-[260px]"
            style={{ fontSize: 'clamp(0.75rem, 1.4vw, 1.5rem)' }}
          >
            cases, chargers, power banks, glass &amp; pendants for every phone
          </p>
        </FadeIn>
        <FadeIn delay={0.5} y={20}>
          <ContactButton label="Shop Now" />
        </FadeIn>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 z-10 top-1/2 -translate-y-1/2 sm:top-auto sm:translate-y-0 sm:bottom-0">
        <FadeIn delay={0.6} y={30}>
          <Magnet padding={150} strength={3} activeTransition="transform 0.3s ease-out" inactiveTransition="transform 0.6s ease-in-out">
            <div className="relative w-[280px] sm:w-[360px] md:w-[440px] lg:w-[520px] aspect-[4/5] sm:aspect-[5/5] flex items-end justify-center">
              <div className="absolute inset-0 rounded-full blur-3xl opacity-60" style={{ background: 'radial-gradient(circle, #B600A8 0%, #7621B0 40%, transparent 70%)' }} />
              <div
                className="relative w-[46%] aspect-[9/18] rounded-[2.2rem] border-[6px] border-[#D7E2EA]/80 overflow-hidden flex items-center justify-center -mb-6"
                style={{ background: 'linear-gradient(160deg, #18011F 0%, #B600A8 45%, #BE4C00 100%)', boxShadow: '0 30px 80px rgba(118,33,176,0.55)' }}
              >
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-1/3 h-3 rounded-full bg-black/70" />
                <div className="absolute top-8 left-3 w-14 h-14 rounded-2xl bg-black/40 border border-white/30 grid place-items-center">
                  <div className="w-7 h-7 rounded-full border-2 border-white/60 bg-black/60" />
                </div>
                <Smartphone className="text-white/30" size={90} strokeWidth={1} />
              </div>
              <div className="absolute left-[4%] top-[18%] w-20 h-20 sm:w-24 sm:h-24 rounded-3xl grid place-items-center border border-white/20 backdrop-blur-sm" style={{ background: 'linear-gradient(135deg,#0b1d3a,#2f7bff)' }}>
                <BatteryCharging className="text-white" size={40} strokeWidth={1.4} />
              </div>
            </div>
          </Magnet>
        </FadeIn>
      </div>
    </section>
  );
}
