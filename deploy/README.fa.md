# نصب CaseLine روی سرور (Ubuntu)

این راهنما برای نصب **Staging** یا **Production** روی یک سرور Ubuntu 22.04 یا 24.04 است. هیچ سرویس بیرونی (پیامک، درگاه پرداخت، ایمیل) وصل نمی‌شود.

## پیش‌نیازها
- یک سرور Ubuntu 24.04 (پیشنهاد: ۲ vCPU، ۴ گیگ RAM، ۴۰ گیگ SSD) و دسترسی root یا sudo.
- یک دامنه یا زیردامنه (مثلاً `staging.example.com`) که **رکورد A آن به IP سرور اشاره کند**. بدون این، گواهی HTTPS گرفته نمی‌شود.
- سرور به اینترنت (npm، NodeSource و Let's Encrypt) دسترسی داشته باشد.
- حساب کاربری ادمین: شمارهٔ موبایل و رمز قوی (حداقل ۱۲ کاراکتر با حرف بزرگ، کوچک و عدد). نصب‌کننده این‌ها را در حین اجرا می‌پرسد و ذخیره نمی‌کند.

## گام‌ها
۱) فایل `caseline-*.tar.gz` را روی سرور بگذارید:
```
scp caseline-*.tar.gz root@SERVER_IP:/root/caseline.tar.gz
```
۲) روی سرور وارد شوید و مسیر پوشهٔ `deploy` را از tarball بیرون بکشید و اجرا کنید:
```
ssh root@SERVER_IP
mkdir -p /srv/caseline && tar -xzf /root/caseline.tar.gz -C /srv/caseline
DOMAIN=staging.example.com EMAIL=you@example.com bash /srv/caseline/deploy/install.sh /root/caseline.tar.gz
```
نصب حدود ۵ تا ۱۰ دقیقه طول می‌کشد. آخرش آدرس سایت، نتیجهٔ `/api/health` و خروجی `preflight` چاپ می‌شود.

۳) سایت را در `https://staging.example.com` باز کنید و با شمارهٔ ادمینی که ساختید وارد `/admin` شوید.

## نصب‌کننده چه می‌کند
Node 22، PostgreSQL 16، nginx و certbot را نصب می‌کند؛ کاربر `caseline`، دیتابیس با رمز تصادفی و فایل `.env` (مجوز ۶۰۰، با `AUTH_SECRET` تصادفی) می‌سازد؛ `npm ci`، `prisma migrate deploy` و `npm run build` را اجرا می‌کند؛ اولین ادمین را می‌سازد؛ سرویس systemd (فقط روی 127.0.0.1) و nginx با سقف آپلود ۱۲ مگابایت، فایروال (SSH، ۸۰، ۴۴۳) و بکاپ شبانهٔ ساعت ۰۳:۱۰ (نگهداری ۱۴ روز) را تنظیم می‌کند.
- **داده‌های دمو نصب نمی‌شوند** و seed دمو اجرا نمی‌شود. فروشگاه خالی است و باید دسته‌بندی، محصول، روش ارسال و اطلاعات کارت را در `/admin` وارد کنید.
- نصب دوباره امن است: `.env` و دیتابیس موجود دست نمی‌خورند.

## مسیرهای مهم
| چیز | مسیر |
|---|---|
| برنامه | `/srv/caseline` |
| تنظیمات و رازها | `/srv/caseline/.env` |
| آپلودها (رسیدها و پیوست‌ها) | `/srv/caseline-data/storage` |
| بکاپ‌ها | `/srv/caseline-data/backups` |
| لاگ‌ها | `journalctl -u caseline -f` |

## دستورهای روزمره
```
systemctl status caseline        # وضعیت
systemctl restart caseline       # راه‌اندازی مجدد
curl https://DOMAIN/api/health   # سلامت
```
**به‌روزرسانی:** tarball جدید را روی سرور بگذارید و اجرا کنید: `bash /srv/caseline/deploy/update.sh /root/caseline-new.tar.gz` (قبلش خودکار بکاپ می‌گیرد).

**بازیابی از بکاپ:** روی یک دیتابیس **خالی** جدید: `bash scripts/restore.sh <فایل db-….dump> <آدرس-دیتابیس-جدید> [uploads-….tar.gz] [/srv/caseline-data/storage]`، سپس `DATABASE_URL` را در `.env` عوض و سرویس را restart کنید. حتماً بکاپ‌ها را **بیرون از سرور** هم کپی کنید.

## قبل از انتشار عمومی (Public Production)
- سرویس SMS واقعی وصل شود. با `SMS_PROVIDER=console` کد ورود فقط در لاگ سرور چاپ می‌شود و مشتری نمی‌تواند وارد شود (`docs/EXTERNAL_SERVICES.md`).
- برای بازگشت وجه بانکی دو کاربر staff با مجوز `refund.manage` و `refund.approve` بسازید، یا قانون «دو نفره» را در تنظیمات خاموش کنید.
- حداقل یک بار بازیابی از بکاپ را تمرین کنید.
- بعد از هر تغییر مهم، `cd /srv/caseline && sudo -u caseline npm run preflight` را اجرا کنید.

## عیب‌یابی سریع
- **گواهی HTTPS نگرفت:** DNS هنوز به سرور اشاره نمی‌کند. بعد از اصلاح: `certbot --nginx -d DOMAIN -m EMAIL --agree-tos --redirect`
- **سایت بالا نمی‌آید:** `journalctl -u caseline -n 80`. اگر پیام `Unsafe production configuration` دیدید، `APP_URL` باید `https://` باشد و `AUTH_SECRET` نباید مقدار نمونه باشد.
- **همهٔ کاربران ناگهان «تعداد تلاش زیاد» می‌گیرند:** `TRUST_PROXY` باید `1` باشد و nginx باید `X-Forwarded-For $remote_addr` بفرستد (نصب‌کننده همین را تنظیم می‌کند).
