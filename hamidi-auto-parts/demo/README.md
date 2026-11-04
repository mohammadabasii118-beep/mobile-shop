# نسخه نمایشی تک‌فایلی (Live Demo)

یک نسخه تعاملی و مستقل از فروشگاه (HTML + JS بدون فریم‌ورک) برای نمایش آنلاین بدون نیاز به سرور.
داده‌ها از کاتالوگ اصلی پروژه گرفته می‌شوند.

```bash
# 1) خروجی گرفتن از داده‌ها (از ریشه پروژه)
cp demo/dump.ts src/__dump.ts && npx tsx src/__dump.ts > demo/data.json && rm src/__dump.ts
# 2) ساخت فایل نهایی
node demo/build.mjs assets/parts-svg demo/hamidi-auto-parts-demo.html
```
