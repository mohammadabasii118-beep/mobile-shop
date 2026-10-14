"""Protocols the panel can manage. Add an entry here (plus a renderer in
agent/agent.py and a link builder in subscription.py) to support a new one."""

REALITY_SNI = "www.microsoft.com"
SS_METHOD = "2022-blake3-aes-128-gcm"

PROTOCOLS = {
    "vless": {"label": "VLESS + Reality", "engine": "xray", "port": 443, "uri": True,
              "desc": "پیشنهادی؛ بدون نیاز به دامنه و گواهی"},
    "trojan": {"label": "Trojan", "engine": "xray", "port": 8443, "uri": True,
               "desc": "TLS؛ با گواهی خودامضا یا واقعی"},
    "ss": {"label": "Shadowsocks 2022", "engine": "xray", "port": 8388, "uri": True,
           "desc": "سبک و سریع"},
    "hy2": {"label": "Hysteria2", "engine": "sing-box", "port": 36712, "uri": True,
            "desc": "مبتنی بر QUIC برای خطوط ضعیف"},
    "l2tp": {"label": "L2TP/IPsec", "engine": "strongSwan + xl2tpd", "port": 1701, "uri": False,
             "desc": "داخلی در iOS، اندروید و ویندوز؛ ورود دستی"},
}
