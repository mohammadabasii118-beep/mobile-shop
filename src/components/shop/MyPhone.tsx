'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Smartphone } from 'lucide-react';

/** اگر مشتری قبلاً مدل گوشی انتخاب کرده، لینک سریع به محصولات سازگار */
export default function MyPhone({ models, basePath }: { models: { slug: string; name: string }[]; basePath: string }) {
  const [m, setM] = useState<string | null>(null);
  useEffect(() => {
    try { setM((JSON.parse(localStorage.getItem('vt_phone') || 'null') as { model: string } | null)?.model ?? null); } catch { /* noop */ }
  }, []);
  const name = models.find((x) => x.slug === m)?.name;
  if (!m || !name) return null;
  return (
    <div className="my-phone">
      <Smartphone className="i" />
      <span>گوشی شما: <b dir="ltr">{name}</b></span>
      <Link className="link" href={`${basePath}?model=${m}`} style={{ marginInlineStart: 'auto' }}>نمایش محصولات سازگار</Link>
    </div>
  );
}
