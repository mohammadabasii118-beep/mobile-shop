#!/usr/bin/env python3
"""ساخت صفحات سایت از products.json — بعد از هر تغییر قیمت/وضعیت اجرا شود: python3 build.py"""
import json, os, html
os.chdir(os.path.dirname(os.path.abspath(__file__)))
BOT = "https://t.me/PCLProClubs_Bot"
P = json.load(open("products.json", encoding="utf-8"))
FA = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
def fa(n): return f"{n:,}".translate(FA)
NAV = [("index.html", "خانه"), ("index.html#shop", "مسابقات و فروشگاه"),
       ("index.html#about", "درباره ما"), ("contact.html", "تماس با ما")]
FOOT = [("index.html#about", "درباره ما"), ("contact.html", "تماس با ما"),
        ("rules.html", "قوانین مسابقات"), ("refund.html", "شرایط خرید و استرداد وجه"),
        ("privacy.html", "حریم خصوصی")]

def art(kind):
    c = {"draft": "#e11d2e", "night": "#7c3aed", "tour": "#f59e0b", "x": "#06b6d4"}.get(kind, "#e11d2e")
    return f'''<svg viewBox="0 0 320 170" role="img" aria-label="" class="art"><defs>
<linearGradient id="g{kind}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0a0f"/><stop offset="1" stop-color="{c}" stop-opacity=".55"/></linearGradient>
<radialGradient id="l{kind}"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="320" height="170" fill="url(#g{kind})"/>
<circle cx="50" cy="28" r="24" fill="url(#l{kind})"/><circle cx="270" cy="28" r="24" fill="url(#l{kind})"/>
<path d="M0 110 Q160 70 320 110 V170 H0Z" fill="#0f5132" opacity=".85"/>
<g stroke="#fff" stroke-opacity=".55" fill="none" stroke-width="1.5"><path d="M0 130 Q160 96 320 130"/><ellipse cx="160" cy="138" rx="34" ry="9"/><path d="M160 102 V147"/></g>
<circle cx="160" cy="70" r="20" fill="#fff"/><path d="M160 56l9 7-3 11h-12l-3-11z" fill="#111"/>
<g fill="#111"><circle cx="141" cy="68" r="4"/><circle cx="179" cy="68" r="4"/><circle cx="160" cy="88" r="4"/></g></svg>'''

def card(p):
    ok = p.get("active")
    meta = "".join(f"<li>{html.escape(x)}</li>" for x in [
        ("هزینه: " + p["unit"]) if p.get("unit") else "",
        ("ظرفیت: " + p["capacity"]) if p.get("capacity") else "",
        p.get("terms") or ""] if x)
    btn = (f'<a class="btn" href="{BOT}?start=reg_{p["id"]}">ثبت‌نام و خرید</a>' if ok
           else '<span class="btn off">ثبت‌نام بسته است</span>')
    return f'''<article class="prod{'' if ok else ' closed'}">{art(p.get("art",""))}
<div class="pb"><h3>{html.escape(p["title"])}</h3><p>{html.escape(p["desc"])}</p>
{f'<ul class="meta">{meta}</ul>' if meta else ''}
<div class="price"><b>{fa(p["price"])}</b> <span>تومان</span></div>{btn}</div></article>'''

def page(fn, title, body, desc="PCL | Pro Clubs League؛ مسابقات آنلاین فوتبال EA SPORTS FC"):
    nav = "".join(f'<a href="{h}">{t}</a>' for h, t in NAV)
    foot = "".join(f'<a href="{h}">{t}</a>' for h, t in FOOT)
    open(fn, "w", encoding="utf-8").write(f'''<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{title} | PCL</title>
<meta name="description" content="{desc}"><link rel="stylesheet" href="style.css"></head><body id="top">
<header><div class="w bar"><a class="logo" href="index.html">PCL<i>●</i><small>Pro Clubs League</small></a>
<nav>{nav}</nav><a class="login" href="{BOT}">ورود کاربران</a></div></header>
{body}
<footer><div class="w"><div class="fl">{foot}</div>
<div class="enamad"><!--ENAMAD--></div>
<p>© PCL | Pro Clubs League — تمامی حقوق محفوظ است</p></div></footer></body></html>''')

page("index.html", "میدان رقابت حرفه‌ای‌ها", f'''
<section class="hero"><div class="w"><span class="tag">EA SPORTS FC · مسابقات آنلاین</span>
<h1>PCL | میدان رقابت حرفه‌ای‌ها</h1>
<p>در هیجان‌انگیزترین مسابقات آنلاین فوتبال شرکت کن، با بهترین تیم‌ها رقابت کن و مهارتت رو به چالش بکش!</p>
<a class="btn big" href="#shop">ثبت‌نام در مسابقات</a></div></section>
<section id="shop" class="w sec"><h2>ثبت‌نام مسابقات</h2>
<p class="sub">مسابقه‌ی مورد نظر را انتخاب کن؛ قیمت همه‌ی مسابقات به تومان و پیش از پرداخت مشخص است.</p>
<div class="prods">{"".join(card(p) for p in P)}</div></section>
<section id="about" class="w sec"><h2>درباره مجموعه PCL</h2>
<div class="box"><p>PCL یک مجموعه تخصصی در زمینه برگزاری مسابقات آنلاین فوتبال است که با هدف ایجاد رقابت‌های منظم، هیجان‌انگیز و حرفه‌ای برای علاقه‌مندان به بازی‌های فوتبالی فعالیت می‌کند.</p></div></section>
<section id="steps" class="w sec"><h2>مراحل شرکت در مسابقات</h2>
<ol class="steps"><li><b>۱</b>انتخاب مسابقه</li><li><b>۲</b>مطالعه قوانین</li><li><b>۳</b>ثبت‌نام و پرداخت</li><li><b>۴</b>دریافت تأییدیه شرکت</li></ol></section>''')

