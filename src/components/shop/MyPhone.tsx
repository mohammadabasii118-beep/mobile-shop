'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Smartphone } from 'lucide-react';
import { clearPhone, hasPhoneCookie, savePhone } from '@/lib/phone';

/**
 * نوار «گوشی من» (DESIGN.md §۱۸.۱۵).
 *  - auto: فیلتر خودکار اعمال شده؛ «نمایش همه» و «حذف گوشی»
 *  - بدون auto: اگر مشتری قبلاً گوشی انتخاب کرده، لینک به محصولات سازگار
 */
export default function MyPhone({ models, basePath, auto, allHref, compatHref }: {
  models: { slug: string; name: string; parent?: string }[]; basePath: string; auto?: string; allHref?: string; compatHref?: string;
}) {
  const [m, setM] = useState<string | null>(auto ?? null);
  useEffect(() => {
    if (auto) return;
    try {
      const saved = JSON.parse(localStorage.getItem('vt_phone') || 'null') as { brand?: string; model: string } | null;
      setM(saved?.model ?? null);
      // کاربرانی که قبل از فیلتر خودکار گوشی ذخیره کرده‌اند: کوکی را هم بساز تا صفحه‌های بعد خودکار فیلتر شوند
      if (saved?.model && !hasPhoneCookie()) savePhone(saved.brand ?? '', saved.model);
    } catch { /* noop */ }
  }, [auto]);
  const name = models.find((x) => x.slug === m)?.name;
  if (!m || !name) return null;
  if (auto) {
    return (
      <div className="my-phone" role="status">
        <Smartphone className="i" />
        <span>فقط محصولات سازگار با <b dir="ltr">{name}</b> نمایش داده می‌شود</span>
        <span className="mp-acts">
          {allHref && <Link className="link" href={allHref}>نمایش همه</Link>}
          <button type="button" className="link" onClick={() => { clearPhone(); window.location.href = basePath; }}>حذف گوشی</button>
        </span>
      </div>
    );
  }
  return (
    <div className="my-phone">
      <Smartphone className="i" />
      <span>گوشی شما: <b dir="ltr">{name}</b></span>
      <Link className="link" href={compatHref ?? `${basePath}?model=${m}`} style={{ marginInlineStart: 'auto' }}>نمایش محصولات سازگار</Link>
    </div>
  );
}
