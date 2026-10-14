# پنل چندلوکیشن (VPN panel)

پنل مدیریت مشابه مرزبان/سنایی با چند نود (لوکیشن)، کاربر با حجم و انقضا، و لینک اشتراک واحد.

**پروتکل‌های نسخه ۱:** VLESS+Reality، Trojan، Shadowsocks 2022 (هسته Xray)، Hysteria2 (sing-box)، L2TP/IPsec (strongSwan + xl2tpd).
اضافه‌کردن پروتکل جدید: یک ردیف در `panel/app/catalog.py`، یک renderer در `agent/agent.py`، یک لینک‌ساز در `panel/app/subscription.py`.

## ساختار
- `panel/` پنل (FastAPI + SQLite) و رابط وب (`panel/app/static`)
- `agent/agent.py` ایجنت روی هر نود؛ هر ۳۰ ثانیه تنظیمات را می‌گیرد، سرویس‌ها را به‌روز می‌کند و مصرف را گزارش می‌دهد
- `agent/install.sh` نصب‌کننده نود (پنل آن را با آدرس خودش سرو می‌کند)
- `deploy/` داکر و Caddy برای HTTPS

## راه‌اندازی پنل
سرور پنل یک دامنه لازم دارد که به آی‌پی آن اشاره کند.

```bash
cd vpn-panel
cat > .env <<ENV
PANEL_DOMAIN=panel.example.com
PANEL_ADMIN_PASSWORD=یک-رمز-قوی
PANEL_SECRET=$(openssl rand -hex 32)
ENV
docker compose --env-file .env -f deploy/docker-compose.yml up -d
```
بدون داکر (برای تست): `cd panel && pip install -r requirements.txt && PANEL_ADMIN_PASSWORD=demo uvicorn app.main:app`

## وصل‌کردن نود
1. یک سرور لینوکس تازه (اوبونتو ۲۲.۰۴/۲۴.۰۴) در کشور مورد نظر بگیرید. آدرس نود می‌تواند خود آی‌پی باشد، ولی با دامنه (مثلاً `de.example.com`) می‌توانید بعداً گواهی واقعی بگذارید.
2. در پنل: **لوکیشن‌ها ← لوکیشن جدید**، نام و کد کشور و آدرس را بدهید.
3. پنل یک دستور نصب نشان می‌دهد. آن را روی سرور جدید با root اجرا کنید:
   `bash <(curl -sL https://panel.example.com/node-install.sh) --token TOKEN --address de.example.com`
4. در فایروال سرویس‌دهنده این پورت‌ها را باز کنید: TCP 443، 8443، 8388؛ UDP 8388، 36712؛ UDP 500، 4500، 1701.
5. حدود یک دقیقه بعد نود «آنلاین» می‌شود. از آن پس هر تغییر کاربر یا پروتکل ظرف ۳۰ ثانیه روی نود اعمال می‌شود.

نود فقط به پنل وصل می‌شود (خروجی HTTPS)؛ پورتی برای پنل روی نود باز نیست. کلید خصوصی Reality هیچ‌وقت از نود خارج نمی‌شود.

## محدودیت‌های فعلی
- **این نسخه روی سرور واقعی تست نشده.** پنل، API، لینک‌ها و تولید کانفیگ‌ها تست خودکار دارند (`pytest tests`)، ولی نصب‌کننده و راه‌اندازی Xray، sing-box و strongSwan باید روی یک سرور واقعی امتحان شود. اولین نود را حتماً جداگانه تست کنید.
- شمارش مصرف فقط برای پروتکل‌های Xray (VLESS، Trojan، Shadowsocks) انجام می‌شود. Hysteria2 و L2TP هنوز مصرف گزارش نمی‌کنند، پس سقف حجم برای آن‌ها اعمال نمی‌شود (انقضا و غیرفعال‌سازی اعمال می‌شود).
- Trojan و Hysteria2 با گواهی خودامضا نصب می‌شوند و لینک‌ها `insecure` هستند. برای گواهی واقعی، فایل‌های `/etc/vpn-node/tls.crt` و `tls.key` را عوض کنید و در `agent.json` مقدار `tls_self_signed` را `false` کنید.
- تغییر کاربران Xray با ری‌استارت سرویس اعمال می‌شود و اتصال‌های جاری لحظه‌ای قطع می‌شوند.
- L2TP در شبکه‌هایی که پروتکل‌های قدیمی IPsec را فیلتر می‌کنند ممکن است کار نکند.
- هنوز نیست: WireGuard، OpenVPN، IKEv2، SSTP، AnyConnect، چند مدیر، پشتیبان‌گیری خودکار.
