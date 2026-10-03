# ONE NIGHT CHAMPION — طرح معماری (مرحله ۱: فقط تحلیل، بدون کد اصلی)

> وضعیت: **پیش‌نویس برای تأیید**. هیچ خطی از کد ربات تغییر نکرده است. بعد از تأیید شما، پیاده‌سازی مرحله‌به‌مرحله شروع می‌شود.
> نکته: متن مشخصات ارسالی از جدول‌های دیتابیس شروع می‌شد (بخش‌های ۱ تا ۵۶ نرسید)؛ هر جا حدس زده‌ام با «❓» مشخص شده است.

---

## 1. CURRENT PROJECT ARCHITECTURE SUMMARY

- **زبان و کتابخانه‌ها:** Python 3.11، aiogram 3.31، aiosqlite، aiohttp (وب‌سرور بازگشت پرداخت)، پایگاه‌داده SQLite (یک فایل).
- **ورودی:** `pclbot/main.py` → `Dispatcher` با چهار Router به این ترتیب: `user → admin → wallet → ads`. FSM در حافظه (`MemoryStorage`).
- **لایه داده:** `pclbot/db.py` یک اتصال واحد؛ هر `execute()` بلافاصله `commit` می‌کند. جدول‌ها: `users, ads, transactions, gift_codes, gift_uses, badges, settings, admins, channels, custom_emojis, button_labels, message_texts`. مهاجرت: `CREATE TABLE IF NOT EXISTS` + `_migrate()` برای ستون‌های جدید. **Foreign key ندارد و PRAGMA foreign_keys خاموش است.**
- **منطق:** `services.py` (تأیید/رد/انتشار آگهی، نشان، پاداش)، `payments.py` (زرین‌پال)، `gate.py` (جوین اجباری)، `admins.py` (مدیران؛ مدیران اصلی از `.env`).
- **لایه ارسال:** `outgoing.py` یک middleware روی Session است که برای **همه** درخواست‌های خروجی ایموجی پرمیوم و ویرایش متن دکمه‌ها را اعمال می‌کند.
- **کانال انتشار فعلی:** تنظیم `settings.publish_chat` (گروه آگهی‌های Transfer).
- **callback_data:** فضای نام ساده (`menu`, `ad:*`, `adm:*`, `wallet:*` …).
- **تست:** `tests/smoke.py` و `tests/emoji_test.py` (آفلاین)؛ تست دکمه‌ها بررسی می‌کند همه برچسب‌های کد در `buttons.REGISTRY` باشند.

## 2. FILES THAT NEED TO CHANGE (کمترین تغییر در فایل‌های موجود)

| فایل | تغییر | ریسک برای Transfer |
|---|---|---|
| `pclbot/main.py` | include کردن Routerهای ONC (داخل `try/except` و پشت پرچم `onc_enabled`)، بارگذاری ONC | ندارد |
| `pclbot/handlers/user.py` | `/start` و `menu`: صفحه انتخاب بخش (`home`) نشان داده شود؛ منوی فعلی Transfer بدون تغییر در همان `menu` می‌ماند | کم |
| `pclbot/keyboards.py` | یک `home_menu()` اضافه می‌شود؛ `main_menu()` دست نمی‌خورد (فقط یک ردیف «بازگشت به انتخاب بخش») | کم |
| `pclbot/handlers/admin.py` | `/admin` به‌جای پنل Transfer، صفحه انتخاب «TRANSFER PANEL / ONE NIGHT CHAMPION PANEL» را نشان دهد؛ پنل فعلی با همان callbackها (`adm`) باز می‌ماند | کم |
| `pclbot/db.py` | `PRAGMA foreign_keys=ON`، قفل asyncio و `transaction()`؛ رفتار فعلی `execute/fetch*` بدون تغییر | **متوسط ← ❓ سؤال ۳** |
| `pclbot/buttons.py` | ثبت برچسب دکمه‌های ONC (تست پوشش دکمه‌ها را سبز نگه می‌دارد) | ندارد |
| `pclbot/outgoing.py` | معاف کردن چت کانال ONC از تبدیل ایموجی پرمیوم (ربات در کانال نمی‌تواند) | ندارد |
| `requirements.txt` / `Dockerfile` | Pillow، arabic-reshaper، python-bidi + فونت فارسی (برای گرافیک) | ندارد |
| `tests/` | تست‌های ONC اضافه می‌شود؛ تست‌های قبلی همان‌طور می‌مانند | ندارد |

