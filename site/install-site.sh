#!/usr/bin/env bash
# نصب سایت نمادین PCL روی nginx + گواهی SSL
# مثال: bash site/install-site.sh --domain pclproclubss.ir --email you@example.com [--phone 0912...]
set -e
DOMAIN=pclproclubss.ir; EMAIL=""; PHONE=""; MAIL=""
while [ $# -gt 0 ]; do case "$1" in
  --domain) DOMAIN="$2"; shift 2;; --email) EMAIL="$2"; shift 2;;
  --phone) PHONE="$2"; shift 2;; --contact-mail) MAIL="$2"; shift 2;; *) shift;; esac; done
SRC="$(cd "$(dirname "$0")" && pwd)"; ROOT=/var/www/pcl-site
mkdir -p "$ROOT"; cp -r "$SRC"/{*.html,style.css,fonts} "$ROOT"/
EXTRA=""
[ -n "$PHONE" ] && EXTRA="$EXTRA<li>تلفن: <span dir=\"ltr\">$PHONE</span></li>"
[ -n "$MAIL" ] && EXTRA="$EXTRA<li>ایمیل: <span dir=\"ltr\">$MAIL</span></li>"
python3 - "$ROOT/contact.html" "$EXTRA" <<'PY'
import sys;p,e=sys.argv[1:];s=open(p,encoding='utf-8').read().replace('<!--CONTACT-->',e);open(p,'w',encoding='utf-8').write(s)
PY
cat > /etc/nginx/sites-available/pcl-site <<NG
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    root $ROOT;
    index index.html;
    location / { try_files \$uri \$uri/ =404; }
}
NG
ln -sf /etc/nginx/sites-available/pcl-site /etc/nginx/sites-enabled/pcl-site
nginx -t && systemctl reload nginx
CB=(--nginx --non-interactive --agree-tos --redirect)
[ -n "$EMAIL" ] && CB+=(-m "$EMAIL") || CB+=(--register-unsafely-without-email)
certbot "${CB[@]}" -d "$DOMAIN" -d "www.$DOMAIN" || certbot "${CB[@]}" -d "$DOMAIN" || echo "⚠️ SSL نصب نشد؛ سایت روی http فعال است"
echo "✅ سایت فعال شد: https://$DOMAIN"
