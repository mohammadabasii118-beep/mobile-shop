"""Protocols the panel can manage. Adding one means: a row here, a renderer in
agent/agent.py, a link builder in subscription.py, and install steps in agent/install.sh."""

# Reality camouflage default. www.microsoft.com sends a ~9 KB certificate chain and its handshake did not complete
# on a real node; www.apple.com (2 certificates, ~5.5 KB) did. Every node can override it in the panel.
REALITY_SNI = "www.apple.com"
SS_METHOD = "2022-blake3-aes-128-gcm"
WS_PATHS = {"vmess_ws": "/ws", "vless_ws": "/vless", "trojan_ws": "/trojan"}
GRPC_SERVICE = "grpc"
OVPN_PORT_PROTO = "udp"


def _p(label, engine, port, desc, uri=True, fixed=False, counted=True):
    # fixed: the protocol standard dictates the port (IPsec), clients cannot use another
    return {"label": label, "engine": engine, "port": port, "desc": desc, "uri": uri, "fixed_port": fixed,
            "counted": counted}  # counted: traffic is added to the user's shared quota


PROTOCOLS = {
    "vless": _p("VLESS + Reality", "xray", 443, "پیشنهادی؛ بدون نیاز به دامنه و گواهی"),
    "vless_tcp": _p("VLESS + TCP (TLS)", "xray", 2097, "TCP ساده روی TLS"),
    "vless_raw": _p("VLESS + TCP (بدون TLS)", "xray", 80, "مثل اینباند ساده x-ui؛ بدون رمزنگاری، مناسب پشت تونل"),
    "vless_ws": _p("VLESS + WebSocket (TLS)", "xray", 2083, "WS روی TLS"),
    "vless_grpc": _p("VLESS + gRPC (TLS)", "xray", 2096, "gRPC روی TLS"),
    "vmess_ws": _p("VMess + WebSocket (TLS)", "xray", 2053, "سازگار با اغلب کلاینت‌ها"),
    "vmess_tcp": _p("VMess + TCP (TLS)", "xray", 2098, "TCP ساده روی TLS"),
    "trojan": _p("Trojan", "xray", 8443, "TLS؛ با گواهی خودامضا یا واقعی"),
    "trojan_ws": _p("Trojan + WebSocket (TLS)", "xray", 2087, "WS روی TLS"),
    "ss": _p("Shadowsocks 2022", "xray", 8388, "سبک و سریع"),
    "hy2": _p("Hysteria2", "sing-box", 36712, "مبتنی بر QUIC برای خطوط ضعیف", counted=False),
    "tuic": _p("TUIC v5", "sing-box", 8444, "QUIC با تأخیر کم", counted=False),
    "wg": _p("WireGuard", "wireguard", 51820, "VPN سطح سیستم؛ کانفیگ فایل", uri=False),
    "ovpn": _p("OpenVPN", "openvpn", 1194, "UDP؛ فایل ovpn با نام کاربری و رمز", uri=False),
    "l2tp": _p("L2TP/IPsec", "strongSwan + xl2tpd", 1701, "داخلی در iOS، اندروید و ویندوز", uri=False, fixed=True),
    "ikev2": _p("IKEv2/IPsec", "strongSwan", 500, "پایدار روی موبایل؛ نیاز به گواهی معتبر", uri=False, fixed=True, counted=False),
    "dnstt": _p("DNSTT (تونل DNS)", "dnstt-server", 5300, "خیلی کند؛ فقط وقتی همه‌چیز بسته است و DNS کار می‌کند", uri=False),
    "anyc": _p("Cisco AnyConnect", "ocserv", 4443, "سازگار با کلاینت‌های AnyConnect/OpenConnect", uri=False),
}

# Cloudflare proxies only these HTTPS ports, and only WebSocket/gRPC style traffic.
CF_PORTS = {443, 2053, 2083, 2087, 2096, 8443}
CF_PROTOS = ("vless_ws", "vmess_ws", "trojan_ws", "vless_grpc")