**دست‌نخورده:** `ads.py, wallet.py, services.py, payments.py, texts.py, messages.py, emojis.py, gate.py` و همه جدول‌های Transfer.

## 3. NEW FILES / MODULES

```
pclbot/onc/
  __init__.py            # setup(dp) و پرچم onc_enabled
  schema.py              # DDL + مهاجرت‌های نسخه‌دار (جدول‌ها با پیشوند onc_)
  repo.py                # SQL خام (تنها جایی که جدول‌های ONC را می‌شناسد)
  states.py              # StatesGroupهای FSM (جدا از Transfer)
  keyboards.py           # دکمه‌های ONC
  services/
    tournament.py  teams.py  groups.py  schedule.py  rounds.py  results.py
    standings.py   qualification.py   knockout.py
    graphics.py    templates.py       publishing.py   audit.py
  handlers/
    user.py              # بیننده (فقط خواندن)
    admin/               # menu.py tournament.py groups.py teams.py schedule.py results.py review.py
                         # standings.py knockout.py graphics.py channel.py audit.py
  graphics/
    renderer.py          # Pillow: ترسیم تصویر
    assets/fonts/        # Vazirmatn (OFL)
tests/onc_*.py           # schedule, standings, tie-break, results flow, publishing, isolation
docs/ONC_ARCHITECTURE.md
```
Serviceها هیچ import از `pclbot/handlers/*` ندارند؛ handlerها فقط serviceها را صدا می‌زنند.

## 4. DATABASE MIGRATION PLAN

اصول: همه جدول‌ها `onc_*`؛ هیچ ستون یا جدول Transfer تغییر نمی‌کند؛ هیچ `DROP/DELETE` روی داده موجود؛ قبل از اولین مهاجرت **بکاپ خودکار** (`sqlite3 backup API` → `pclbot.db.bak-<تاریخ>`)؛ مهاجرت با `onc_schema_version` و داخل یک تراکنش؛ خطا ⇒ Rollback و ONC غیرفعال (Transfer کار می‌کند).

