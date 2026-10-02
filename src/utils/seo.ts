import { useEffect } from 'react';

export const SITE = 'CaseLine';

export function useSEO(opts: { title?: string; description?: string; path?: string; jsonLd?: object }) {
  const { title, description, path, jsonLd } = opts;
  useEffect(() => {
    const full = title ? `${title} | ${SITE}` : `${SITE} | فروشگاه قاب گوشی و لوازم جانبی موبایل`;
    document.title = full;
    const desc = description ?? 'CaseLine؛ فروشگاه قاب‌های خاص، محافظ صفحه، شارژر، کابل و لوازم جانبی موبایل با ارسال سریع و ضمانت اصالت.';
    const set = (sel: string, attr: string, key: string, val: string) => {
      let el = document.head.querySelector<HTMLElement>(sel);
      if (!el) { el = document.createElement(sel.startsWith('link') ? 'link' : 'meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute(sel.startsWith('link') ? 'href' : 'content', val);
    };
    set('meta[name="description"]', 'name', 'description', desc);
    set('meta[property="og:title"]', 'property', 'og:title', full);
    set('meta[property="og:description"]', 'property', 'og:description', desc);
    set('meta[property="og:type"]', 'property', 'og:type', 'website');
    set('meta[property="og:locale"]', 'property', 'og:locale', 'fa_IR');
    set('link[rel="canonical"]', 'rel', 'canonical', window.location.origin + (path ?? window.location.pathname));
    let ld = document.getElementById('ld-json');
    if (jsonLd) {
      if (!ld) { ld = document.createElement('script'); ld.id = 'ld-json'; ld.setAttribute('type', 'application/ld+json'); document.head.appendChild(ld); }
      ld.textContent = JSON.stringify(jsonLd);
    } else ld?.remove();
  }, [title, description, path, jsonLd]);
}
