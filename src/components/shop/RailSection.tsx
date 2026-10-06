'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * بخش «ریل»: ردیف افقی با snap، فلش‌ها (تبلت/دسکتاپ)، نوار پیشرفت، انیمیشن ورود،
 * و در صورت نیاز پخش خودکار + نقطه‌ها (برای نظرات). RTL-safe: scrollLeft در RTL منفی است.
 */
export default function RailSection({
  title, sub, href, linkLabel = 'مشاهده‌ی همه', autoplay = false, dots = false, intervalMs = 4200, className = '', children,
}: {
  title: string; sub?: string; href?: string; linkLabel?: string; autoplay?: boolean; dots?: boolean; intervalMs?: number; className?: string; children: React.ReactNode;
}) {
  const sec = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  const hold = useRef(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [canScroll, setCanScroll] = useState(true);
  const [count, setCount] = useState(0);
  const [cur, setCur] = useState(0);

  const update = useCallback(() => {
    const t = track.current;
    if (!t) return;
    const max = t.scrollWidth - t.clientWidth;
    const pos = Math.abs(t.scrollLeft);
    setCanScroll(max > 2);
    setAtStart(pos < 2);
    setAtEnd(pos > max - 2);
    if (bar.current) {
      const vis = max > 0 ? t.clientWidth / t.scrollWidth : 1;
      const ratio = max > 0 ? pos / max : 0;
      bar.current.style.width = `${Math.max(vis * 100, 12)}%`;
      bar.current.style.transform = `translateX(${-(ratio * (100 / Math.max(vis, 0.12) - 100))}%)`;
    }
    const kids = Array.from(t.children) as HTMLElement[];
    setCount(kids.length);
    const c = t.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(t).paddingInlineStart) || 0;
    let best = 0, bd = Infinity;
    kids.forEach((k, i) => {
      const d = Math.abs(k.getBoundingClientRect().right - c.right + pad);
      if (d < bd) { bd = d; best = i; }
    });
    setCur(best);
  }, []);

  useEffect(() => {
    const t = track.current;
    if (!t) return;
    update();
    t.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const ro = new ResizeObserver(update);
    ro.observe(t);
    return () => { t.removeEventListener('scroll', update); window.removeEventListener('resize', update); ro.disconnect(); };
  }, [update]);

  useEffect(() => {
    const el = sec.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { el.classList.add('go'); io.unobserve(el); } }), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scrollToIndex = useCallback((k: number) => {
    const t = track.current;
    if (!t) return;
    const kids = Array.from(t.children) as HTMLElement[];
    const target = kids[(k + kids.length) % kids.length];
    const pad = parseFloat(getComputedStyle(t).paddingInlineStart) || 0;
    t.scrollTo({ left: t.scrollLeft + (target.getBoundingClientRect().right - t.getBoundingClientRect().right) + pad, behavior: reduce() ? 'auto' : 'smooth' });
  }, []);

  useEffect(() => {
    if (!autoplay || reduce()) return;
    const id = setInterval(() => {
      const t = track.current;
      if (!t || hold.current || document.hidden || !canScroll) return;
      const last = Math.abs(t.scrollLeft) >= t.scrollWidth - t.clientWidth - 4;
      scrollToIndex(last ? 0 : cur + 1);
    }, intervalMs);
    return () => clearInterval(id);
  }, [autoplay, canScroll, cur, intervalMs, scrollToIndex]);

  const by = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.85, behavior: reduce() ? 'auto' : 'smooth' });

  return (
    <section ref={sec} className={`sec railsec ${className}`}>
      <div className="wrap">
        <div className="sh">
          <div><h2>{title}</h2>{sub && <p className="sub">{sub}</p>}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {href && <Link className="more" href={href}>{linkLabel}<ArrowLeft className="i" /></Link>}
            {canScroll && (
              <div className="rail-ctl">
                <button className="arrow" onClick={() => by(1)} disabled={atStart} aria-label="قبلی"><ChevronRight className="i" /></button>
                <button className="arrow" onClick={() => by(-1)} disabled={atEnd} aria-label="بعدی"><ChevronLeft className="i" /></button>
              </div>
            )}
          </div>
        </div>
        <div
          ref={track} className="rail-track" tabIndex={0} role="group" aria-label={title}
          onPointerDown={() => { hold.current = true; }} onPointerUp={() => setTimeout(() => { hold.current = false; }, 3500)}
          onMouseEnter={() => { hold.current = true; }} onMouseLeave={() => { hold.current = false; }}
          onFocus={() => { hold.current = true; }} onBlur={() => { hold.current = false; }}
        >
          {children}
        </div>
        {canScroll && !dots && <div className="rail-bar" aria-hidden><i ref={bar as React.RefObject<HTMLElement & HTMLDivElement>} /></div>}
        {dots && count > 1 && canScroll && (
          <div className="rail-dots" role="tablist" aria-label="انتخاب مورد">
            {Array.from({ length: count }, (_, k) => <button key={k} role="tab" aria-selected={k === cur} aria-current={k === cur} aria-label={`مورد ${k + 1}`} onClick={() => scrollToIndex(k)} />)}
          </div>
        )}
      </div>
    </section>
  );
}
