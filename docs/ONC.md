# 🏆 ONE NIGHT CHAMPION (ONC)

ماژول مسابقات داخل همان ربات PCL؛ کاملاً جدا از TRANSFER. رابط ربات (هر دو بخش) و گرافیک‌ها فارسی‌اند؛ فقط نام رویداد روی گرافیک‌ها «ONE NIGHT CHAMPION» است.

```
PCL BOT
├── 🔄 TRANSFER  (کد قبلی؛ دست‌نخورده)
└── 🏆 ONE NIGHT CHAMPION  → پنل کاربر + پنل ادمین + کانال خبری ONC
```

## چطور به Transfer آسیب نمی‌زند
| موضوع | راه‌حل |
|---|---|
| دیتابیس | جدول‌های `onc_*` با اتصال sqlite **جداگانه** (`onc/dbx.py`) و `PRAGMA foreign_keys=ON`. جدول‌های Transfer و `db.py` تغییر نکرده‌اند. قبل از اولین migration یک نسخه‌ی پشتیبان `…db.pre-onc.bak` ساخته می‌شود. |
| callbackها | همه‌ی دکمه‌های ONC با `onc:` شروع می‌شوند. callbackهای قبلی Transfer عوض نشده‌اند (`menu`, `adm`, …). |
| FSM | StateGroupهای ONC جدا هستند (`CreateSt`, `ResultSt`, …). |
| انتشار | مقصد ONC فقط `onc_settings.channel_id` است. تنظیم `publish_chat` ترنسفر هیچ‌وقت خوانده/نوشته نمی‌شود؛ انتخاب همان چت به‌عنوان کانال ONC رد می‌شود. |
| دسترسی | روتر ادمین ONC با فیلتر `is_admin` (چک واقعی) + `require_admin` در لایه‌ی سرویس. |
| تغییرات در کد Transfer | فقط: `handlers/home.py` (انتخاب بخش در `/start` و `/admin`)، یک ردیف «🏠 MAIN MENU» و مقصد دکمه‌ی پنل مدیریت در `keyboards.py`، ثبت چند برچسب در `buttons.py`، معاف‌کردن کانال ONC از ایموجی پریمیوم در `outgoing.py`، وصل‌کردن روترها در `main.py`. |

## ساختار
```
pclbot/onc/
  schema.py dbx.py        جدول‌ها، اتصال و تراکنش
  algo.py                 round robin، جدول، tie-break، صعود (خالص، بدون I/O)
  service.py              تورنمنت، تیم/بازیکن، گروه، برنامه، نتایج، صعود، حذفی، ویرایش با محافظ وابستگی، audit
  templates.py render.py gfx.py   تمپلیت/ست، رندر Pillow، ساخت داده‌ی گرافیک
  publish.py              تنها نقطه‌ی ارسال به کانال ONC + رکورد انتشار
  handlers_user.py handlers_admin.py handlers_play.py handlers_gfx.py  رابط تلگرام
  setup.py                init و فهرست روترها
```

## قوانین مهم (همه با تست پوشش داده شده‌اند)
* گروه‌ها: single round robin؛ تعداد گروه/تیم متغیر؛ BYE برای گروه فرد؛ هر تیم در هر Round حداکثر یک بازی (قید دیتابیس).
* زمان: `ROUND INTERVAL` فاصله‌ی **Roundها** است؛ همه‌ی بازی‌های یک Round (و همه‌ی گروه‌ها) هم‌زمان.
* امتیاز ۳/۱/۰. Tie دو تیم: امتیاز → رودررو → تفاضل → گل زده. سه تیم یا بیشتر: امتیاز → تفاضل → گل زده (بدون رودررو). باقی‌مانده → `NEEDS ADMIN DECISION` و تصمیم ادمین (فقط تا وقتی همان مجموعه‌ی تیم‌ها تساوی باشد معتبر است).
* جدول و صعود همیشه از **نتایج تأییدشده** محاسبه می‌شوند (چیزی ذخیره نمی‌شود). تساویِ حل‌نشده روی خط صعود، صعود را نهایی نمی‌کند.
* نتیجه → `SAVE RESULT` (فقط ثبت) → همه‌ی بازی‌های Round کامل شد → خلاصه‌ی متنی برای ادمین → `CONFIRM & PUBLISH` → گرافیک در کانال + رکورد انتشار. قبل از آن هیچ‌چیز منتشر نمی‌شود. برای حذفی هم همین جریان.
* ویرایش نتیجه‌ی منتشرشده: پست جدید ساخته نمی‌شود؛ `UPDATE CHANNEL POST` همان پیام را edit می‌کند (یا `KEEP CURRENT POST`). اگر تغییر صعودکننده‌ها/حذفی را نامعتبر کند، هشدار + تأیید لازم است و چیزی بی‌صدا خراب نمی‌شود.
* حذفی: matchupها را ادمین انتخاب می‌کند؛ برای بازی مساوی برنده را ادمین انتخاب می‌کند.
* لوگوی تیم فقط در پوستر قهرمان استفاده می‌شود (رندرر دیگر اصلاً لوگو نمی‌خواند).
* تراکنش: تأیید Round، ویرایش نتیجه، قرعه‌کشی، ساخت برنامه و … داخل `dbx.tx()` (BEGIN IMMEDIATE) هستند. اگر ارسال به کانال خطا بدهد، نتایج تأییدشده می‌مانند و «RETRY PUBLISH» دارد.

## گرافیک
۷ نوع: SCHEDULE، GROUP_TABLE، ROUND_RESULTS، QUALIFIED، KO_MATCHES، BRACKET، CHAMPION. هر تمپلیت: پس‌زمینه‌ی PNG/JPG (آپلود)، المان‌ها با `x/y/size/min/color/align/max_w/font`، ردیف‌های پویا (`start_y/row_h/gap/max_rows`) و صفحه‌بندی خودکار، کوچک‌شدن فونت تا حداقل (بعد از آن «…»). ادیتور موقعیت: UP/DOWN/LEFT/RIGHT با گام 1/5/10/25px. Template Set: کپی/فعال‌سازی. فونت: `ONC_FONT` یا DejaVu/Liberation (روی Ubuntu: `apt install fonts-dejavu-core`). نوشتن فارسی روی تصویر: اگر libraqm باشد خود Pillow انجام می‌دهد، وگرنه `arabic-reshaper` + `python-bidi` (هر دو در requirements هستند).

## نصب/به‌روزرسانی
```
pip install -r requirements.txt     # Pillow, arabic-reshaper, python-bidi اضافه شده
sudo apt install -y fonts-dejavu-core
# ربات را ادمین کانال ONC کنید (Post + Edit messages) و در پنل: ONC → CHANNEL → SET CHANNEL
```
متغیر اختیاری: `ONC_ASSETS_DIR` (پس‌زمینه‌های آپلودشده؛ پیش‌فرض کنار فایل دیتابیس). در Docker داخل `/data` است.

## تست
```
python -m tests.onc_algo_test     # الگوریتم‌ها
python -m tests.onc_test          # سناریوی کامل با هندلرها/دیتابیس/رندر واقعی (تلگرام ساختگی)
python -m tests.smoke && python -m tests.emoji_test   # Transfer
```
دمو: `demo/onc-live/index.html` (از اجرای واقعی ربات ساخته شده؛ `tests/onc_demo_build.py`).