```sql
PRAGMA foreign_keys = ON;   -- جدول‌های موجود FK ندارند، پس بی‌اثر است

CREATE TABLE onc_schema_version(version INTEGER NOT NULL);

CREATE TABLE onc_template_sets(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, is_default INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE onc_graphic_templates(
  id INTEGER PRIMARY KEY,
  set_id INTEGER NOT NULL REFERENCES onc_template_sets(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('groups_draw','schedule','round_results','standings','knockout_bracket','champion_poster')),
  background_file_id TEXT, config_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(set_id, kind));

CREATE TABLE onc_tournaments(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','group_stage','knockout','finished')),
  start_at INTEGER, round_interval_min INTEGER NOT NULL DEFAULT 20 CHECK(round_interval_min >= 0),
  timezone TEXT NOT NULL DEFAULT 'Asia/Tehran',
  template_set_id INTEGER REFERENCES onc_template_sets(id),
  created_by INTEGER NOT NULL, created_at INTEGER NOT NULL);

CREATE TABLE onc_groups(
  id INTEGER PRIMARY KEY, tournament_id INTEGER NOT NULL REFERENCES onc_tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0,
  qualifiers INTEGER NOT NULL DEFAULT 2 CHECK(qualifiers >= 0),
  UNIQUE(tournament_id, name));

CREATE TABLE onc_teams(                              -- TOURNAMENT TEAMS
  id INTEGER PRIMARY KEY, tournament_id INTEGER NOT NULL REFERENCES onc_tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE, logo_file_id TEXT, UNIQUE(tournament_id, name));
CREATE TABLE onc_players(                            -- فقط Player ID
  id INTEGER PRIMARY KEY, team_id INTEGER NOT NULL REFERENCES onc_teams(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL COLLATE NOCASE, UNIQUE(team_id, player_id));
CREATE TABLE onc_group_members(                      -- GROUP MEMBERSHIPS
  group_id INTEGER NOT NULL REFERENCES onc_groups(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL UNIQUE REFERENCES onc_teams(id) ON DELETE CASCADE,   -- هر تیم فقط در یک گروه
  PRIMARY KEY(group_id, team_id));

CREATE TABLE onc_rounds(                             -- ROUNDS (گروهی و حذفی)
  id INTEGER PRIMARY KEY, tournament_id INTEGER NOT NULL REFERENCES onc_tournaments(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK(stage IN ('group','knockout')),
  number INTEGER NOT NULL, name TEXT NOT NULL, scheduled_at INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','entering','review','confirmed','published')),
  UNIQUE(tournament_id, stage, number));
CREATE TABLE onc_knockout_stages(                    -- KNOCKOUT STAGES
  id INTEGER PRIMARY KEY, tournament_id INTEGER NOT NULL REFERENCES onc_tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL, position INTEGER NOT NULL,
  round_id INTEGER NOT NULL UNIQUE REFERENCES onc_rounds(id) ON DELETE CASCADE,
  is_final INTEGER NOT NULL DEFAULT 0, UNIQUE(tournament_id, position));

CREATE TABLE onc_matches(                            -- MATCHES (بدون Home/Away)
  id INTEGER PRIMARY KEY, round_id INTEGER NOT NULL REFERENCES onc_rounds(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES onc_groups(id) ON DELETE CASCADE,       -- NULL = حذفی
  team_a_id INTEGER NOT NULL REFERENCES onc_teams(id), team_b_id INTEGER NOT NULL REFERENCES onc_teams(id),
  CHECK(team_a_id < team_b_id),                      -- ترتیب قراردادی؛ تیم‌ها فقط یک زوج یکتا دارند
  UNIQUE(group_id, team_a_id, team_b_id));           -- هر زوج در گروه فقط یک بار
CREATE TABLE onc_match_participants(                 -- هر تیم در هر Round حداکثر یک مسابقه
  match_id INTEGER NOT NULL REFERENCES onc_matches(id) ON DELETE CASCADE,
  round_id INTEGER NOT NULL, team_id INTEGER NOT NULL REFERENCES onc_teams(id),
  PRIMARY KEY(match_id, team_id), UNIQUE(round_id, team_id));

CREATE TABLE onc_results(                            -- RESULTS = منبع اصلی حقیقت
  match_id INTEGER PRIMARY KEY REFERENCES onc_matches(id) ON DELETE CASCADE,
  score_a INTEGER NOT NULL CHECK(score_a >= 0), score_b INTEGER NOT NULL CHECK(score_b >= 0),
  penalty_winner_id INTEGER REFERENCES onc_teams(id),                  -- ❓ فقط حذفی و مساوی
  status TEXT NOT NULL DEFAULT 'entered' CHECK(status IN ('entered','confirmed')),
  version INTEGER NOT NULL DEFAULT 1,
  entered_by INTEGER NOT NULL, entered_at INTEGER NOT NULL, confirmed_by INTEGER, confirmed_at INTEGER);
CREATE TABLE onc_tiebreaks(                          -- تعیین دستی ادمین برای تساوی حل‌نشده
  group_id INTEGER NOT NULL REFERENCES onc_groups(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES onc_teams(id) ON DELETE CASCADE,
  manual_rank INTEGER NOT NULL, set_by INTEGER NOT NULL, set_at INTEGER NOT NULL,
  PRIMARY KEY(group_id, team_id));
CREATE TABLE onc_qualification(                      -- QUALIFICATION (فقط موارد دستی/اصلاحی؛ بقیه محاسبه می‌شود)
  group_id INTEGER NOT NULL REFERENCES onc_groups(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES onc_teams(id) ON DELETE CASCADE,
  qualified INTEGER NOT NULL CHECK(qualified IN (0,1)), set_by INTEGER NOT NULL, set_at INTEGER NOT NULL,
  PRIMARY KEY(group_id, team_id));

CREATE TABLE onc_channel_settings(                   -- CHANNEL SETTINGS (یک ردیف؛ جدا از settings.publish_chat)
  id INTEGER PRIMARY KEY CHECK(id = 1), channel_chat_id TEXT, channel_title TEXT,
  updated_by INTEGER, updated_at INTEGER);
CREATE TABLE onc_publications(                       -- CHANNEL PUBLICATIONS
  id INTEGER PRIMARY KEY, tournament_id INTEGER NOT NULL REFERENCES onc_tournaments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('groups_draw','schedule','round_results','standings','knockout_bracket','champion')),
  stage TEXT NOT NULL, round_id INTEGER REFERENCES onc_rounds(id), stage_ref TEXT,
  channel_chat_id TEXT NOT NULL, message_id INTEGER,
  published_at INTEGER NOT NULL, published_by INTEGER NOT NULL,
  content_version INTEGER NOT NULL DEFAULT 1, content_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','superseded','failed')));
CREATE INDEX onc_pub_lookup ON onc_publications(tournament_id, kind, round_id, status);

CREATE TABLE onc_audit_logs(                         -- AUDIT LOGS
  id INTEGER PRIMARY KEY, tournament_id INTEGER, actor_id INTEGER NOT NULL, action TEXT NOT NULL,
  entity TEXT, entity_id INTEGER, before_json TEXT, after_json TEXT, created_at INTEGER NOT NULL);
```

