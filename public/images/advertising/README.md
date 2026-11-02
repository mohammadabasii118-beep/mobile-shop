# تصاویر تبلیغاتی سینمایی (AI / تولیدی)

این پوشه فقط برای **تصاویر تبلیغاتی و تزئینی** است — جدا از تصاویر واقعی محصولات
(`public/images/products`). این‌ها را می‌توان با هوش مصنوعی تولید کرد.

## مسیرها (در کد از این‌ها استفاده می‌شود — فقط فایل را جایگزین کنید)

| فایل | محل استفاده | نسبت پیشنهادی |
|---|---|---|
| `hero/hero.jpg` | پس‌زمینهٔ Hero سینمایی (پشت صحنهٔ سه‌بعدی) | 16:9 افقی |
| `scenes/cases.jpg` | صحنهٔ قاب و محافظت (اختیاری) | 16:9 |
| `scenes/power.jpg` | صحنهٔ قدرت و شارژ (اختیاری) | 16:9 |
| `scenes/audio.jpg` | صحنهٔ صدا (اختیاری) | 16:9 |
| `banners/offer.jpg` | بنر پیشنهاد ویژه | 21:9 عریض |

> اگر فایلی موجود نباشد، صفحه به‌صورت بی‌خطا به صحنهٔ سه‌بعدی/گرادیان تیره برمی‌گردد
> (کامپوننت `AdBackdrop`). پس بدون تغییر کد، هر زمان خواستید فایل‌ها را بگذارید.

## راهنمای سبک (هویت مشکی / سفید / نقره‌ای)

همهٔ تصاویر باید با پالت برند هماهنگ باشند. کلیدواژه‌های مشترک:

> deep matte black background, brushed silver / platinum metallic accents,
> soft cinematic rim lighting, subtle volumetric light, minimal, luxury tech
> product photography, high contrast, no text, no logos, 8k, photorealistic

### پرامپت‌های آماده

- **hero/hero.jpg**
  > ultra-minimal luxury tech hero background, floating premium smartphone and
  > accessories silhouettes in deep black space, brushed silver reflections,
  > cinematic volumetric lighting, soft particles, negative space on one side
  > for text, dark moody, photorealistic, 8k — (بدون متن و لوگو)

- **banners/offer.jpg**
  > wide luxury promo banner, dark matte black studio, silver metallic phone
  > accessories arranged elegantly, dramatic rim light, premium, minimal,
  > space for headline on the right, photorealistic, 21:9

- **scenes/power.jpg**
  > cinematic dark scene, silver charging cable and power bank with subtle
  > glowing energy lines, deep black background, metallic reflections, minimal

## نکات بهینه‌سازی
- فرمت WebP/AVIF، کیفیت بالا ولی حجم بهینه (hero < ~۳۰۰KB در حالت ایده‌آل).
- بدون متن داخل تصویر (متن‌ها با کد روی تصویر می‌آیند تا فارسی/RTL درست بماند).
