import base64
import hashlib
import json
from urllib.parse import quote

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey

from .catalog import CF_PORTS, CF_PROTOS, GRPC_SERVICE, PROTOCOLS, REALITY_SNI, SS_METHOD, WS_PATHS
from .db import Node, User


def user_ss_key(user_uuid: str) -> str:
    """16-byte base64 key for Shadowsocks 2022, derived from the user's uuid."""
    return base64.b64encode(hashlib.sha256((user_uuid + "ss").encode()).digest()[:16]).decode()


def new_wg_keypair() -> tuple[str, str]:
    key = X25519PrivateKey.generate()
    raw = serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption()
    priv = key.private_bytes(*raw)
    pub = key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    return base64.b64encode(priv).decode(), base64.b64encode(pub).decode()


def wg_ip(user_id: int) -> str:
    """Stable tunnel address per user, the same on every node (10.88.0.0/16)."""
    n = user_id + 1
    return f"10.88.{n // 250}.{n % 250 + 1}"


def _b64url(s: str) -> str:
    return base64.urlsafe_b64encode(s.encode()).decode().rstrip("=")


def _tls_q(host: str, insecure: bool, pin: str = "") -> str:
    """TLS query. Xray removed allowInsecure, so a self-signed node is trusted by pinning its certificate
    (`pcs`); allowInsecure/insecure stay for clients on other cores."""
    return (f"security=tls&sni={host}" + ("&allowInsecure=1&insecure=1" if insecure else "")
            + (f"&pcs={pin}" if insecure and pin else ""))


def _manual(entry: dict, fields: dict, text: str | None = None) -> dict:
    entry["details"] = fields
    entry["summary"] = " | ".join(str(v) for v in fields.values() if "\n" not in str(v))
    entry["copy"] = text or "\n".join(f"{k}: {v}" for k, v in fields.items())
    return entry


def build_entry(user: User, node: Node, proto: str, port: int, cdn: bool = False) -> dict | None:
    """One config entry for (user, node, proto). `link` is a share URI. Protocols entered by
    hand or imported from a file have link=None and carry `summary` (one line) and `copy` (full text)."""
    meta = PROTOCOLS[proto]
    label = meta["label"] + (" · Cloudflare" if cdn else "")
    tag = quote(f"{node.name}-{label}")
    if cdn:  # connect to the CDN (or a clean IP); the domain is the TLS name and Host header
        conn, host, insecure = node.cf_address or node.cf_domain, node.cf_domain, False
    else:
        conn = host = node.address
        insecure = node.tls_self_signed
    e = {"node": node.name, "cc": node.cc, "proto": proto, "label": label,
         "link": None, "details": None, "summary": None, "copy": None}
    tls = _tls_q(host, insecure, node.tls_pin)
    if proto == "vless":
        if not node.reality_pub:
            return None
        e["link"] = (f"vless://{user.uuid}@{conn}:{port}?encryption=none&security=reality&sni={node.reality_sni or REALITY_SNI}"
                     f"&fp=chrome&pbk={node.reality_pub}&sid={node.reality_sid}&type=tcp&flow=xtls-rprx-vision#{tag}")
    elif proto == "vless_tcp":
        e["link"] = f"vless://{user.uuid}@{conn}:{port}?encryption=none&{tls}&type=tcp#{tag}"
    elif proto == "vless_ws":
        path = quote(WS_PATHS[proto], safe="")
        e["link"] = f"vless://{user.uuid}@{conn}:{port}?encryption=none&{tls}&type=ws&host={host}&path={path}#{tag}"
    elif proto == "vless_grpc":
        e["link"] = (f"vless://{user.uuid}@{conn}:{port}?encryption=none&{tls}&type=grpc"
                     f"&serviceName={GRPC_SERVICE}&mode=gun#{tag}")
    elif proto in ("vmess_ws", "vmess_tcp"):
        ws = proto == "vmess_ws"
        cfg = {"v": "2", "ps": f"{node.name}-{label}", "add": conn, "port": str(port), "id": user.uuid,
               "aid": "0", "scy": "auto", "net": "ws" if ws else "tcp", "type": "none", "host": host if ws else "",
               "path": WS_PATHS[proto] if ws else "", "tls": "tls", "sni": host,
               "allowInsecure": 1 if insecure else 0, "insecure": "1" if insecure else "0",
               "pcs": node.tls_pin if insecure else ""}
        e["link"] = "vmess://" + base64.b64encode(json.dumps(cfg).encode()).decode()
    elif proto == "trojan":
        e["link"] = f"trojan://{quote(user.password)}@{conn}:{port}?{tls}#{tag}"
    elif proto == "trojan_ws":
        path = quote(WS_PATHS[proto], safe="")
        e["link"] = f"trojan://{quote(user.password)}@{conn}:{port}?{tls}&type=ws&host={host}&path={path}#{tag}"
    elif proto == "ss":
        cred = _b64url(f"{SS_METHOD}:{node.ss_key}:{user_ss_key(user.uuid)}")
        e["link"] = f"ss://{cred}@{conn}:{port}#{tag}"
    elif proto == "hy2":
        e["link"] = (f"hysteria2://{quote(user.password)}@{conn}:{port}?sni={host}"
                     f"{'&insecure=1' if insecure else ''}#{tag}")
    elif proto == "tuic":
        e["link"] = (f"tuic://{user.uuid}:{quote(user.password)}@{conn}:{port}?congestion_control=bbr"
                     f"&udp_relay_mode=native&alpn=h3&sni={host}{'&allow_insecure=1' if insecure else ''}#{tag}")
    elif proto == "wg":
        if not node.wg_pub:
            return None
        text = (f"[Interface]\nPrivateKey = {user.wg_private}\nAddress = {wg_ip(user.id)}/32\nDNS = 1.1.1.1\n\n"
                f"[Peer]\nPublicKey = {node.wg_pub}\nEndpoint = {host}:{port}\nAllowedIPs = 0.0.0.0/0\n"
                f"PersistentKeepalive = 25\n")
        _manual(e, {"server": f"{host}:{port}", "address": wg_ip(user.id), "config": text}, text)
        e["summary"] = f"فایل کانفیگ WireGuard ({host}:{port}) را در اپ وارد کنید"
    elif proto == "ovpn":
        if not node.ovpn_ca:
            return None
        text = (f"client\ndev tun\nproto udp\nremote {host} {port}\nresolv-retry infinite\nnobind\n"
                f"persist-key\npersist-tun\nremote-cert-tls server\nauth-user-pass\ncipher AES-256-GCM\n"
                f"verb 3\n<ca>\n{node.ovpn_ca.strip()}\n</ca>\n")
        _manual(e, {"server": f"{host}:{port}", "username": user.name, "password": user.password, "config": text}, text)
        e["summary"] = f"فایل ovpn؛ کاربر {user.name} | رمز {user.password}"
        e["copy"] = f"# username: {user.name}\n# password: {user.password}\n" + text
    elif proto == "l2tp":
        _manual(e, {"server": host, "username": user.name, "password": user.password, "psk": node.l2tp_psk})
        e["copy"] = f"Server: {host}\nUsername: {user.name}\nPassword: {user.password}\nPSK: {node.l2tp_psk}"
        e["summary"] = f"{host} | {user.name} | {user.password} | PSK: {node.l2tp_psk}"
    elif proto == "ikev2":
        _manual(e, {"server": host, "remote_id": host, "username": user.name, "password": user.password})
        e["summary"] = f"{host} | {user.name} | {user.password}" + (" | گواهی خودامضا: ابتدا CA را نصب کنید" if insecure else "")
    elif proto == "anyc":
        _manual(e, {"server": f"{host}:{port}", "username": user.name, "password": user.password})
        e["summary"] = f"{host}:{port} | {user.name} | {user.password}"
    return e


