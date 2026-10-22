"""BackPack tunnels (https://github.com/AminMGMT/BackPack) managed by the panel, kept apart from the panel's own tunnels.

The panel pins one release of the BackPack binary (version and SHA-256 below), serves it to the servers, and generates the TOML
of both ends from one form. Everything it creates on a server is prefixed `vpnp-bp-` / `/etc/vpn-panel`, so a BackPack the
admin installed by hand (`/etc/backpack`, `backpack-*.service`) is never touched.

Left out on purpose: the IP-spoofing and SNI-spoofing carriers of the direct tunnel."""
import secrets

BP_VERSION = "v1.8.5"
BP_SHA256 = {"amd64": "e80c4da9bdcece9e7a82305e572fdfde9a395a68a985fdd835c1af8ff248b395",
             "arm64": "9d9eaa951f8bd3f7b786be94916517c4ec900af0eeaac893b89d03d9867643f4"}
BP_URL = "https://github.com/AminMGMT/BackPack/releases/download/{version}/backpack_linux_{arch}.tar.gz"

# reverse tunnel transports: id -> (label, family, description)
TRANSPORTS = {
    "tcp": ("TCP", "tcp", "ساده و سریع؛ توکن بدون رمزنگاری رد می‌شود. برای مسیر بدون مزاحمت."),
    "tcpmux": ("TCP Mux", "tcp", "چند اتصال داخل چند جلسه؛ تعداد اتصال کمتر."),
    "stealth": ("TCP + Stealth", "tcp", "رمزنگاری Noise بدون هیچ هدر قابل‌شناسایی؛ برای مسیر فیلترشده (پیشنهادی)."),
    "pck": ("TCP + PCK", "tcp", "بسته‌های TCP خام؛ فقط لینوکس و root."),
    "udp": ("UDP", "udp", "فقط برای فوروارد پورت UDP؛ بدون رمزنگاری و بدون تضمین رسیدن."),
    "kcp": ("UDP + KCP + FEC", "udp", "UDP مقاوم در برابر گم‌شدن بسته (برای خط ضعیف و بازی)."),
    "quic": ("UDP + QUIC", "udp", "QUIC با TLS 1.3؛ برای تست."),
    "ws": ("WebSocket", "ws", "می‌تواند پشت CDN باشد؛ بدون رمزنگاری."),
    "wsmux": ("WebSocket Mux", "ws", "WebSocket با چندجلسه‌ای."),
    "wss": ("WebSocket + TLS", "ws", "WebSocket روی TLS (گواهی خودامضا؛ توکن احراز می‌کند)."),
    "wssmux": ("WebSocket + TLS Mux", "ws", "WSS با چندجلسه‌ای."),
    "xdi": ("xDi (ICMP)", "icmp", "تونل داخل بسته‌های ping؛ آزمایشی و آخرین راه. فقط لینوکس و root."),
}
# direct (layer-3, a private network between the two servers) carriers
CARRIERS = {
    "udp": ("UDP", "ساده‌ترین؛ برای مسیر بدون مزاحمت."),
    "quic": ("QUIC", "شبیه ترافیک HTTP/3."),
    "pck": ("PCK", "بسته‌های TCP خام؛ فقط لینوکس و root."),
    "xdi": ("xDi (ICMP)", "داخل ping؛ آزمایشی."),
}
KINDS = ("reverse", "direct")
NEEDS_RAW = {"pck", "xdi"}


def new_token() -> str:
    return secrets.token_urlsafe(36)


def port_maps(forwards: list[dict]) -> list[str]:
    """[{"listen": 80, "target": 80}, ...] -> BackPack port mappings ("80", "81=80")."""
    seen, out = set(), []
    for f in forwards:
        key = (f["listen"], f["target"])
        if key not in seen:
            seen.add(key)
            out.append(str(f["listen"]) if f["listen"] == f["target"] else f"{f['listen']}={f['target']}")
    return out


def _arr(items) -> str:
    return "[" + ", ".join('"' + str(i).replace('"', "") + '"' for i in items) + "]"


def net_addrs(n: int) -> tuple[str, str]:
    """The /30 of a direct tunnel: (Iran side, foreign side)."""
    return f"10.20.{n}.1", f"10.20.{n}.2"


def render(t, side: str, iran_host: str, node_host: str) -> str:
    """TOML for one end. side = "iran" | "node". `t` is a BpTunnel (or anything with the same fields)."""
    maps = port_maps(t.forwards)
    udp = bool(t.accept_udp or t.transport == "udp")      # the plain UDP transport only makes sense with UDP ports
    fec = (t.fec_data, t.fec_parity) if t.fec_data and t.fec_parity else None
    if t.kind == "direct":
        iran_ip, node_ip = net_addrs(t.net_n)
        mine, peer = (iran_ip, node_ip) if side == "iran" else (node_ip, iran_ip)
        lines = ["[l3]", f'mode = "{"dial" if side == "iran" else "listen"}"', f'carrier = "{t.transport}"',
                 f'addr = "{node_host}:{t.port}"' if side == "iran" else f'addr = "0.0.0.0:{t.port}"',
                 f'token = "{t.token}"', f'iface = "pn{t.id}"', f'local_ip = "{mine}/30"', f'peer_ip = "{peer}"']
        if side == "iran":
            lines += [f"ports = {_arr(maps)}", f"accept_udp = {'true' if udp else 'false'}"]
        if fec:
            lines += [f"fec_data = {fec[0]}", f"fec_parity = {fec[1]}"]
        return "\n".join(lines) + "\n"
    common = [f'transport = "{t.transport}"', f'token = "{t.token}"']
    if t.fallbacks:
        common.append(f"fallback_transports = {_arr(t.fallbacks)}")
    if t.transport == "kcp" and fec:
        common += [f"kcp_datashards = {fec[0]}", f"kcp_parityshards = {fec[1]}"]
    if side == "iran":
        return "\n".join(["[server]", f'bind_addr = "0.0.0.0:{t.port}"', *common, f"ports = {_arr(maps)}",
                          f"accept_udp = {'true' if udp else 'false'}"]) + "\n"
    return "\n".join(["[client]", f'remote_addr = "{iran_host}:{t.port}"', *common]) + "\n"


def describe(t) -> str:
    if t.kind == "direct":
        return f"Direct · {CARRIERS.get(t.transport, (t.transport,))[0]}"
    return TRANSPORTS.get(t.transport, (t.transport,))[0]
