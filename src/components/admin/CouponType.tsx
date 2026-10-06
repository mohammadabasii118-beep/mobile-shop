'use client';

import { useState } from 'react';

export default function CouponType({ defaults }: { defaults: { type: string; value: number; max: number | null } }) {
  const [t, setT] = useState(defaults.type);
  return (
    <>
      <div className="ad-grid2">
        <div className="fld"><label htmlFor="ct">نوع تخفیف</label><select id="ct" className="sel" name="type" value={t} onChange={(e) => setT(e.target.value)}><option value="percent">درصدی</option><option value="fixed">مبلغ ثابت</option></select></div>
        <div className="fld"><label htmlFor="cv">{t === 'percent' ? 'درصد' : 'مبلغ (تومان)'}</label><input id="cv" className="input num" name="value" inputMode="numeric" defaultValue={defaults.value} required /></div>
      </div>
      {t === 'percent' && <div className="fld"><label htmlFor="cx">سقف تخفیف (تومان)</label><input id="cx" className="input num" name="max_discount" inputMode="numeric" defaultValue={defaults.max ?? ''} placeholder="بدون سقف" /></div>}
    </>
  );
}
