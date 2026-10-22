"""BackPack tunnels (https://github.com/AminMGMT/BackPack) managed by the panel, kept apart from the panel's own tunnels.

The panel pins one release of the BackPack binary (version and SHA-256 below), serves it to the servers, and generates the TOML
of both ends from one form. Everything it creates on a server is prefixed `vpnp-bp-` / `/etc/vpn-panel`, so a BackPack the
admin installed by hand (`/etc/backpack`, `backpack-*.service`) is never touched.

Left out on purpose: the IP-spoofing and SNI-spoofing carriers of the direct tunnel."""
import re
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
# direct layer-4 tunnel (Iran dials out, the same forwarded ports): carriers
CARRIERS4 = {
    "tcp": ("TCP", "ساده و سریع؛ برای وقتی که خود ترافیک TLS است."),
    "stealth": ("TCP + Stealth", "رمزنگاری Noise بدون هدر قابل‌شناسایی (پیشنهادی)."),
    "ws": ("WebSocket", "می‌تواند پشت CDN باشد."),
    "wss": ("WebSocket + TLS", "WebSocket روی TLS."),
}
KINDS = ("reverse", "direct", "direct4")
NEEDS_RAW = {"pck", "xdi"}
MUX = {"tcpmux", "wsmux", "wssmux"}
KCP = {"kcp", "xdi"}

# Extra settings. key -> (type, low, high, kinds, sides); type: int | bool | host | addrs | enum:a|b|c.
# sides: "iran" (server / dialing end), "node" (client / listening end), "both" (the two ends must agree or it does not matter).
_R, _D, _D4 = "reverse", "direct", "direct4"
OPTIONS = {
    "nodelay": ("bool", 0, 0, (_R, _D4), "both"),
    "keepalive_period": ("int", 1, 600, (_R, _D4), "both"),
    "mss": ("int", 536, 1460, (_R, _D4), "both"),
    "zero_copy": ("bool", 0, 0, (_R,), "both"),
    "log_level": ("enum:trace|debug|info|warn|error", 0, 0, (_R,), "both"),
    "mux_session": ("int", 1, 32, (_R,), "both"),
    "mux_con": ("int", 1, 4096, (_R,), "iran"),
    "mux_version": ("int", 1, 2, (_R,), "both"),
    "max_connections": ("int", 0, 1000000, (_R, _D, _D4), "iran"),
    "bandwidth_mbps": ("int", 0, 100000, (_R, _D, _D4), "iran"),
    "proxy_protocol": ("bool", 0, 0, (_R,), "iran"),
    "heartbeat": ("int", 1, 120, (_R,), "iran"),
    "channel_size": ("int", 1, 65536, (_R,), "iran"),
    "edge_ip": ("host", 0, 0, (_R,), "node"),
    "fallback_addrs": ("addrs", 0, 8, (_R,), "node"),
    "load_balance": ("bool", 0, 0, (_R,), "node"),
    "health_failover": ("bool", 0, 0, (_R,), "node"),
    "connection_pool": ("int", 1, 512, (_R,), "node"),
    "aggressive_pool": ("bool", 0, 0, (_R,), "node"),
    "dial_timeout": ("int", 1, 120, (_R, _D4), "node"),
    "retry_interval": ("int", 1, 120, (_R, _D4), "node"),
    "kcp_nodelay": ("int", 0, 1, (_R,), "both"),
    "kcp_interval": ("int", 5, 200, (_R,), "both"),
    "kcp_resend": ("int", 0, 10, (_R,), "both"),
    "kcp_nocongestion": ("int", 0, 1, (_R,), "both"),
    "kcp_acknodelay": ("bool", 0, 0, (_R,), "both"),
    "kcp_sndwnd": ("int", 32, 8192, (_R,), "both"),
    "kcp_rcvwnd": ("int", 32, 8192, (_R,), "both"),
    "kcp_mtu": ("int", 576, 1500, (_R,), "both"),
    "qdisc": ("enum:fq_codel|fq|cake|pfifo_fast", 0, 0, (_D,), "both"),
    "txqueuelen": ("int", 10, 10000, (_D,), "both"),
    "mtu": ("int", 576, 1500, (_D,), "both"),
    "auto_mtu": ("bool", 0, 0, (_D,), "both"),
    "mss_clamp": ("int", 536, 1460, (_D,), "both"),
    "paths": ("int", 1, 16, (_D,), "both"),
    "sockbuf": ("int", 65536, 134217728, (_D,), "both"),
    "sessions": ("int", 1, 32, (_D4,), "iran"),
    "server_name": ("host", 0, 0, (_D4,), "iran"),
}
# a setting only some transports read
ONLY = {"mux_session": MUX, "mux_con": MUX, "mux_version": MUX, "edge_ip": {"ws", "wsmux", "wss", "wssmux"},
        "kcp_nodelay": KCP, "kcp_interval": KCP, "kcp_resend": KCP, "kcp_nocongestion": KCP, "kcp_acknodelay": KCP,
        "kcp_sndwnd": KCP, "kcp_rcvwnd": KCP, "kcp_mtu": KCP, "paths": {"udp"}, "server_name": {"ws", "wss"}}