page("rules.html", "قوانین مسابقات", '''<div class="w page"><h1>قوانین مسابقات</h1>
<h2>۱. ثبت‌نام</h2><ul><li>ثبت‌نام فقط برای مسابقاتی انجام می‌شود که باز و در حال برگزاری باشند.</li><li>اطلاعات واردشده (آیدی بازی، نام تیم و …) باید درست باشد.</li><li>هزینه، ظرفیت و شرایط هر مسابقه پیش از پرداخت اعلام می‌شود.</li></ul>
<h2>۲. برگزاری</h2><ul><li>زمان‌بندی، جدول و نتایج از طریق ربات و کانال‌های رسمی PCL اعلام می‌شود.</li><li>تصمیم نهایی درباره‌ی نتایج و تخلفات با کادر برگزاری است.</li></ul>
<h2>۳. رفتار شرکت‌کنندگان</h2><ul><li>توهین، تقلب و استفاده از ابزارهای غیرمجاز موجب حذف از مسابقه می‌شود.</li></ul>
<h2>۴. تغییر قوانین</h2><p>PCL می‌تواند قوانین را به‌روزرسانی کند و تغییرات از طریق کانال‌های رسمی اعلام می‌شود.</p></div>''')

page("privacy.html", "حریم خصوصی", '''<div class="w page"><h1>سیاست حفظ حریم خصوصی</h1>
<h2>اطلاعاتی که ذخیره می‌کنیم</h2><ul><li>شناسه و نام کاربری تلگرام برای ثبت‌نام در مسابقات.</li><li>اطلاعاتی که هنگام ثبت‌نام وارد می‌کنید.</li><li>سوابق پرداخت (مبلغ، زمان و وضعیت).</li></ul>
<h2>اطلاعاتی که ذخیره نمی‌کنیم</h2><p>شماره کارت و اطلاعات بانکی در سرورهای ما ذخیره نمی‌شود؛ پرداخت در درگاه زرین‌پال انجام می‌گیرد.</p>
<h2>اشتراک اطلاعات</h2><p>اطلاعات کاربران به شخص ثالث فروخته یا واگذار نمی‌شود، مگر طبق الزام قانونی.</p>
<h2>حذف اطلاعات</h2><p>برای درخواست حذف اطلاعات از صفحه‌ی <a href="contact.html">تماس با ما</a> اقدام کنید.</p></div>''')

page("refund.html", "شرایط خرید و استرداد وجه", '''<div class="w page"><h1>شرایط خرید و استرداد وجه</h1>
<h2>خرید</h2><ul><li>خرید به معنای ثبت‌نام در مسابقه‌ی انتخاب‌شده است و پس از پرداخت موفق، تأییدیه‌ی شرکت دریافت می‌کنید.</li><li>مبلغ نهایی به تومان، پیش از پرداخت نمایش داده می‌شود.</li></ul>
<h2>استرداد وجه</h2><ul><li>اگر مسابقه برگزار نشود یا لغو شود، مبلغ ثبت‌نام کامل بازگردانده می‌شود.</li><li>اگر مبلغ از حساب شما کسر شده ولی ثبت‌نام انجام نشده باشد، پس از بررسی ظرف حداکثر ۷۲ ساعت کاری اصلاح یا بازگردانده می‌شود.</li><li>پس از شروع مسابقه، انصراف شرکت‌کننده مشمول استرداد نیست.</li><li>مبلغ به همان کارت بانکی پرداخت‌کننده بازمی‌گردد.</li></ul>
<p>برای پیگیری از صفحه‌ی <a href="contact.html">تماس با ما</a> اقدام کنید.</p></div>''')

page("contact.html", "تماس با ما", f'''<div class="w page"><h1>تماس با ما</h1>
<p>پشتیبانی و پاسخ‌گویی از طریق تلگرام انجام می‌شود:</p>
<ul><li>ربات اصلی: <a href="{BOT}">@PCLProClubs_Bot</a></li>
<li>کانال نقل‌وانتقالات: <a href="https://t.me/ProClubs_Transfer">@ProClubs_Transfer</a></li>
<li>کانال تورنمنت: <a href="https://t.me/Onenightchampion">@Onenightchampion</a></li>
<!--CONTACT-->
</ul><p>ساعات پاسخ‌گویی: هر روز ۱۰ صبح تا ۱۲ شب.</p></div>''')
print("ok")
