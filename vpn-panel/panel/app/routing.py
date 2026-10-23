"""Outbounds and routing rules: turns what the admin enters into Xray outbound / routing-rule JSON."""
import importlib.util
import re
from pathlib import Path

from .catalog import PROTOCOLS
from .db import Outbound, Rule

BUILTIN = {"direct", "block"}
INBOUND_IDS = [k for k, v in PROTOCOLS.items() if v["engine"] == "xray"]  # only Xray inbounds are routable
NAME = re.compile(r"^[a-z0-9][a-z0-9-]{0,23}$")
HOST = re.compile(r"^[A-Za-z0-9.\-:]{1,253}$")
PORTS = re.compile(r"^\d{1,5}(-\d{1,5})?(,\d{1,5}(-\d{1,5})?)*$")
DOMAIN = re.compile(r"^(domain:|full:|regexp:|geosite:|keyword:)?[^\s]{1,200}$")
IP = re.compile(r"^(geoip:[a-z!-]{2,30}|[0-9a-fA-F:.]+(/\d{1,3})?)$")
KINDS = ("link", "socks", "http", "wireguard")


def _selftest():
    """The link parser used by the node self-test also builds Xray client outbounds."""
    path = Path(__file__).resolve().parents[2] / "agent" / "selftest.py"
    spec = importlib.util.spec_from_file_location("selftest_links", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def tag_of(name: str) -> str:
    return name if name in BUILTIN else f"out-{name}"


def build_outbound(kind: str, d: dict) -> tuple[dict, str]:
    """-> (xray outbound without tag, one-line summary without secrets). Raises ValueError."""
    if kind == "link":
        link = (d.get("link") or "").strip()
        parsed = None
        try:
            parsed = _selftest().outbound_for(link)
        except Exception:  # a malformed link of any shape
            pass
        if not parsed or parsed[1].get("protocol") not in ("vless", "vmess", "trojan", "shadowsocks"):
            raise ValueError("لینک باید vless، vmess، trojan یا ss باشد")
        ob = parsed[1]
        server = (ob["settings"].get("vnext") or ob["settings"].get("servers"))[0]
        return ob, f"{ob['protocol']} → {server['address']}:{server['port']}"
    host, port = (d.get("address") or "").strip(), int(d.get("port") or 0)
    if kind in ("socks", "http"):
        if not HOST.match(host) or not 1 <= port <= 65535:
            raise ValueError("آدرس یا پورت نامعتبر است")
        server = {"address": host, "port": port}
        if d.get("username"):
            server["users"] = [{"user": d["username"], "pass": d.get("password", "")}]
        return {"protocol": kind, "settings": {"servers": [server]}}, f"{kind} → {host}:{port}"
    if kind == "wireguard":
        endpoint, secret, peer = (d.get("endpoint") or "").strip(), d.get("secret_key", ""), d.get("public_key", "")
        if not re.match(r"^[A-Za-z0-9.\-]+:\d{1,5}$", endpoint) or len(secret) < 40 or len(peer) < 40:
            raise ValueError("endpoint (host:port)، کلید خصوصی و کلید عمومی لازم است")
        s = {"secretKey": secret, "address": [a.strip() for a in (d.get("local_address") or "172.16.0.2/32").split(",")],
             "peers": [{"publicKey": peer, "endpoint": endpoint, "allowedIPs": ["0.0.0.0/0", "::/0"]}], "mtu": 1280}
        reserved = [int(x) for x in re.findall(r"\d+", d.get("reserved") or "")][:3]
        if len(reserved) == 3 and all(0 <= x <= 255 for x in reserved):
            s["reserved"] = reserved   # Cloudflare WARP needs these three bytes
        return {"protocol": "wireguard", "settings": s}, f"wireguard → {endpoint}"
    raise ValueError("نوع خروجی نامعتبر است")


def validate_rule(inbounds, ports, domains, ips) -> None:
    if not (inbounds or ports or domains or ips):
        raise ValueError("حداقل یک شرط لازم است (ورودی، پورت، دامنه یا آی‌پی)")
    if bad := [i for i in inbounds if i not in INBOUND_IDS and not re.fullmatch(r"[a-z_]+_x\d+", i)]:   # `<proto>_x<id>` = an additional copy
        raise ValueError(f"ورودی ناشناخته: {bad[0]}")
    if ports:
        if not PORTS.match(ports) or any(not 1 <= int(p) <= 65535 for p in re.findall(r"\d+", ports)):
            raise ValueError("پورت‌ها را مثل 443 یا 80,443 یا 8000-9000 بنویسید")
    if bad := [x for x in domains if not DOMAIN.match(x)]:
        raise ValueError(f"دامنه نامعتبر: {bad[0]}")
    if bad := [x for x in ips if not IP.match(x)]:
        raise ValueError(f"آی‌پی نامعتبر: {bad[0]}")


def xray_rule(rule: Rule, known: set[str]) -> dict | None:
    """Xray routing rule for an enabled rule whose outbound still exists, else None."""
    if not rule.enabled or (rule.outbound not in BUILTIN and rule.outbound not in known):
        return None
    out = {"type": "field", "outboundTag": tag_of(rule.outbound)}
    if rule.inbounds:
        out["inboundTag"] = list(rule.inbounds)
    if rule.ports:
        out["port"] = rule.ports
    if rule.domains:
        out["domain"] = list(rule.domains)
    if rule.ips:
        out["ip"] = list(rule.ips)
    return out


def node_routing(outbounds: list[Outbound], rules: list[Rule]) -> tuple[list[dict], list[dict]]:
    """(xray outbounds, xray rules) a node's agent should add to its Xray config."""
    names = {o.name for o in outbounds}
    obs = [{**o.data["xray"], "tag": tag_of(o.name)} for o in outbounds]
    rs = [r for r in (xray_rule(x, names) for x in sorted(rules, key=lambda x: (x.position, x.id))) if r]
    return obs, rs
