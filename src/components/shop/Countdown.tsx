'use client';

import { useEffect, useState } from 'react';
import { fa } from '@/lib/format';

/** شمارنده تا پایان امروز */
export default function Countdown() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      setLeft(Math.max(0, Math.floor((end.getTime() - Date.now()) / 1000)));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  const s = left ?? 0;
  const parts: [string, number][] = [['ثانیه', s % 60], ['دقیقه', Math.floor(s / 60) % 60], ['ساعت', Math.floor(s / 3600)]];
  return (
    <div className="clock" role="timer" aria-label="زمان باقی‌مانده تا پایان پیشنهاد" style={{ display: 'flex', gap: 8, direction: 'ltr', marginBottom: 24, width: 'fit-content' }}>
      {parts.map(([label, v]) => (
        <div key={label} style={{ minWidth: 64, padding: '10px 8px', borderRadius: 14, background: 'var(--night-2)', textAlign: 'center' }}>
          <b className="num" style={{ display: 'block', fontSize: 30, lineHeight: 1.2, fontWeight: 800, color: '#fff' }}>{left === null ? '--' : fa(String(v).padStart(2, '0')).replace(/^([۰-۹])$/, '۰$1')}</b>
          <span style={{ fontSize: 11, color: 'var(--on-night-mute)' }}>{label}</span>
        </div>
      ))}
    </div>
  );
}