**Standings Source of Truth:** جدول رده‌بندی ذخیره **نمی‌شود**؛ هر بار از `onc_results` با `status='confirmed'` محاسبه می‌شود (تعداد داده ناچیز است). فقط تعیین‌های دستی (`onc_tiebreaks`, `onc_qualification`) ذخیره می‌شوند. اگر روزی cache لازم شد، فقط داخل همان تراکنشی که Result تغییر می‌کند بازسازی می‌شود.

## 5. NEW MAIN MENU FLOW

```
/start
 └─ HOME:  [🔄 TRANSFER]   [🏆 ONE NIGHT CHAMPION]
```
- `🔄 TRANSFER` ← همان `menu` فعلی (۸ دکمه) + ردیف «🏠 انتخاب بخش».
- `🏆 ONE NIGHT CHAMPION` ← `onc:home` (منوی بیننده، بخش ۷).
- جوین اجباری، مسدودی و ثبت کاربر مثل قبل (middleware مشترک).

## 6. TRANSFER FLOW AFTER INTEGRATION

بدون تغییر: ثبت آگهی، آگهی‌های من، کیف پول، کارت هدیه، دعوت، نشان‌ها، پشتیبانی، آگهی ویژه، پرداخت. فقط نقطه ورود عوض می‌شود. callbackهای `menu, ad:*, wallet:*, adm:*, …` همان‌ها هستند.

## 7. ONE NIGHT CHAMPION USER FLOW (Viewer)

`onc:home` → `[📅 برنامه بازی‌ها] [📊 جدول گروه‌ها] [🥊 مرحله حذفی] [👥 تیم‌ها] [📢 کانال اخبار] [🔙]`
همه فقط‌خواندنی؛ هیچ ورودی از کاربر عادی گرفته نمی‌شود و هیچ callback مدیریتی برای او کار نمی‌کند.

## 8. TWO ADMIN PANELS FLOW

```
/admin → [🔄 TRANSFER PANEL] → پنل فعلی (adm، بدون تغییر)
         [🏆 ONC PANEL]      → onca:home
```
هر handler ONC با `admins.is_admin(uid)` **داخل خود handler** هم چک می‌شود (نه فقط فیلتر Router). ❓ سؤال ۴: همان فهرست مدیران؟

## 9. TOURNAMENT CREATION FLOW

