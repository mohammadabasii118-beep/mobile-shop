# تصاویر واقعی محصولات

تصاویر واقعی محصولات را اینجا قرار دهید، سپس در فایل دادهٔ محصولات مسیر آن‌ها را ست کنید.

## روش استفاده

۱. فایل تصویر را در همین پوشه بگذارید، مثلاً:
   `public/images/products/titan-magsafe-case.jpg`

۲. در `src/lib/products.ts` روی همان محصول فیلد `image` را ست کنید:
   ```ts
   image: "/images/products/titan-magsafe-case.jpg",
   // در صورت وجود چند زاویه:
   gallery: [
     "/images/products/titan-magsafe-case-1.jpg",
     "/images/products/titan-magsafe-case-2.jpg",
   ],
   ```

## نکات

- تا وقتی `image` خالی باشد، یک placeholder تمیز و واضح نمایش داده می‌شود
  (هرگز تصویر تصادفی به‌عنوان محصول واقعی نشان داده نمی‌شود).
- نسبت تصویر مربعی (۱:۱) بهترین نتیجه را می‌دهد؛ کامپوننت با `object-cover`
  نسبت را حفظ می‌کند.
- برای وب بهینه کنید (ترجیحاً WebP/AVIF، عرض ~۸۰۰ تا ۱۲۰۰ پیکسل).