def user_entries(user: User, nodes: list[Node]) -> list[dict]:
    out = []
    for node in nodes:
        if user.node_ids and node.id not in user.node_ids:
            continue
        for np in node.protocols:
            if np.enabled and np.proto in user.protos:
                e = build_entry(user, node, np.proto, np.port)
                if e:
                    out.append(e)
                if node.cf_domain and np.proto in CF_PROTOS and np.port in CF_PORTS:
                    out.append(build_entry(user, node, np.proto, np.port, cdn=True))
    return out


def subscription_body(entries: list[dict]) -> str:
    links = [e["link"] for e in entries if e["link"]]
    return base64.b64encode("\n".join(links).encode()).decode()


GB = 1024 ** 3
_INFO_URI = "vless://00000000-0000-0000-0000-000000000000@127.0.0.1:1?encryption=none&security=none&type=tcp#"


def usage_lines(user: User, days_left: int | None) -> list[str]:
    """Human readable usage and time, shown as remarks in clients that ignore the usage header."""
    quota = f"{user.quota_bytes / GB:.2f}" if user.quota_bytes else "∞"
    used = f"{user.used_bytes / GB:.2f}"
    left = ("∞" if not user.quota_bytes else f"{max(0, user.quota_bytes - user.used_bytes) / GB:.2f}")
    time_line = "بدون انقضا" if days_left is None else (f"{days_left} روز مانده" if days_left > 0 else "منقضی شده")
    status = {"active": None, "disabled": "غیرفعال", "expired": "منقضی شده", "quota": "حجم تمام شده"}[user.status()]
    lines = [f"📊 مصرف {used} از {quota} GB", f"📦 باقی‌مانده {left} GB", f"⏳ {time_line}"]
    return ([f"⛔ {status}"] if status else []) + lines


def info_entries(user: User, days_left: int | None) -> list[str]:
    return [_INFO_URI + quote(line) for line in usage_lines(user, days_left)]