نام ← تاریخ/ساعت شروع ← **ROUND INTERVAL** (دقیقه) ← قالب گرافیک (پیش‌فرض) ← ساخت (`draft`). سپس: ساخت گروه‌ها ← افزودن تیم‌ها ← **ساخت جدول** (فعال‌سازی `group_stage`). ویرایش interval فقط تا قبل از انتشار اولین Round (بعدش فقط با Warning و بازمحاسبه زمان‌های ثبت‌نشده).

## 10. GROUP / TEAM MANAGEMENT FLOW

- گروه: ساخت (نام)، حذف (فقط اگر هیچ Result تأییدشده‌ای ندارد؛ وگرنه Warning + تأیید)، تعیین تعداد صعودکننده هر گروه.
- تیم: نام ← لوگو (عکس، اختیاری ❓) ← Player IDها (چند خط) ← انتخاب گروه. حذف/جابه‌جایی تیم: اگر Match یا Result دارد ⇒ Warning و پس از تأیید جدول آن گروه‌ها دوباره ساخته می‌شود (Resultهای ثبت‌شده آن تیم‌ها پاک می‌شوند و در Audit می‌ماند).
- تعداد تیم هر گروه آزاد است؛ تعداد گروه آزاد است.

## 11. ROUND ROBIN SCHEDULING ALGORITHM (Single, بدون Home/Away)

برای هر گروه با `n` تیم (روش دایره‌ای):
1. اگر `n` فرد، یک «BYE» اضافه کن (`m = n+1`، وگرنه `m = n`).
2. یک تیم ثابت؛ بقیه در لیست چرخان. Round `r`: تیم‌ها از دو سر لیست جفت می‌شوند؛ جفتِ شامل BYE حذف می‌شود.
3. تعداد Roundهای گروه = `m-1`؛ هر زوج دقیقاً یک بار؛ هر تیم در هر Round حداکثر یک مسابقه (یا BYE).
4. Roundهای همه گروه‌ها **هم‌شماره** هستند: Round `k` = ادغام Round `k` همه گروه‌ها (همزمان؛ محدودیتی روی تعداد مسابقه همزمان نیست). گروهِ کوچک‌تر در Roundهای آخر مسابقه‌ای ندارد.
5. زمان: `scheduled_at(k) = start_at + (k-1) × round_interval`.
6. ذخیره: `onc_rounds` + `onc_matches` + `onc_match_participants` در **یک تراکنش**. ساخت مجدد جدول فقط وقتی مجاز است که هیچ Result ثبت نشده باشد.

## 12. STANDINGS + TIE-BREAK ALGORITHM

برای هر گروه فقط از Resultهای `confirmed`: P (بازی)، W/D/L، GF، GA، GD، Pts (برد ۳، مساوی ۱، باخت ۰).
1. مرتب‌سازی اولیه بر اساس Pts (نزولی).
2. هر دسته تساوی (Pts برابر):
   - **دو تیم:** Head-to-Head (برنده بازی مستقیم؛ اگر بازی نشده یا مساوی بود ادامه) ← GD (کل گروه) ← GF (کل گروه).
   - **سه تیم یا بیشتر:** GD ← GF. Head-to-Head استفاده نمی‌شود.
3. اگر پس از این‌ها هنوز تیم‌ها برابر بودند ⇒ `unresolved`؛ Bot هشدار می‌دهد و ادمین ترتیب را در `onc_tiebreaks` تعیین می‌کند. تا آن موقع صعود آن جایگاه «معلق» است و انتشار رده‌بندی نهایی مسدود می‌شود.
4. `onc_tiebreaks` فقط وقتی اعمال می‌شود که تساوی هنوز حل‌نشده باشد؛ اگر Result عوض شد و تساوی دیگر وجود ندارد، ردیف کنار گذاشته (نه حذف) و در Audit ثبت می‌شود.

## 13. RESULT ENTRY FLOW

Round را انتخاب کن (یا «Round بعدی») ← لیست Matchهای آن Round ← روی هر Match فقط **Final Score** (`2-1`) ← ذخیره با `status='entered'` (هنوز منتشر/تأیید نشده). هر Match بعداً قابل ویرایش. هیچ پیامی به کانال ارسال نمی‌شود. تا همه Matchهای Round ثبت نشود دکمه «مرور و انتشار» غیرفعال است.

