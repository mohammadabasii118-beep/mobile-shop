'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { saveBanner } from '@/lib/actions/admin-content';
import type { Banner } from '@/lib/types';
import { adminToast, type AState } from './client';
import ImageField from './ImageField';
import Pic from '../shop/Pic';
import { BadgeChip, Title } from '../shop/BannerParts';
import { ART_KEYS, ART_LABELS } from '../shop/Sprite';

type Cat = { slug: string; name: string }; type Brand = { slug: string; name: string };

export default function BannerEditor({ banner, categories, brands }: { banner: Partial<Banner> & { id?: number }; categories: Cat[]; brands: Brand[] }) {
  const [state, action, pending] = useActionState<AState, FormData>(saveBanner.bind(null, banner.id ?? null), undefined);
  const [b, setB] = useState({
    position: banner.position ?? 'hero', layout: banner.layout ?? 'split', theme: banner.theme ?? 'night',
    badgeA: (banner.badge ?? '').split('|')[0] ?? '', badgeB: (banner.badge ?? '').split('|')[1] ?? '',
    title: banner.title ?? '', subtitle: banner.subtitle ?? '', cta: banner.cta_text ?? '', link: banner.link ?? '',
    image: banner.image ?? '', imageM: banner.image_mobile ?? '', art: banner.art ?? 'p-charger',
  });
  const set = (p: Partial<typeof b>) => setB((c) => ({ ...c, ...p }));
  useEffect(() => { if (state?.ok) adminToast(state.ok); if (state?.error) adminToast(state.error, 'err'); }, [state]);
  const cover = b.layout === 'cover' && b.image;
  const quick = [
    { v: '/shop', l: 'فروشگاه (همه‌ی محصولات)' }, { v: '/shop?sale=1', l: 'تخفیف‌ها' }, { v: '/shop?sort=new', l: 'جدیدترین‌ها' },
    ...categories.map((c) => ({ v: `/category/${c.slug}`, l: `دسته: ${c.name}` })), ...brands.map((x) => ({ v: `/shop?brand=${x.slug}`, l: `برند: ${x.name}` })),
  ];

  return (
    <form action={action} className="ad-cols wide-side" style={{ alignItems: 'start' }}>
      <div className="ad-stack">
        <section className="ad-card">
          <div className="hd"><h2>پیش‌نمایش زنده</h2><p>نمایش تقریبی در سایت. در موبایل، متن بالای تصویر قرار می‌گیرد.</p></div>
          <div className="bd" style={{ padding: 12 }}>
            <div className="bn-prev">
              <div className={`slide t-${b.theme}${cover ? ' cover' : ''}`}>
                {cover && <div className="bg"><picture>{b.imageM && <source media="(max-width: 767px)" srcSet={b.imageM} />}{/* eslint-disable-next-line @next/next/no-img-element */}<img src={b.image} alt="" /></picture></div>}
                <div className="slide-in">
                  <div>
                    <BadgeChip text={b.badgeA ? (b.badgeB ? `${b.badgeA}|${b.badgeB}` : b.badgeA) : ''} />
                    <h2><Title text={b.title || 'عنوان بنر'} /></h2>
                    {b.subtitle && <p className="lead">{b.subtitle}</p>}
                    {b.cta && <div className="cta-row"><span className="btn btn-lg btn-main">{b.cta}</span></div>}
                  </div>
                  {!cover && <div className="slide-visual"><Pic src={b.image || (b.art ? `art:${b.art}` : null)} className="art" /></div>}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="ad-card">
          <div className="hd"><h2>متن بنر</h2></div>
          <div className="bd">
            <div className="fld"><label htmlFor="bt">عنوان</label>
              <textarea id="bt" className="textarea" name="title" rows={2} value={b.title} onChange={(e) => set({ title: e.target.value })} style={{ minHeight: 72 }} required />
              <span className="help">برای رفتن به خط بعد Enter بزنید. کلمه‌ی مهم را بین دو ستاره بگذارید تا رنگی شود: <b dir="ltr">شارژ سریع‌تر. *حمل سبک‌تر.*</b></span></div>
            <div className="fld"><label htmlFor="bs">توضیح کوتاه</label><textarea id="bs" className="textarea" name="subtitle" value={b.subtitle} onChange={(e) => set({ subtitle: e.target.value })} style={{ minHeight: 64 }} maxLength={220} /></div>
            <div className="ad-grid2">
              <div className="fld"><label htmlFor="ba">برچسب (بخش رنگی)</label><input id="ba" className="input" name="badge_a" value={b.badgeA} onChange={(e) => set({ badgeA: e.target.value })} placeholder="مثلاً: جدید" maxLength={24} /></div>
              <div className="fld"><label htmlFor="bb">برچسب (متن کنار آن)</label><input id="bb" className="input" name="badge_b" value={b.badgeB} onChange={(e) => set({ badgeB: e.target.value })} placeholder="مثلاً: شارژرهای GaN" maxLength={40} /></div>
              <div className="fld"><label htmlFor="bc">متن دکمه</label><input id="bc" className="input" name="cta_text" value={b.cta} onChange={(e) => set({ cta: e.target.value })} placeholder="مثلاً: مشاهده‌ی شارژرها" maxLength={30} /></div>
              <div className="fld"><label htmlFor="bl">لینک دکمه</label><input id="bl" className="input" name="link" dir="ltr" value={b.link} onChange={(e) => set({ link: e.target.value })} placeholder="/category/charger" /></div>
            </div>
            <div className="fld"><label htmlFor="bq">انتخاب سریع لینک</label>
              <select id="bq" className="sel" value="" onChange={(e) => e.target.value && set({ link: e.target.value })}><option value="">انتخاب صفحه…</option>{quick.map((q) => <option key={q.v} value={q.v}>{q.l}</option>)}</select></div>
          </div>
        </section>
      </div>

      <div className="ad-stack">
        <section className="ad-card">
          <div className="hd"><h2>نوع و ظاهر</h2></div>
          <div className="bd">
            <div className="fld"><label htmlFor="bp">محل نمایش</label>
              <select id="bp" className="sel" name="position" value={b.position} onChange={(e) => set({ position: e.target.value as 'hero' | 'promo' })}>
                <option value="hero">اسلایدر بالای صفحه‌ی اصلی (کشویی)</option><option value="promo">بنر تبلیغاتی میانی (دو‌تایی)</option></select></div>
            {b.position === 'hero' && (
              <div className="fld"><span className="lab">چیدمان</span>
                <div className="seg" role="group"><button type="button" aria-pressed={b.layout === 'split'} onClick={() => set({ layout: 'split' })}>متن + محصول</button><button type="button" aria-pressed={b.layout === 'cover'} onClick={() => set({ layout: 'cover' })}>تمام‌تصویر</button></div>
                <input type="hidden" name="layout" value={b.layout} />
                <span className="help">«تمام‌تصویر»: عکس تبلیغاتی آماده را پس‌زمینه می‌کند و متن را روی آن می‌نویسد.</span></div>
            )}
            {b.position === 'promo' && <input type="hidden" name="layout" value="split" />}
            <div className="fld"><span className="lab">رنگ زمینه</span>
              <div className="seg" role="group">{([['night', 'تیره'], ['light', 'روشن'], ['brand', 'آبی']] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={b.theme === k} onClick={() => set({ theme: k })}>{l}</button>)}</div>
              <input type="hidden" name="theme" value={b.theme} /></div>
          </div>
        </section>
        <section className="ad-card">
          <div className="hd"><h2>تصویر</h2></div>
          <div className="bd">
            <ImageField name="image" defaultValue={banner.image} label={b.layout === 'cover' && b.position === 'hero' ? 'تصویر دسکتاپ (الزامی)' : 'تصویر محصول (اختیاری)'} hint={b.layout === 'cover' && b.position === 'hero' ? 'پیشنهاد: ۲۴۰۰×۹۶۰ پیکسل (WebP یا JPG)' : 'PNG/WebP با زمینه‌ی شفاف؛ اگر خالی باشد از تصویر نمونه‌ی زیر استفاده می‌شود.'} onChange={(v) => set({ image: v })} aspect={b.layout === 'cover' ? '5 / 2' : '4 / 3'} />
            {b.layout === 'cover' && b.position === 'hero' && <ImageField name="image_mobile" defaultValue={banner.image_mobile} label="تصویر موبایل (اختیاری)" hint="پیشنهاد: ۱۰۸۰×۱۲۰۰ پیکسل" onChange={(v) => set({ imageM: v })} aspect="9 / 10" />}
            {!(b.layout === 'cover') && (
              <div className="fld"><label htmlFor="bar">تصویر نمونه (وقتی عکسی آپلود نشده)</label>
                <select id="bar" className="sel" name="art" value={b.art} onChange={(e) => set({ art: e.target.value })}>{ART_KEYS.map((k) => <option key={k} value={k}>{ART_LABELS[k]}</option>)}</select></div>
            )}
          </div>
        </section>
        <section className="ad-card">
          <div className="hd"><h2>انتشار</h2></div>
          <div className="bd">
            <label className="switch"><input type="checkbox" name="active" value="1" defaultChecked={banner.active === undefined ? true : !!banner.active} /><span className="tr" /><span>نمایش در سایت</span></label>
            <div className="ad-grid2">
              <div className="fld"><label htmlFor="b1">شروع نمایش</label><input id="b1" className="input" type="date" name="starts_at" defaultValue={banner.starts_at?.slice(0, 10) ?? ''} /></div>
              <div className="fld"><label htmlFor="b2">پایان نمایش</label><input id="b2" className="input" type="date" name="ends_at" defaultValue={banner.ends_at?.slice(0, 10) ?? ''} /></div>
            </div>
            <span className="help">تاریخ‌ها اختیاری‌اند؛ خالی یعنی همیشه.</span>
            <input type="hidden" name="sort" value={banner.sort ?? 0} />
          </div>
          <div className="ft"><Link className="btn btn-secondary" href="/admin/banners">انصراف</Link><button className="btn btn-primary" disabled={pending}>{pending ? 'در حال ذخیره…' : 'ذخیره‌ی بنر'}</button></div>
        </section>
      </div>
    </form>
  );
}
