import { Smartphone, BatteryCharging, Shield, Gem } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import FadeIn from '../components/FadeIn';
import AnimatedText from '../components/AnimatedText';
import ContactButton from '../components/ContactButton';

function Deco({ icon: Icon, from, to, size, pos, delay, x }: { icon: LucideIcon; from: string; to: string; size: string; pos: string; delay: number; x: number }) {
  return (
    <div className={`absolute ${pos}`}>
      <FadeIn delay={delay} x={x} y={0} duration={0.9}>
        <div
          className={`${size} aspect-square rounded-[32%] grid place-items-center border border-white/15`}
          style={{ background: `linear-gradient(135deg, ${from}, ${to})`, boxShadow: `0 20px 60px ${to}55` }}
        >
          <Icon className="text-white/90 w-1/2 h-1/2" strokeWidth={1.2} />
        </div>
      </FadeIn>
    </div>
  );
}

export default function AboutSection() {
  return (
    <section id="shop" className="relative min-h-screen flex flex-col items-center justify-center px-5 sm:px-8 md:px-10 py-20" style={{ background: '#0C0C0C' }}>
      <Deco icon={Smartphone} from="#18011F" to="#B600A8" size="w-[120px] sm:w-[160px] md:w-[210px]" pos="top-[4%] left-[1%] sm:left-[2%] md:left-[4%]" delay={0.1} x={-80} />
      <Deco icon={Shield} from="#06202a" to="#06b6d4" size="w-[100px] sm:w-[140px] md:w-[180px]" pos="bottom-[8%] left-[3%] sm:left-[6%] md:left-[10%]" delay={0.25} x={-80} />
      <Deco icon={BatteryCharging} from="#2b1600" to="#BE4C00" size="w-[120px] sm:w-[160px] md:w-[210px]" pos="top-[4%] right-[1%] sm:right-[2%] md:right-[4%]" delay={0.15} x={80} />
      <Deco icon={Gem} from="#1f1235" to="#7621B0" size="w-[130px] sm:w-[170px] md:w-[220px]" pos="bottom-[8%] right-[3%] sm:right-[6%] md:right-[10%]" delay={0.3} x={80} />

      <div className="relative z-10 flex flex-col items-center gap-16 sm:gap-20 md:gap-24">
        <div className="flex flex-col items-center gap-10 sm:gap-14 md:gap-16">
          <FadeIn delay={0} y={40}>
            <h2 className="hero-heading font-black uppercase leading-none tracking-tight text-center" style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}>
              درباره ما
            </h2>
          </FadeIn>
          <AnimatedText
            text="در جک شاپ بهترین لوازم جانبی موبایل را عرضه می‌کنیم: قاب‌های مقاوم، شارژرهای فست، پاوربانک، گلس محافظ و آویزهای شیک. همه محصولات از نظر کیفیت تست می‌شوند و با قیمت منصفانه، ارسال سریع و ضمانت بازگشت کالا به دست شما می‌رسند. بیایید گوشی شما را محافظت‌شده، پرانرژی و جذاب نگه داریم!"
            className="text-[#D7E2EA] font-medium text-center leading-relaxed max-w-[560px]"
            style={{ fontSize: 'clamp(1rem, 2vw, 1.35rem)' }}
          />
        </div>
        <ContactButton label="تماس با ما" />
      </div>
    </section>
  );
}
