import base64
import hashlib
import json
from urllib.parse import quote

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey

from .catalog import GRPC_SERVICE, PROTOCOLS, REALITY_SNI, SS_METHOD, WS_PATHS
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


def _tls_q(host: str, insecure: bool) -> str:
    return f"security=tls&sni={host}" + ("&allowInsecure=1" if insecure else "")


def _manual(entry: dict, fields: dict, text: str | None = None) -> dict:
    entry["details"] = fields
    entry["summary"] = " | ".join(str(v) for v in fields.values() if "\n" not in str(v))
    entry["copy"] = text or "\n".join(f"{k}: {v}" for k, v in fields.items())
    return entry


def build_entry(user: User, node: Node, proto: str, port: int) -> dict | None:
    """One config entry for (user, node, proto). `link` is a share URI. Protocols entered by
    hand or imported from a file have link=None and carry `summary` (one line) and `copy` (full text)."""
    meta = PROTOCOLS[proto]
    tag = quote(f"{node.name}-{meta['label']}")
    host, insecure = node.address, node.tls_self_signed
    e = {"node": node.name, "cc": node.cc, "proto": proto, "label": meta["label"],
         "link": None, "details": None, "summary": None, "copy": None}
    tls = _tls_q(host, insecure)
    if proto == "vless":
        if not node.reality_pub:
            return None
        e["link"] = (f"vless://{user.uuid}@{host}:{port}?encryption=none&security=reality&sni={REALITY_SNI}"
                     f"&fp=chrome&pbk={node.reality_pub}&sid={node.reality_sid}&type=tcp&flow=xtls-rprx-vision#{tag}")
    elif proto == "vless_ws":
        path = quote(WS_PATHS[proto], safe="")
        e["link"] = f"vless://{user.uuid}@{host}:{port}?encryption=none&{tls}&type=ws&host={host}&path={path}#{tag}"
    elif proto == "vless_grpc":
        e["link"] = (f"vless://{user.uuid}@{host}:{port}?encryption=none&{tls}&type=grpc"
                     f"&serviceName={GRPC_SERVICE}&mode=gun#{tag}")
    elif proto == "vmess_ws":
        cfg = {"v": "2", "ps": f"{node.name}-{meta['label']}", "add": host, "port": str(port), "id": user.uuid,
               "aid": "0", "scy": "auto", "net": "ws", "type": "none", "host": host, "path": WS_PATHS[proto],
               "tls": "tls", "sni": host, "allowInsecure": 1 if insecure else 0}
        e["link"] = "vmess://" + base64.b64encode(json.dumps(cfg).encode()).decode()
    elif proto == "trojan":
        e["link"] = f"trojan://{quote(user.password)}@{host}:{port}?{tls}#{tag}"
    elif proto == "trojan_ws":
        path = quote(WS_PATHS[proto], safe="")
        e["link"] = f"trojan://{quote(user.password)}@{host}:{port}?{tls}&type=ws&host={host}&path={path}#{tag}"
    elif proto == "ss":
        cred = _b64url(f"{SS_METHOD}:{node.ss_key}:{user_ss_key(user.uuid)}")
        e["link"] = f"ss://{cred}@{host}:{port}#{tag}"
    elif proto == "hy2":
        e["link"] = (f"hysteria2://{quote(user.password)}@{host}:{port}?sni={host}"
                     f"{'&insecure=1' if insecure else ''}#{tag}")
    elif proto == "tuic":
        e["link"] = (f"tuic://{user.uuid}:{quote(user.password)}@{host}:{port}?congestion_control=bbr"
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
    return out


def subscription_body(entries: list[dict]) -> str:
    links = [e["link"] for e in entries if e["link"]]
    return base64.b64encode("\n".join(links).encode()).decode()
