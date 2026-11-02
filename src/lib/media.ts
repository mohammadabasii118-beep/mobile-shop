/**
 * مسیر مرکزی تصاویر تبلیغاتی (AI/تولیدی) — جدا از تصاویر واقعی محصولات.
 *
 * - تصاویر تبلیغاتی سینمایی: public/images/advertising/**
 * - تصاویر واقعی محصولات:      public/images/products/**  (فیلد `image` روی محصول)
 *
 * برای جایگزینی هنر، فقط فایلِ همان مسیر را عوض کنید؛ نیازی به تغییر کد نیست.
 * اگر فایلی موجود نباشد، کامپوننت‌ها به‌صورت بی‌خطا به fallback سه‌بعدی/تیره برمی‌گردند.
 */
export const AD = {
  hero: "/images/advertising/hero/hero.webp",
  scenes: {
    cases: "/images/advertising/scenes/cases.png",
    power: "/images/advertising/scenes/power.png",
    audio: "/images/advertising/scenes/audio.png",
  },
  banners: {
    offer: "/images/advertising/banners/offer.webp",
  },
} as const;