# Named bundles of the settings above (the panel's own; BackPack only records the name as a label).
PRESETS = {
    "balance": ("Balance", "مصرف کم؛ سرور کوچک یا اشتراکی", {"nodelay": True, "keepalive_period": 20, "connection_pool": 8,
                "kcp_nodelay": 1, "kcp_interval": 10, "kcp_resend": 2, "kcp_nocongestion": 1, "kcp_acknodelay": True, "kcp_sndwnd": 512, "kcp_rcvwnd": 512,
                "qdisc": "fq_codel", "txqueuelen": 500}),
    "turbo": ("Turbo", "پیشنهادی برای اکثر مسیرها: پینگ کم و ثابت", {"nodelay": True, "keepalive_period": 15, "connection_pool": 16,
              "kcp_nodelay": 1, "kcp_interval": 10, "kcp_resend": 2, "kcp_nocongestion": 1, "kcp_acknodelay": True, "kcp_sndwnd": 1024, "kcp_rcvwnd": 1024,
              "qdisc": "fq_codel", "txqueuelen": 500}),
    "aggressive": ("Aggressive", "بازی و پینگ حساس؛ CPU و اتصال بیشتر", {"nodelay": True, "keepalive_period": 10, "connection_pool": 32, "aggressive_pool": True,
                   "kcp_nodelay": 1, "kcp_interval": 10, "kcp_resend": 2, "kcp_nocongestion": 1, "kcp_acknodelay": True, "kcp_sndwnd": 2048, "kcp_rcvwnd": 2048,
                   "qdisc": "fq_codel", "txqueuelen": 300}),
}
HOSTRE = re.compile(r"^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$|^[0-9a-fA-F:]+$")
ADDRRE = re.compile(r"^([A-Za-z0-9][A-Za-z0-9.-]{0,251}|\[[0-9a-fA-F:]+\]):[0-9]{1,5}$")


def option_applies(key: str, kind: str, transport: str) -> bool:
    spec = OPTIONS.get(key)
    return bool(spec) and kind in spec[3] and (key not in ONLY or transport in ONLY[key])


