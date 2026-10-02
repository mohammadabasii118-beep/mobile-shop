import { lazy, Suspense, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { Magnet } from '@/components/Magnet';

const HeroProduct3D = lazy(() => import('@/three/HeroProduct3D'));

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 160]);
  const op = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  return (
    <section ref={ref} className="relative isolate flex min-h-screen items-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_40%,rgba(139,92,246,.22),transparent_60%),radial-gradient(ellipse_at_80%_80%,rgba(236,72,153,.12),transparent_50%)]" />
      <Suspense fallback={null}><HeroProduct3D className="absolute inset-0 -z-0 h-full w-full max-md:top-[46%] max-md:h-[54%]" /></Suspense>
      <motion.div style={{ y, opacity: op }} className="container-x pointer-events-none relative z-10 pt-24">
        <p className="mb-5 inline-block rounded-full border border-line bg-white/5 px-4 py-1.5 text-xs font-bold text-mist backdrop-blur">کالکشن جدید ۱۴۰۵ ✦ CaseLine</p>
        <h1 className="text-[clamp(3.2rem,11vw,9.5rem)] font-black leading-[1.02] tracking-tight text-white">
          {['قاب گوشی،', 'استایل تو.'].map((l, i) => (
            <span key={l} className="block overflow-hidden pb-2"><motion.span className={`block ${i ? 'text-gradient' : ''}`} initial={{ y: '110%' }} animate={{ y: 0 }} transition={{ duration: 1, delay: 0.2 + i * 0.15, ease: [0.22, 1, 0.36, 1] }}>{l}</motion.span></span>
          ))}
        </h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mt-6 max-w-md text-base leading-8 text-mist/70 md:text-lg">قاب‌های خاص و لوازم جانبی موبایل برای کسانی که متفاوت انتخاب می‌کنند.</motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="pointer-events-auto mt-9 flex flex-wrap gap-3">
          <Magnet><Link to="/shop" className="btn btn-primary !px-8 !py-4 text-base">مشاهده فروشگاه<ArrowLeft size={18} /></Link></Magnet>
          <Magnet><Link to="/shop?sort=new" className="btn btn-ghost !px-8 !py-4 text-base backdrop-blur">مشاهده محصولات جدید</Link></Magnet>
        </motion.div>
      </motion.div>
      <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute bottom-6 left-1/2 -translate-x-1/2 text-mist/40"><ChevronDown /></motion.div>
    </section>
  );
}