## 14. TEXT SUMMARY + CONFIRM & PUBLISH FLOW

1. **Review:** Bot کل Resultهای Round را به‌صورت یک متن به ادمین نشان می‌دهد (`Round k — زمان — A 2-1 B …`، به تفکیک گروه).
2. ادمین هر نتیجه را **✏️ ویرایش** می‌کند (متن خلاصه دوباره ساخته می‌شود).
3. **✅ CONFIRM & PUBLISH** (تنها محرک انتشار):
   - **تراکنش ۱:** Resultها `confirmed`، `rounds.status='confirmed'`، بازمحاسبه رده‌بندی/صعود (Recalculate) + Audit.
   - ارسال به **کانال ONC** (متن خلاصه + در صورت وجود گرافیک).
   - **تراکنش ۲:** ثبت `onc_publications` و `rounds.status='published'`.
   - اگر ارسال شکست خورد: Round در حالت `confirmed` می‌ماند، دکمه «🔁 تلاش مجدد انتشار» نمایش داده می‌شود (Duplicate ساخته نمی‌شود).
4. **ویرایش بعد از انتشار:** Result تغییر می‌کند (نسخه +۱) ← رده‌بندی/صعود Recalculate ← Warning اگر Knockout وابسته دارد ← پیشنهاد «به‌روزرسانی انتشار قبلی» که **همان پیام** را با `editMessageText/Media` عوض می‌کند (پست تکراری ساخته نمی‌شود). اگر ویرایش تلگرام ممکن نبود (پیام پاک شده) ادمین انتخاب می‌کند «انتشار مجدد».

## 15. KNOCKOUT FLOW

صعودکننده‌ها از رده‌بندی (به‌علاوه تعیین دستی) فهرست می‌شوند. ادمین **آزادانه** مرحله می‌سازد (نام، زمان) و Matchup می‌چیند: هر دو تیم را از فهرست انتخاب می‌کند (Bot هیچ قالب `A1 vs B2` تحمیل نمی‌کند). ثبت Final Score و Review/Confirm مثل بخش ۱۴. برنده (❓ مساوی ⇒ برنده پنالتی) برای ساخت مرحله بعد پیشنهاد می‌شود. مرحله آخر `is_final=1` ⇒ پس از تأیید، **CHAMPION POSTER** (لوگو + نام تیم) ساخته می‌شود. تغییر Result گروهی بعد از ساخت Knockout: Warning با فهرست Matchupهای تحت تأثیر؛ بدون تأیید ادمین چیزی خراب/حذف نمی‌شود.

## 16. GRAPHICS ARCHITECTURE

- `graphics/renderer.py` با Pillow؛ متن فارسی با `arabic-reshaper` + `python-bidi` و فونت Vazirmatn (فایل داخل پروژه).
- **TEMPLATE SETS** ← چند **GRAPHIC TEMPLATE** (`groups_draw, schedule, round_results, standings, knockout_bracket, champion_poster`) هر کدام پس‌زمینه + رنگ/جای‌گذاری در `config_json`. ادمین مجموعه می‌سازد، پس‌زمینه آپلود می‌کند، مجموعه فعال تورنمنت را انتخاب می‌کند.
- **قانون ثابت:** لوگوی تیم فقط در `champion_poster`؛ سایر قالب‌ها فقط نام تیم.
- تصویر هر خروجی با `content_hash` کش می‌شود (انتشار مجدد بدون رندر تکراری).
- خروجی گرافیک بخشی از انتشار است و در `onc_publications.content_hash` ثبت می‌شود.

## 17. SEPARATE PUBLISHING ARCHITECTURE

| | TRANSFER | ONE NIGHT CHAMPION |
|---|---|---|
| مقصد | `settings.publish_chat` (گروه آگهی) | `onc_channel_settings.channel_chat_id` (کانال اخبار) |
| سرویس انتشار | `services.publish` | `onc/services/publishing.py` |
| تنظیم ادمین | «📡 گروه انتشار» در پنل Transfer | «📡 کانال ONC» در پنل ONC |
| رکورد | `ads.msg_id/chat_id` | `onc_publications` |

