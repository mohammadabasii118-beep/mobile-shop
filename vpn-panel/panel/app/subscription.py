import base64
from urllib.parse import quote

from .catalog import PROTOCOLS, REALITY_SNI, SS_METHOD
from .db import Node, User


def user_ss_key(user_uuid: str) -> str:
    """16-byte base64 key for Shadowsocks 2022, derived from the user's uuid."""
    import hashlib
    return base64.b64encode(hashlib.sha256((user_uuid + "ss").encode()).digest()[:16]).decode()


def _b64url(s: str) -> str:
    return base64.urlsafe_b64encode(s.encode()).decode().rstrip("=")


def build_entry(user: User, node: Node, proto: str, port: int) -> dict | None:
    """One config entry for (user, node, proto). `link` is a share URI, or None
    for protocols (L2TP) that are entered by hand; `details` then holds the fields."""
    meta = PROTOCOLS[proto]
    tag = quote(f"{node.name}-{meta['label']}")
    host, insecure = node.address, node.tls_self_signed
    entry = {"node": node.name, "cc": node.cc, "proto": proto, "label": meta["label"],
             "link": None, "details": None}
    if proto == "vless":
        if not node.reality_pub:
            return None  # node has not reported its Reality key yet
        entry["link"] = (f"vless://{user.uuid}@{host}:{port}?encryption=none&security=reality"
                         f"&sni={REALITY_SNI}&fp=chrome&pbk={node.reality_pub}&sid={node.reality_sid}"
                         f"&type=tcp&flow=xtls-rprx-vision#{tag}")
    elif proto == "trojan":
        entry["link"] = (f"trojan://{quote(user.password)}@{host}:{port}?security=tls&sni={host}"
                         f"{'&allowInsecure=1' if insecure else ''}#{tag}")
    elif proto == "ss":
        cred = _b64url(f"{SS_METHOD}:{node.ss_key}:{user_ss_key(user.uuid)}")
        entry["link"] = f"ss://{cred}@{host}:{port}#{tag}"
    elif proto == "hy2":
        entry["link"] = (f"hysteria2://{quote(user.password)}@{host}:{port}?sni={host}"
                         f"{'&insecure=1' if insecure else ''}#{tag}")
    elif proto == "l2tp":
        entry["details"] = {"server": host, "username": user.name, "password": user.password,
                            "psk": node.l2tp_psk}
    return entry


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