def clean_opts(kind: str, transport: str, raw, preset: str = "") -> dict:
    """Validate the extra settings of a tunnel (unknown keys, bad values: ValueError with a message for the admin). Settings that
    the chosen transport does not read are dropped, so changing the transport never leaves a setting that would be written for nothing."""
    if not raw:       # None, or the empty list the column migration leaves on old rows
        raw = {}
    if not isinstance(raw, dict):
        raise ValueError("تنظیمات پیشرفته نامعتبر است")
    out = {}
    for key, val in raw.items():
        spec = OPTIONS.get(key)
        if not spec:
            raise ValueError(f"تنظیم ناشناخته: {key}")
        if val is None or val == "" or val == [] or not option_applies(key, kind, transport):
            continue
        typ, lo, hi = spec[0], spec[1], spec[2]
        if typ == "bool":
            if not isinstance(val, bool):
                raise ValueError(f"{key} باید روشن/خاموش باشد")
            if val:
                out[key] = True
        elif typ == "int":
            if isinstance(val, bool) or not isinstance(val, int) or not lo <= val <= hi:
                raise ValueError(f"{key} باید عددی بین {lo} و {hi} باشد")
            if val or lo == 0:
                out[key] = val
        elif typ == "host":
            if not isinstance(val, str) or not HOSTRE.match(val.strip()):
                raise ValueError(f"{key}: آدرس نامعتبر")
            out[key] = val.strip()
        elif typ == "addrs":
            items = val if isinstance(val, list) else re.split(r"[\s,]+", str(val).strip())
            items = [str(i).strip() for i in items if str(i).strip()]
            if len(items) > hi or any(not ADDRRE.match(i) or not 0 < int(i.rsplit(":", 1)[1]) < 65536 for i in items):
                raise ValueError("آدرس‌های جایگزین را به شکل host:port بدهید (حداکثر %d تا)" % hi)
            out[key] = items
        else:
            allowed = typ.split(":", 1)[1].split("|")
            if val not in allowed:
                raise ValueError(f"{key} باید یکی از {', '.join(allowed)} باشد")
            out[key] = val
    if preset and preset not in PRESETS:
        raise ValueError("پریست نامعتبر است")
    if "load_balance" in out and "health_failover" in out:
        raise ValueError("توزیع بار و تعویض هوشمند آدرس را با هم نمی‌شود روشن کرد")
    if ("load_balance" in out or "health_failover" in out) and "fallback_addrs" not in out:
        raise ValueError("توزیع بار و تعویض هوشمند به حداقل یک آدرس جایگزین (fallback) نیاز دارند")
    return out


def preset_opts(kind: str, transport: str, name: str) -> dict:
    """What a preset sets on this kind/transport."""
    return {k: v for k, v in PRESETS[name][2].items() if option_applies(k, kind, transport)}


def _opt_lines(t, side: str) -> list[str]:
    """TOML lines for the extra settings that belong to this end."""
    opts = clean_opts(t.kind, t.transport, getattr(t, "opts", None) or {})
    preset = getattr(t, "preset", "") or ""
    out = [f'preset = "{preset}"'] if preset in PRESETS else []
    me = "iran" if side == "iran" else "node"
    for key, val in opts.items():
        if OPTIONS[key][4] not in ("both", me):
            continue
        out.append(f"{key} = {_toml(val)}")
    return out


def _toml(v) -> str:
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return str(v)
    if isinstance(v, list):
        return _arr(v)
    return '"' + str(v).replace('"', "") + '"'


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
        return "\n".join(lines + _opt_lines(t, side)) + "\n"
    if t.kind == "direct4":
        lines = ["[direct]", f'role = "{"iran" if side == "iran" else "kharej"}"', f'transport = "{t.transport}"', f'token = "{t.token}"',
                 f'addr = "{node_host}:{t.port}"' if side == "iran" else f'addr = "0.0.0.0:{t.port}"']
        if side == "iran":
            lines += [f"ports = {_arr(maps)}", f"accept_udp = {'true' if udp else 'false'}"]
        return "\n".join(lines + _opt_lines(t, side)) + "\n"
    common = [f'transport = "{t.transport}"', f'token = "{t.token}"']
    if t.fallbacks:
        common.append(f"fallback_transports = {_arr(t.fallbacks)}")
    if t.transport == "kcp" and fec:
        common += [f"kcp_datashards = {fec[0]}", f"kcp_parityshards = {fec[1]}"]
    if side == "iran":
        return "\n".join(["[server]", f'bind_addr = "0.0.0.0:{t.port}"', *common, f"ports = {_arr(maps)}",
                          f"accept_udp = {'true' if udp else 'false'}", *_opt_lines(t, side)]) + "\n"
    return "\n".join(["[client]", f'remote_addr = "{iran_host}:{t.port}"', *common, *_opt_lines(t, side)]) + "\n"


def describe(t) -> str:
    if t.kind == "direct":
        return f"Direct · {CARRIERS.get(t.transport, (t.transport,))[0]}"
    if t.kind == "direct4":
        return f"Direct L4 · {CARRIERS4.get(t.transport, (t.transport,))[0]}"
    return TRANSPORTS.get(t.transport, (t.transport,))[0]
