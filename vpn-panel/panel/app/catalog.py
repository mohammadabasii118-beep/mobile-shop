"""Protocols the panel can manage. Adding one means: a row here, a renderer in
agent/agent.py, a link builder in subscription.py, and install steps in agent/install.sh."""

REALITY_SNI = "www.microsoft.com"
SS_METHOD = "2022-blake3-aes-128-gcm"
WS_PATHS = {"vmess_ws": "/ws", "vless_ws": "/vless", "trojan_ws": "/trojan"}
GRPC_SERVICE = "grpc"
OVPN_PORT_PROTO = "udp"


def _p(label, engine, port, desc, uri=True):
    return {"label": label, "engine": engine, "port": port, "desc": desc, "uri": uri}


PROTOCOLS = {
    "vless": _p("VLESS + Reality", "xray", 443, "پیشنهادی؛ بدون نیاز به دامنه و گواهی"),
    "vless_ws": _p("VLESS + WebSocket (TLS)", "xray", 2083, "WS روی TLS"),
    "vless_grpc": _p("VLESS + gRPC (TLS)", "xray", 2096, "gRPC روی TLS"),
    "vmess_ws": _p("VMess + WebSocket (TLS)", "xray", 2053, "سازگار با اغلب کلاینت‌ها"),
    "trojan": _p("Trojan", "xray", 8443, "TLS؛ با گواهی خودامضا یا واقعی"),
    "trojan_ws": _p("Trojan + WebSocket (TLS)", "xray", 2087, "WS روی TLS"),
    "ss": _p("Shadowsocks 2022", "xray", 8388, "سبک و سریع"),
    "hy2": _p("Hysteria2", "sing-box", 36712, "مبتنی بر QUIC برای خطوط ضعیف"),
    "tuic": _p("TUIC v5", "sing-box", 8444, "QUIC با تأخیر کم"),
    "wg": _p("WireGuard", "wireguard", 51820, "VPN سطح سیستم؛ کانفیگ فایل", uri=False),
    "ovpn": _p("OpenVPN", "openvpn", 1194, "UDP؛ فایل ovpn با نام کاربری و رمز", uri=False),
    "l2tp": _p("L2TP/IPsec", "strongSwan + xl2tpd", 1701, "داخلی در iOS، اندروید و ویندوز", uri=False),
    "ikev2": _p("IKEv2/IPsec", "strongSwan", 500, "پایدار روی موبایل؛ نیاز به گواهی معتبر", uri=False),
    "anyc": _p("Cisco AnyConnect", "ocserv", 4443, "سازگار با کلاینت‌های AnyConnect/OpenConnect", uri=False),
}
