'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import type { Banner } from '@/lib/types';
import Pic from './Pic';
import { BadgeChip, Title } from './BannerParts';

const INTERVAL = 6500;

export default function HeroSlider({ slides }: { slides: Banner[] }) {
  const n = slides.length;
  const [i, setI] = useState(0);
  const [hover, setHover] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const st = useRef({ x: 0, id: -1, moved: false, down: false });
  const view = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    const h = () => setReduce(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  const paused = userPaused || hover || reduce || n < 2;
  const go = useCallback((to: number) => setI(((to % n) + n) % n), [n]);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => go(i + 1), INTERVAL);
    return () => clearTimeout(t);
  }, [i, paused, go]);

  useEffect(() => {
    const v = () => document.hidden && setHover(true);
    const back = () => !document.hidden && setHover(false);
    document.addEventListener('visibilitychange', v);
    document.addEventListener('visibilitychange', back);
    return () => { document.removeEventListener('visibilitychange', v); document.removeEventListener('visibilitychange', back); };
  }, []);

  const onDown = (e: React.PointerEvent) => {
    if (n < 2 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    st.current = { x: e.clientX, id: e.pointerId, moved: false, down: true };
  };
  const onMove = (e: React.PointerEvent) => {
    const s = st.current;
    if (!s.down) return;
    const d = e.clientX - s.x;
    if (!s.moved && Math.abs(d) > 8) {
      s.moved = true;
      setDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(s.id);
    }
    if (s.moved) setDx(d);
  };
  const onUp = () => {
    const s = st.current;
    if (!s.down) return;
    s.down = false;
    const w = view.current?.clientWidth ?? 1;
    if (s.moved) {
      if (dx > Math.min(80, w * 0.15)) go(i + 1); // در RTL کشیدن به راست = اسلاید بعدی
      else if (dx < -Math.min(80, w * 0.15)) go(i - 1);
    }
    setDx(0);
    setDragging(false);
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (st.current.moved) { e.preventDefault(); e.stopPropagation(); st.current.moved = false; }
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(i + 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(i - 1); }
  };

  return (
    <section
      className="hero" role="region" aria-roledescription="carousel" aria-label="بنرهای فروشگاه"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)} onBlur={() => setHover(false)} onKeyDown={onKey}
    >
      <div ref={view} style={{ overflow: 'hidden' }}>
        <div
          className={`hero-track ${dragging ? 'dragging' : 'anim'}`}
          style={{ transform: `translateX(calc(${i * 100}% + ${dx}px))` }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClickCapture={onClickCapture}
          aria-live={paused ? 'polite' : 'off'}
        >
          {slides.map((s, k) => {
            const active = k === i;
            const cover = s.layout === 'cover' && s.image;
            return (
              <div
                key={s.id} className={`slide t-${s.theme}${cover ? ' cover' : ''}`}
                role="group" aria-roledescription="اسلاید" aria-label={`${k + 1} از ${n}`}
                aria-hidden={!active} {...(!active ? { inert: true } : {})}
              >
                {cover && (
                  <div className="bg" aria-hidden>
                    <picture>
                      {s.image_mobile && <source media="(max-width: 767px)" srcSet={s.image_mobile} />}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.image!} alt="" loading={k === 0 ? 'eager' : 'lazy'} draggable={false} />
                    </picture>
                  </div>
                )}
                {cover && s.link && <Link className="slide-link" href={s.link} tabIndex={-1} aria-hidden draggable={false} />}
                <div className="slide-in">
                  <div>
                    <BadgeChip text={s.badge} />
                    {k === 0 ? <h1><Title text={s.title} /></h1> : <h2><Title text={s.title} /></h2>}
                    {s.subtitle && <p className="lead">{s.subtitle}</p>}
                    {s.cta_text && s.link && (
                      <div className="cta-row"><Link className="btn btn-lg btn-main" href={s.link} draggable={false}>{s.cta_text}</Link></div>
                    )}
                  </div>
                  {!cover && (
                    <div className="slide-visual" aria-hidden>
                      <Pic src={s.image || (s.art ? `art:${s.art}` : null)} className="art" eager={k === 0} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {n > 1 && (
        <>
          <button className="hero-btn prev" onClick={() => go(i - 1)} aria-label="اسلاید قبلی"><ChevronRight className="i" /></button>
          <button className="hero-btn next" onClick={() => go(i + 1)} aria-label="اسلاید بعدی"><ChevronLeft className="i" /></button>
          <div className="hero-ctl">
            <button className="hero-pp" onClick={() => setUserPaused((p) => !p)} aria-label={userPaused ? 'پخش خودکار' : 'توقف پخش خودکار'}>
              {userPaused ? <Play /> : <Pause />}
            </button>
            <div className="dots" role="tablist" aria-label="انتخاب اسلاید">
              {slides.map((s, k) => (
                <button
                  key={`${s.id}-${k === i ? 'a' + (paused ? 'p' : 'r') : 'x'}`}
                  className={`dot${paused ? ' nofill' : ''}`} role="tab" aria-selected={k === i} aria-current={k === i}
                  aria-label={`رفتن به اسلاید ${k + 1}`} onClick={() => go(k)}
                  style={{ ['--dur' as string]: `${INTERVAL}ms` }}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