هیچ کدی از `onc/` به `publish_chat` اشاره نمی‌کند و `services.publish` هیچ‌وقت `onc_channel_settings` را نمی‌خواند. تست ایزولاسیون: اگر هر دو مقصد تنظیم باشند، آگهی Transfer فقط به گروه و پست ONC فقط به کانال می‌رود، و هنگام ناتنظیم بودن یکی، به دیگری ارسال نمی‌شود (خطای صریح، نه fallback).

## 18. HOW THE EXISTING TRANSFER SYSTEM STAYS PROTECTED

1. پیشوند `onc_` برای همه جدول‌ها؛ هیچ ALTER/DROP روی جدول‌های Transfer.
2. بکاپ خودکار قبل از مهاجرت + مهاجرت تراکنشی + Rollback.
3. ONC پشت `onc_enabled` و داخل `try/except`؛ خطا در بارگذاری ONC ⇒ Transfer بدون ONC بالا می‌آید.
4. فضای نام جدا برای callback (`onc:*`, `onca:*`) و FSM جدا؛ هیچ handler Transfer لمس نمی‌شود.
5. تغییر `db.py` فقط افزایشی است (قفل + `transaction()`)، و تست `smoke` + `emoji_test` + تست ایزولاسیون باید قبل از هر Push سبز باشند.
6. هر مرحله پیاده‌سازی جداگانه Commit و قابل Revert است.

---

## مراحل پیاده‌سازی پیشنهادی (بعد از تأیید)

1. زیرساخت: `db.transaction()`، `onc/schema.py` + مهاجرت امن + بکاپ + تست.
2. `/start` (HOME) + `/admin` (دو پنل) — Transfer دست‌نخورده، با تست.
3. تورنمنت/گروه/تیم + Audit.
4. زمان‌بندی (Round-Robin) + تست الگوریتم.
5. ثبت نتایج + Review + Confirm & Publish + رکورد انتشار.
6. رده‌بندی + Tie-break + صعود.
7. Knockout.
8. گرافیک + قالب‌ها.
9. نمای بیننده + تست‌های ایزولاسیون و سناریوی کامل.

## سؤال‌ها / تضادها (پیش از شروع پاسخ لازم است)

1. **بخش‌های ۱ تا ۵۶ نرسید.** اگر مورد خاصی در آن‌ها بود (قالب متن خلاصه، جزئیات گرافیک، متن‌های ربات) لطفاً بفرستید.
2. **زبان رابط ONC:** فارسی (مثل Transfer) یا انگلیسی؟ (نام‌ها در مشخصات انگلیسی بود.)
3. **تراکنش دیتابیس:** `db.py` الان هر دستور را جدا commit می‌کند، پس برای «Result Confirmation» و… تراکنش واقعی ندارد. پیشنهاد: افزودن قفل و `transaction()` بدون تغییر رفتار فعلی. موافقید؟
4. **مجوز مدیریت:** مدیران ONC همان فهرست مدیران فعلی باشند (مدیر اصلی/عادی)، یا فهرست جدا؟
5. **حذفی:** مساوی ممکن است؟ (پنالتی؟) بازی رده‌بندی ۳/۴ هم لازم است؟
6. **صعود:** فقط N نفر برتر هر گروه؟ (بهترین سومی‌ها نه؟)
7. **لوگوی تیم:** اجباری یا اختیاری؟ تعداد Player ID هر تیم ثابت است؟
8. **منطقه زمانی و یادآوری:** `Asia/Tehran`؟ یادآوری قبل از Round لازم است؟
9. **گرافیک:** فهرست ۶ قالب بالا کافی است؟ پس‌زمینه را ادمین آپلود کند؟
10. **کانال و ایموجی پرمیوم:** ربات در **کانال** ایموجی پرمیوم نمی‌فرستد؛ پیشنهاد: ایموجی ساده برای ONC (خودکار).
