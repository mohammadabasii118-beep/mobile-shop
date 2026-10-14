# پنل چندلوکیشن (VPN panel)

پنل مدیریت مشابه مرزبان/سنایی با چند نود (لوکیشن)، کاربر با حجم و انقضا، و لینک اشتراک واحد.

**پروتکل‌ها (۱۴ مورد):**
- Xray: VLESS+Reality، VLESS+WebSocket، VLESS+gRPC، VMess+WebSocket، Trojan، Trojan+WebSocket، Shadowsocks 2022
- sing-box: Hysteria2، TUIC v5
- سیستمی: WireGuard، OpenVPN، L2TP/IPsec، IKEv2/IPsec (strongSwan)، Cisco AnyConnect (ocserv)
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
4. در فایروال سرویس‌دهنده این پورت‌ها را باز کنید:
   - TCP: 443، 2053، 2083، 2087، 2096، 8443، 8388، 4443
   - UDP: 8388، 36712، 8444، 51820، 1194، 4443، 500، 4500، 1701
5. حدود یک دقیقه بعد نود «آنلاین» می‌شود. از آن پس هر تغییر کاربر یا پروتکل ظرف ۳۰ ثانیه روی نود اعمال می‌شود.

نود فقط به پنل وصل می‌شود (خروجی HTTPS)؛ پورتی برای پنل روی نود باز نیست. کلید خصوصی Reality هیچ‌وقت از نود خارج نمی‌شود.

## محدودیت‌های فعلی
- **این نسخه روی سرور واقعی تست نشده.** پنل، API، لینک‌ها و تولید کانفیگ‌ها تست خودکار دارند (`pytest tests`)، ولی نصب‌کننده و راه‌اندازی Xray، sing-box و strongSwan باید روی یک سرور واقعی امتحان شود. اولین نود را حتماً جداگانه تست کنید.
- شمارش مصرف فقط برای Xray (VLESS، VMess، Trojan، Shadowsocks) و WireGuard انجام می‌شود. بقیه (Hysteria2، TUIC، OpenVPN، L2TP، IKEv2، AnyConnect) مصرف گزارش نمی‌کنند، پس سقف حجم برای آن‌ها اعمال نمی‌شود. انقضا و غیرفعال‌سازی برای همه اعمال می‌شود.
- پروتکل‌های TLS (Trojan، WS، gRPC، Hysteria2، TUIC، IKEv2، AnyConnect) با گواهی خودامضا نصب می‌شوند و لینک‌ها `insecure` هستند. برای گواهی واقعی، فایل‌های `/etc/vpn-node/tls.crt` و `tls.key` را عوض کنید و در `agent.json` مقدار `tls_self_signed` را `false` کنید.
- تغییر کاربران Xray با ری‌استارت سرویس اعمال می‌شود و اتصال‌های جاری لحظه‌ای قطع می‌شوند.
- L2TP در شبکه‌هایی که پروتکل‌های قدیمی IPsec را فیلتر می‌کنند ممکن است کار نکند.
- IKEv2 در iOS و ویندوز گواهی معتبر با همان دامنه می‌خواهد. با گواهی خودامضا باید CA را روی دستگاه نصب کنید، پس برای IKEv2 دامنه و گواهی واقعی بگذارید.
- هنوز نیست: SSTP (نیاز به ساخت accel-ppp از سورس)، چند مدیر، پشتیبان‌گیری خودکار. پایگاه داده مهاجرت خودکار ندارد؛ نسخه‌ی قبلی این پروژه را جایی نصب نکرده‌اید، ولی از این به بعد تغییر ساختار جدول‌ها مهاجرت لازم دارد.
