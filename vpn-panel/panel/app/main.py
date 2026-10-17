import base64
import hashlib
import sqlite3
import tempfile
import hmac
import json
import os
import re
import secrets
import time
import uuid as uuidlib
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse, Response
from starlette.background import BackgroundTask
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .catalog import PROTOCOLS, REALITY_SNI, SS_METHOD
from .db import Admin, Setting, Node, NodeProtocol, Outbound, Rule, User, engine, get_db, init_db, utcnow
from . import dns as cfdns
from . import routing
from .subpage import render_sub_page
from .subscription import info_entries, new_wg_keypair, subscription_body, user_entries, user_ss_key, wg_ip

BASE = Path(__file__).resolve().parent
ROOT = BASE.parent.parent  # vpn-panel/
GB = 1024 ** 3
RESERVED_PORTS = {22, 53, 80, 500, 1701, 4500, 10085}  # SSH, DNS, HTTP, IPsec/L2TP, Xray stats API


def _port_range() -> tuple[int, int]:
    lo, _, hi = os.environ.get("PANEL_RANDOM_PORT_RANGE", "10000-60000").partition("-")
    lo, hi = int(lo), int(hi or lo)
    if not 1024 <= lo <= hi <= 65535:
        raise RuntimeError("PANEL_RANDOM_PORT_RANGE must look like 10000-60000")
    return lo, hi


PORT_RANGE = _port_range()
ONLINE_WINDOW = 90  # seconds without a report before a node shows as offline
SECRET = (os.environ.get("PANEL_SECRET") or secrets.token_hex(32)).encode()


def admin_password() -> str:
    pw = os.environ.get("PANEL_ADMIN_PASSWORD")
    if not pw:
        raise RuntimeError("Set PANEL_ADMIN_PASSWORD before starting the panel.")
    return pw


@asynccontextmanager
async def lifespan(_: FastAPI):
    admin_password()
    init_db()
    with Session(engine) as db:  # nodes created before a protocol existed get a (default-on) row for it
        for node in db.scalars(select(Node)):
            ensure_protocols(node)
        db.commit()
    yield


app = FastAPI(title="Multi-location VPN panel", lifespan=lifespan)


# ---------- auth ----------
def _sign(payload: str) -> str:
    return hmac.new(SECRET, payload.encode(), hashlib.sha256).hexdigest()


def make_token(admin: Admin | None = None) -> str:
    """Signed, expiring session. Main admin: `exp`; sub-admin: `exp:r:id:ver` (ver changes with the password)."""
    exp = int(time.time()) + 7 * 86400
    payload = str(exp) if admin is None else f"{exp}:r:{admin.id}:{admin.token_ver}"
    return f"{payload}.{_sign(payload)}"


def parse_token(token: str) -> tuple[str, int, int] | None:
    """-> (role, admin id, token version) for a valid, unexpired session; None otherwise."""
    payload, _, sig = token.rpartition(".")
    if not payload or not hmac.compare_digest(sig, _sign(payload)):
        return None
    parts = payload.split(":")
    if not parts[0].isdigit() or int(parts[0]) < time.time():
        return None
    if len(parts) == 1:
        return "sudo", 0, 0
    if len(parts) == 4 and parts[1] == "r" and parts[2].isdigit() and parts[3].isdigit():
        return "reseller", int(parts[2]), int(parts[3])
    return None


def _bearer(authorization: str | None) -> str:
    return (authorization or "").removeprefix("Bearer ").strip()


def _is_api_key(token: str) -> bool:
    key = os.environ.get("PANEL_API_KEY", "")
    return len(key) >= 24 and hmac.compare_digest(token, key)   # long-lived key for bots and scripts


def require_admin(authorization: str | None = Header(None)) -> None:
    """Main admin only. A sub-admin's valid session is 403 (not 401, which would send them to the login box)."""
    token = _bearer(authorization)
    if _is_api_key(token):
        return
    parsed = parse_token(token)
    if not parsed:
        raise HTTPException(401, "نشست نامعتبر است")
    if parsed[0] != "sudo":
        raise HTTPException(403, "این بخش مخصوص مدیر اصلی است")


def hash_pw(pw: str) -> str:
    salt = secrets.token_hex(8)
    return f"{salt}${hashlib.pbkdf2_hmac('sha256', pw.encode(), salt.encode(), 200_000).hex()}"


def check_pw(pw: str, stored: str) -> bool:
    salt, _, digest = stored.partition("$")
    return hmac.compare_digest(hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 200_000).hex(), digest)


def require_reseller(authorization: str | None = Header(None), db: Session = Depends(get_db)) -> Admin:
    parsed = parse_token(_bearer(authorization))
    admin = db.get(Admin, parsed[1]) if parsed and parsed[0] == "reseller" else None
    if not admin or not admin.enabled or admin.token_ver != parsed[2]:
        raise HTTPException(401, "نشست نامعتبر است")
    return admin


def require_node(authorization: str | None = Header(None), db: Session = Depends(get_db)) -> Node:
    token = (authorization or "").removeprefix("Bearer ").strip()
    node = db.scalar(select(Node).where(Node.token == token)) if token else None
    if not node:
        raise HTTPException(401, "توکن نود نامعتبر است")
    return node


class Login(BaseModel):
    password: str
    username: str = ""   # empty = the main admin


LOGIN_MAX_FAILS, LOGIN_WINDOW = 5, 900
_login_fails: dict[str, list[float]] = {}


def client_ip(request: Request) -> str:
    # Caddy (the only thing exposed) sets X-Forwarded-For to the real client address
    fwd = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return fwd or (request.client.host if request.client else "?")


@app.post("/api/login")
def login(body: Login, request: Request, db: Session = Depends(get_db)):
    ip, now = client_ip(request), time.time()
    recent = [t for t in _login_fails.get(ip, []) if now - t < LOGIN_WINDOW]
    if len(recent) >= LOGIN_MAX_FAILS:
        raise HTTPException(429, "تلاش‌های اشتباه زیاد بود؛ ۱۵ دقیقه بعد دوباره امتحان کنید")
    admin = db.scalar(select(Admin).where(Admin.username == body.username.strip())) if body.username.strip() else None
    if body.username.strip():
        ok = bool(admin and admin.enabled and check_pw(body.password, admin.pw_hash))
        if not admin:
            check_pw(body.password, "00$00")   # same cost whether or not the name exists
    else:
        ok = hmac.compare_digest(body.password, admin_password())
    if not ok:
        if len(_login_fails) > 10000:  # bound memory
            _login_fails.clear()
        _login_fails[ip] = recent + [now]
        time.sleep(1)  # slow down guessing
        raise HTTPException(401, "نام کاربری یا رمز اشتباه است" if body.username.strip() else "رمز اشتباه است")
    _login_fails.pop(ip, None)
    return {"token": make_token(admin if body.username.strip() else None), "role": "reseller" if body.username.strip() else "sudo"}


@app.get("/api/backup", dependencies=[Depends(require_admin)])
def backup():
    """Consistent copy of the SQLite database (safe while the panel is running)."""
    if engine.url.get_backend_name() != "sqlite":
        raise HTTPException(501, "پشتیبان‌گیری فقط برای SQLite پشتیبانی می‌شود")
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    src, dst = sqlite3.connect(engine.url.database), sqlite3.connect(path)
    with dst:
        src.backup(dst)
    src.close(); dst.close()
    name = f"panel-backup-{utcnow():%Y%m%d-%H%M}.db"
    return FileResponse(path, filename=name, media_type="application/octet-stream",
                        background=BackgroundTask(os.unlink, path))


# ---------- helpers ----------
def ensure_protocols(node: Node) -> None:
    have = {p.proto for p in node.protocols}
    node.protocols += [NodeProtocol(proto=k, port=v["port"], enabled=k != "dnstt")   # DNSTT needs a domain and builds software: opt-in
                       for k, v in PROTOCOLS.items() if k not in have]


def public_url(request: Request) -> str:
    return (os.environ.get("PANEL_PUBLIC_URL") or str(request.base_url)).rstrip("/")


def is_online(node: Node) -> bool:
    return bool(node.last_seen and (utcnow() - node.last_seen).total_seconds() < ONLINE_WINDOW)


def node_out(node: Node, request: Request) -> dict:
    url = public_url(request)
    return {
        "id": node.id, "name": node.name, "cc": node.cc, "address": node.address,
        "reality_sni": node.reality_sni or REALITY_SNI, "cf_domain": node.cf_domain, "cf_address": node.cf_address, "raw_host": node.raw_host, "conflicts": node.conflicts or [], "errors": node.errors or [], "port_range": list(PORT_RANGE),
        "online": is_online(node), "load": node.load, "reality_ready": bool(node.reality_pub),
        "last_seen": node.last_seen.isoformat() + "Z" if node.last_seen else None,
        "protocols": [{"proto": p.proto, "enabled": p.enabled, "port": p.port, "host": p.host,
                       "fixed": PROTOCOLS[p.proto]["fixed_port"]} for p in node.protocols],
        "install_command": f"bash <(curl -sL {url}/node-install.sh) --token {node.token} --address {node.address}"
                           + ("" if node.address.replace(".", "").isdigit() else " --letsencrypt"),
    }


def user_out(user: User, request: Request) -> dict:
    days_left = None
    if user.expire_at:
        days_left = max(0, (user.expire_at - utcnow()).days)
    return {
        "id": user.id, "name": user.name, "status": user.status(), "enabled": user.enabled,
        "used_gb": round(user.used_bytes / GB, 2), "quota_gb": round(user.quota_bytes / GB, 2),
        "days_left": days_left, "expire_at": user.expire_at.isoformat() + "Z" if user.expire_at else None, "protos": user.protos, "node_ids": user.node_ids, "owner_id": user.owner_id,
        "sub_url": f"{public_url(request)}/sub/{user.sub_token}",
    }


# ---------- admin API ----------
@app.get("/api/protocols", dependencies=[Depends(require_admin)])
def protocols():
    return [{"id": k, **v} for k, v in PROTOCOLS.items()]


class NodeIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    cc: str = Field(min_length=2, max_length=2)
    address: str = Field(pattern=r"^[A-Za-z0-9.\-]{3,253}$")


@app.get("/api/nodes", dependencies=[Depends(require_admin)])
def list_nodes(request: Request, db: Session = Depends(get_db)):
    return [node_out(n, request) for n in db.scalars(select(Node).order_by(Node.id))]


@app.post("/api/nodes", dependencies=[Depends(require_admin)])
def create_node(body: NodeIn, request: Request, db: Session = Depends(get_db)):
    node = Node(name=body.name, cc=body.cc.upper(), address=body.address,
                token=secrets.token_urlsafe(24),
                ss_key=base64.b64encode(secrets.token_bytes(16)).decode(),
                l2tp_psk=secrets.token_urlsafe(12))
    ensure_protocols(node)
    db.add(node)
    db.commit()
    return node_out(node, request)


class RealitySni(BaseModel):
    sni: str = Field(pattern=r"^([A-Za-z0-9\-]+\.)+[A-Za-z]{2,}$")


@app.put("/api/nodes/{node_id}/reality", dependencies=[Depends(require_admin)])
def set_reality_sni(node_id: int, body: RealitySni, request: Request, db: Session = Depends(get_db)):
    """The site Reality imitates. It must answer TLS 1.3 with h2 from the node; not every site does everywhere."""
    node = db.get(Node, node_id) or _404()
    node.reality_sni = body.sni.lower()
    db.commit()
    return node_out(node, request)


class NodeCdn(BaseModel):
    cf_domain: str = Field(default="", pattern=r"^([A-Za-z0-9\-]+\.)+[A-Za-z]{2,}$|^$")
    cf_address: str = Field(default="", pattern=r"^[A-Za-z0-9.\-]{0,253}$")
    raw_host: str = Field(default="", pattern=r"^[A-Za-z0-9.\-]{0,253}$")


@app.put("/api/nodes/{node_id}/cloudflare", dependencies=[Depends(require_admin)])
def set_cloudflare(node_id: int, body: NodeCdn, request: Request, db: Session = Depends(get_db)):
    node = db.get(Node, node_id) or _404()
    node.cf_domain, node.cf_address = body.cf_domain.lower(), body.cf_address
    node.raw_host = body.raw_host
    db.commit()
    return node_out(node, request)


@app.delete("/api/nodes/{node_id}", dependencies=[Depends(require_admin)])
def delete_node(node_id: int, db: Session = Depends(get_db)):
    node = db.get(Node, node_id) or _404()
    db.delete(node)
    db.flush()
    if dnstt_conf(db)["token"]:
        run_dns_sync(db)
    for u in db.scalars(select(User)):
        if node_id in u.node_ids:
            u.node_ids = [i for i in u.node_ids if i != node_id]
    db.commit()
    return {"ok": True}


class NodePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)  # may contain emoji
    cc: str | None = Field(default=None, pattern=r"^[A-Za-z]{2}$")
    address: str | None = Field(default=None, pattern=r"^[A-Za-z0-9.\-]{3,253}$")


@app.patch("/api/nodes/{node_id}", dependencies=[Depends(require_admin)])
def patch_node(node_id: int, body: NodePatch, request: Request, db: Session = Depends(get_db)):
    """Rename a location (emoji welcome) or change its country code / address. A new address only changes the
    links handed out; the node itself keeps reporting with its token, so it stays online."""
    node = db.get(Node, node_id) or _404()
    if body.name is not None:
        name = body.name.strip()
        if not name or any(ord(ch) < 32 for ch in name):
            raise HTTPException(422, "نام نامعتبر است")
        node.name = name
    if body.cc is not None:
        node.cc = body.cc.upper()
    if body.address is not None:
        node.address = body.address
    db.commit()
    return node_out(node, request)


class ProtoToggle(BaseModel):
    enabled: bool


@app.put("/api/nodes/{node_id}/protocols/{proto}", dependencies=[Depends(require_admin)])
def toggle_protocol(node_id: int, proto: str, body: ProtoToggle, db: Session = Depends(get_db)):
    node = db.get(Node, node_id) or _404()
    np = next((p for p in node.protocols if p.proto == proto), None) or _404()
    np.enabled = body.enabled
    db.commit()
    out = {"ok": True}
    if proto == "dnstt" and dnstt_conf(db)["token"]:
        out["dns"] = run_dns_sync(db)   # records follow the checkbox
    return out


class PortIn(BaseModel):
    port: int | None = Field(default=None, ge=1, le=65535)  # None = pick a random free port


class HostIn(BaseModel):
    host: str = Field(default="", pattern=r"^[A-Za-z0-9.\-]{0,253}$")   # empty = automatic (the node address)


@app.put("/api/nodes/{node_id}/protocols/{proto}/host", dependencies=[Depends(require_admin)])
def set_proto_host(node_id: int, proto: str, body: HostIn, request: Request, db: Session = Depends(get_db)):
    """Domain or IP that clients of this protocol connect to (a relay, an alias domain, a clean IP). Links only:
    nothing changes on the node."""
    node = db.get(Node, node_id) or _404()
    np = next((p for p in node.protocols if p.proto == proto), None) or _404()
    np.host = body.host.lower()
    db.commit()
    return node_out(node, request)


@app.put("/api/nodes/{node_id}/protocols/{proto}/port", dependencies=[Depends(require_admin)])
def set_port(node_id: int, proto: str, body: PortIn, request: Request, db: Session = Depends(get_db)):
    node = db.get(Node, node_id) or _404()
    np = next((p for p in node.protocols if p.proto == proto), None) or _404()
    if PROTOCOLS[proto]["fixed_port"]:
        raise HTTPException(422, "پورت این پروتکل طبق استاندارد ثابت است")
    used = {p.port for p in node.protocols if p is not np}
    if body.port is None:
        free = [x for x in range(PORT_RANGE[0], PORT_RANGE[1] + 1) if x not in used and x not in RESERVED_PORTS]
        if not free:
            raise HTTPException(409, "پورت آزادی در بازه نمانده است")
        port = secrets.choice(free)
    else:
        port = body.port
        if port in RESERVED_PORTS and not (proto == "vless_raw" and port == 80):   # plain VLESS may take 80 like x-ui did
            raise HTTPException(422, f"پورت {port} رزرو است")
        if port in used:
            raise HTTPException(409, f"پورت {port} را پروتکل دیگری در این نود استفاده می‌کند")
    np.port = port
    db.commit()
    return node_out(node, request)


# ---------- outbounds and routing rules ----------
class OutboundIn(BaseModel):
    name: str
    kind: str
    link: str = ""
    address: str = ""
    port: int = 0
    username: str = ""
    password: str = ""
    secret_key: str = ""
    public_key: str = ""
    endpoint: str = ""
    local_address: str = ""
    reserved: str = ""


class RuleIn(BaseModel):
    inbounds: list[str] = []
    ports: str = ""
    domains: list[str] = Field(default=[], max_length=100)
    ips: list[str] = Field(default=[], max_length=100)
    outbound: str = "direct"
    note: str = Field(default="", max_length=120)


def routing_out(node: Node) -> dict:
    return {"inbound_ids": [{"id": i, "label": PROTOCOLS[i]["label"]} for i in routing.INBOUND_IDS],
            "outbounds": [{"id": o.id, "name": o.name, "kind": o.kind, "summary": o.data.get("summary", "")}
                          for o in node.outbounds],
            "rules": [{"id": r.id, "enabled": r.enabled, "inbounds": r.inbounds, "ports": r.ports,
                       "domains": r.domains, "ips": r.ips, "outbound": r.outbound, "note": r.note}
                      for r in sorted(node.rules, key=lambda x: (x.position, x.id))]}


@app.get("/api/nodes/{node_id}/routing", dependencies=[Depends(require_admin)])
def get_routing(node_id: int, db: Session = Depends(get_db)):
    return routing_out(db.get(Node, node_id) or _404())


@app.post("/api/nodes/{node_id}/outbounds", dependencies=[Depends(require_admin)])
def add_outbound(node_id: int, body: OutboundIn, db: Session = Depends(get_db)):
    node = db.get(Node, node_id) or _404()
    name = body.name.strip().lower()
    if not routing.NAME.match(name) or name in routing.BUILTIN or name == "api":
        raise HTTPException(422, "نام فقط حروف کوچک انگلیسی، عدد و خط تیره (حداکثر ۲۴ حرف) و غیر از direct/block/api")
    if any(o.name == name for o in node.outbounds):
        raise HTTPException(409, "این نام قبلاً وجود دارد")
    try:
        xray, summary = routing.build_outbound(body.kind, body.model_dump())
    except (ValueError, TypeError) as e:
        raise HTTPException(422, str(e))
    db.add(Outbound(node_id=node.id, name=name, kind=body.kind, data={"xray": xray, "summary": summary}))
    db.commit()
    db.refresh(node)
    return routing_out(node)


@app.delete("/api/outbounds/{outbound_id}", dependencies=[Depends(require_admin)])
def delete_outbound(outbound_id: int, db: Session = Depends(get_db)):
    ob = db.get(Outbound, outbound_id) or _404()
    node = db.get(Node, ob.node_id)
    for r in list(node.rules):
        if r.outbound == ob.name:  # a rule pointing nowhere would silently stop matching
            db.delete(r)
    db.delete(ob)
    db.commit()
    db.refresh(node)
    return routing_out(node)


@app.post("/api/nodes/{node_id}/rules", dependencies=[Depends(require_admin)])
def add_rule(node_id: int, body: RuleIn, db: Session = Depends(get_db)):
    node = db.get(Node, node_id) or _404()
    ports = body.ports.replace(" ", "")
    domains = [x.strip() for x in body.domains if x.strip()]
    ips = [x.strip() for x in body.ips if x.strip()]
    try:
        routing.validate_rule(body.inbounds, ports, domains, ips)
    except ValueError as e:
        raise HTTPException(422, str(e))
    if body.outbound not in routing.BUILTIN and body.outbound not in {o.name for o in node.outbounds}:
        raise HTTPException(422, "خروجی انتخاب‌شده وجود ندارد")
    last = max((r.position for r in node.rules), default=0)
    db.add(Rule(node_id=node.id, position=last + 1, inbounds=body.inbounds, ports=ports, domains=domains, ips=ips,
                outbound=body.outbound, note=body.note.strip()))
    db.commit()
    db.refresh(node)
    return routing_out(node)


class RulePatch(BaseModel):
    enabled: bool | None = None
    move: str | None = Field(default=None, pattern="^(up|down)$")


@app.patch("/api/rules/{rule_id}", dependencies=[Depends(require_admin)])
def patch_rule(rule_id: int, body: RulePatch, db: Session = Depends(get_db)):
    rule = db.get(Rule, rule_id) or _404()
    node = db.get(Node, rule.node_id)
    if body.enabled is not None:
        rule.enabled = body.enabled
    if body.move:
        ordered = sorted(node.rules, key=lambda x: (x.position, x.id))
        i = ordered.index(rule)
        j = i - 1 if body.move == "up" else i + 1
        if 0 <= j < len(ordered):
            ordered[i], ordered[j] = ordered[j], ordered[i]
        for pos, r in enumerate(ordered, 1):
            r.position = pos
    db.commit()
    db.refresh(node)
    return routing_out(node)


@app.delete("/api/rules/{rule_id}", dependencies=[Depends(require_admin)])
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.get(Rule, rule_id) or _404()
    node = db.get(Node, rule.node_id)
    db.delete(rule)
    db.commit()
    db.refresh(node)
    return routing_out(node)


class UserIn(BaseModel):
    name: str = Field(pattern=r"^[A-Za-z0-9_.\-]{2,32}$")
    quota_gb: float = Field(ge=0, default=0)
    days: int = Field(ge=0, default=0)
    protos: list[str] = Field(min_length=1)
    node_ids: list[int] = []


class UserPatch(BaseModel):
    enabled: bool | None = None
    quota_gb: float | None = Field(default=None, ge=0)  # 0 = unlimited
    days: int | None = Field(default=None, ge=0)  # expire this many days from now; 0 = never
    extend_days: int | None = Field(default=None, ge=1, le=3650)  # renew: add to the current expiry
    reset_usage: bool = False
    protos: list[str] | None = Field(default=None, min_length=1)
    node_ids: list[int] | None = None


@app.get("/api/users", dependencies=[Depends(require_admin)])
def list_users(request: Request, db: Session = Depends(get_db)):
    return [user_out(u, request) for u in db.scalars(select(User).order_by(User.id.desc()))]


def new_user(db: Session, body: "UserIn", owner: Admin | None = None) -> User:
    if bad := [p for p in body.protos if p not in PROTOCOLS]:
        raise HTTPException(422, f"پروتکل ناشناخته: {bad[0]}")
    if db.scalar(select(User).where(User.name == body.name)):
        raise HTTPException(409, "این نام کاربری وجود دارد")
    user = User(name=body.name, sub_token=secrets.token_urlsafe(16), uuid=str(uuidlib.uuid4()),
                password=secrets.token_urlsafe(12), quota_bytes=int(body.quota_gb * GB),
                expire_at=utcnow() + timedelta(days=body.days) if body.days else None,
                protos=body.protos, node_ids=body.node_ids, owner_id=owner.id if owner else None)
    user.wg_private, user.wg_public = new_wg_keypair()
    db.add(user)
    db.commit()
    return user


@app.post("/api/users", dependencies=[Depends(require_admin)])
def create_user(body: UserIn, request: Request, db: Session = Depends(get_db)):
    return user_out(new_user(db, body), request)


class ImportClient(BaseModel):
    name: str
    uuid: str = ""
    quota_bytes: int = Field(ge=0, default=0)
    used_bytes: int = Field(ge=0, default=0)
    expire_ms: int = 0   # 3x-ui: epoch ms; 0 = never; negative = that many ms counted from now
    enabled: bool = True


class ImportIn(BaseModel):
    clients: list[ImportClient] = Field(max_length=5000)
    protos: list[str] = Field(min_length=1)
    node_ids: list[int] = []


@app.post("/api/import/users", dependencies=[Depends(require_admin)])
def import_users(body: ImportIn, db: Session = Depends(get_db)):
    """Bulk-create users from another panel (3x-ui). Keeps the client's UUID, quota, expiry and used traffic;
    existing names are skipped, so re-running is safe."""
    if bad := [p for p in body.protos if p not in PROTOCOLS]:
        raise HTTPException(422, f"پروتکل ناشناخته: {bad[0]}")
    names = set(db.scalars(select(User.name)))
    taken_uuids = set(db.scalars(select(User.uuid)))
    made, skipped = [], []
    for c in body.clients:
        name = re.sub(r"[^A-Za-z0-9_.\-]", "_", c.name)[:32].strip("_") or "user"
        if len(name) < 2:
            name += "_u"
        if name in names:
            skipped.append(name)
            continue
        try:
            uid = str(uuidlib.UUID(c.uuid))
        except ValueError:
            uid = ""
        if not uid or uid in taken_uuids:
            uid = str(uuidlib.uuid4())
        if c.expire_ms > 0:
            expire = datetime.fromtimestamp(c.expire_ms / 1000, timezone.utc).replace(tzinfo=None)
        elif c.expire_ms < 0:
            expire = utcnow() + timedelta(milliseconds=-c.expire_ms)
        else:
            expire = None
        user = User(name=name, sub_token=secrets.token_urlsafe(16), uuid=uid, password=secrets.token_urlsafe(12),
                    quota_bytes=c.quota_bytes, used_bytes=c.used_bytes, expire_at=expire, enabled=c.enabled,
                    protos=body.protos, node_ids=body.node_ids)
        user.wg_private, user.wg_public = new_wg_keypair()
        db.add(user)
        names.add(name)
        taken_uuids.add(uid)
        made.append(name)
    db.commit()
    return {"created": len(made), "skipped": skipped}


class BulkProtos(BaseModel):
    add: list[str] = []
    remove: list[str] = []
    names: list[str] = []   # empty = every user


@app.post("/api/users/bulk-protos", dependencies=[Depends(require_admin)])
def bulk_protos(body: BulkProtos, db: Session = Depends(get_db)):
    """Add and/or remove protocols for many users at once (all users when `names` is empty)."""
    if bad := [p for p in body.add + body.remove if p not in PROTOCOLS]:
        raise HTTPException(422, f"پروتکل ناشناخته: {bad[0]}")
    changed = 0
    for u in db.scalars(select(User)):
        if body.names and u.name not in body.names:
            continue
        new = [p for p in u.protos if p not in body.remove] + [p for p in body.add if p not in u.protos]
        if new and new != u.protos:
            u.protos = new
            changed += 1
    db.commit()
    return {"changed": changed}


class BulkIn(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=5000)
    delete: bool = False
    add_protos: list[str] = []
    remove_protos: list[str] = []
    node_ids: list[int] | None = None   # None = leave as is, [] = every location


@app.post("/api/users/bulk", dependencies=[Depends(require_admin)])
def bulk_users(body: BulkIn, db: Session = Depends(get_db)):
    """One operation on many users chosen by id: delete them, or add/remove protocols and set their locations."""
    if bad := [p for p in body.add_protos + body.remove_protos if p not in PROTOCOLS]:
        raise HTTPException(422, f"پروتکل ناشناخته: {bad[0]}")
    known = set(db.scalars(select(Node.id)))
    users = list(db.scalars(select(User).where(User.id.in_(body.ids))))
    for u in users:
        if body.delete:
            db.delete(u)
            continue
        new = [p for p in u.protos if p not in body.remove_protos] + [p for p in body.add_protos if p not in u.protos]
        if new:   # a user always keeps at least one protocol
            u.protos = new
        if body.node_ids is not None:
            u.node_ids = [i for i in body.node_ids if i in known]
    db.commit()
    return {"affected": len(users)}


@app.patch("/api/users/{user_id}", dependencies=[Depends(require_admin)])
def patch_user(user_id: int, body: UserPatch, request: Request, db: Session = Depends(get_db)):
    user = db.get(User, user_id) or _404()
    if body.enabled is not None:
        user.enabled = body.enabled
    if body.quota_gb is not None:
        user.quota_bytes = int(body.quota_gb * GB)
    if body.days is not None:
        user.expire_at = utcnow() + timedelta(days=body.days) if body.days else None
    if body.extend_days:
        if user.expire_at is None and body.days is None:
            raise HTTPException(422, "این کاربر انقضا ندارد؛ برای تمدید ابتدا مدت را تعیین کنید")
        base = max(user.expire_at, utcnow()) if user.expire_at else utcnow()  # expired users renew from today
        user.expire_at = base + timedelta(days=body.extend_days)
    if body.protos is not None:
        if bad := [p for p in body.protos if p not in PROTOCOLS]:
            raise HTTPException(422, f"پروتکل ناشناخته: {bad[0]}")
        user.protos = body.protos
    if body.node_ids is not None:
        known = set(db.scalars(select(Node.id)))
        user.node_ids = [i for i in body.node_ids if i in known]
    if body.reset_usage:
        user.used_bytes = 0
    db.commit()
    return user_out(user, request)


@app.delete("/api/users/{user_id}", dependencies=[Depends(require_admin)])
def delete_user(user_id: int, db: Session = Depends(get_db)):
    db.delete(db.get(User, user_id) or _404())
    db.commit()
    return {"ok": True}


@app.post("/api/users/{user_id}/rotate", dependencies=[Depends(require_admin)])
def rotate_user(user_id: int, request: Request, db: Session = Depends(get_db)):
    """New subscription token and new credentials (uuid, passwords, WireGuard key): every link handed out before stops
    working. Name, quota, expiry and usage stay. Nodes pick the change up on their next pass (about 30 s)."""
    user = db.get(User, user_id) or _404()
    user.sub_token = secrets.token_urlsafe(16)
    user.uuid = str(uuidlib.uuid4())
    user.password = secrets.token_urlsafe(12)
    user.wg_private, user.wg_public = new_wg_keypair()
    db.commit()
    return user_out(user, request)


@app.get("/api/users/by-name/{name}", dependencies=[Depends(require_admin)])
def user_by_name(name: str, request: Request, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.name == name)) or _404()
    return user_out(user, request)


@app.get("/api/users/{user_id}/configs", dependencies=[Depends(require_admin)])
def user_configs(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id) or _404()
    return user_entries(user, list(db.scalars(select(Node).order_by(Node.id))), dnstt_info(db))


# ---------- branding ----------
BRAND_DEFAULT = {"name": "پنل چندلوکیشن", "logo": "", "color": ""}


def get_brand(db: Session) -> dict:
    saved = {s.key: s.value for s in db.scalars(select(Setting).where(Setting.key.like("brand_%")))}
    return {k: saved.get(f"brand_{k}", v) or (v if k == "name" else "") for k, v in BRAND_DEFAULT.items()}


class BrandIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    color: str = Field(default="", pattern=r"^(#[0-9a-fA-F]{6})?$")
    # a small picture sent as a data URI; shown in <img> tags only, so an SVG cannot run scripts
    logo: str = Field(default="", max_length=350_000, pattern=r"^(data:image/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+)?$")


@app.get("/api/branding")
def branding(db: Session = Depends(get_db)):
    """Public: the login page and the subscription page show the panel's name and logo."""
    return get_brand(db)


@app.put("/api/branding", dependencies=[Depends(require_admin)])
def set_branding(body: BrandIn, db: Session = Depends(get_db)):
    for k, v in (("name", body.name.strip()), ("color", body.color), ("logo", body.logo)):
        row = db.get(Setting, f"brand_{k}")
        if row:
            row.value = v
        else:
            db.add(Setting(key=f"brand_{k}", value=v))
    db.commit()
    return get_brand(db)


# ---------- DNSTT (DNS tunnel; one shared domain and key on every node) ----------
def get_setting(db: Session, key: str, default: str = "") -> str:
    row = db.get(Setting, key)
    return row.value if row else default


def put_setting(db: Session, key: str, value: str) -> None:
    row = db.get(Setting, key)
    if row:
        row.value = value
    else:
        db.add(Setting(key=key, value=value))


def dnstt_conf(db: Session) -> dict:
    return {"domain": get_setting(db, "dnstt_domain"), "zone": get_setting(db, "dnstt_zone"),
            "token": get_setting(db, "dnstt_cf_token"), "priv": get_setting(db, "dnstt_priv"), "pub": get_setting(db, "dnstt_pub"),
            "inner": get_setting(db, "dnstt_inner") or "ssh"}


def dnstt_info(db: Session) -> dict | None:
    c = dnstt_conf(db)
    return {"domain": c["domain"], "pub": c["pub"], "inner": c["inner"]} if c["domain"] and c["pub"] else None


def dnstt_nodes(db: Session) -> list[dict]:
    return [{"id": n.id, "name": n.name, "address": n.address,
             "enabled": any(p.proto == "dnstt" and p.enabled for p in n.protocols)} for n in db.scalars(select(Node).order_by(Node.id))]


def run_dns_sync(db: Session) -> dict:
    """Make Cloudflare match the nodes that run DNSTT. Never raises: the result (or the error) is kept for the UI."""
    c = dnstt_conf(db)
    if not (c["token"] and c["zone"] and c["domain"]):
        res = {"ok": False, "error": "توکن Cloudflare یا دامنه تنظیم نشده است", "nodes": {}}
    else:
        try:
            res = {"ok": True, "error": "", **cfdns.sync(c["token"], c["zone"], c["domain"], dnstt_nodes(db))}
        except cfdns.CfError as e:
            res = {"ok": False, "error": str(e), "nodes": {}}
    res["at"] = utcnow().isoformat() + "Z"
    res.pop("zone_id", None)
    put_setting(db, "dnstt_sync", json.dumps(res))
    db.commit()
    return res


def dnstt_out(db: Session) -> dict:
    c = dnstt_conf(db)
    try:
        last = json.loads(get_setting(db, "dnstt_sync") or "{}")
    except ValueError:
        last = {}
    return {"domain": c["domain"], "zone": c["zone"], "token_set": bool(c["token"]), "token_hint": c["token"][-4:] if c["token"] else "",
            "pubkey": c["pub"], "inner": c["inner"], "nodes": dnstt_nodes(db), "last_sync": last}


class DnsttIn(BaseModel):
    """Every field is optional: what is left out keeps its value."""
    domain: str | None = Field(default=None, pattern=r"^(([A-Za-z0-9\-]+\.)+[A-Za-z]{2,})?$")
    zone: str | None = Field(default=None, pattern=r"^(([A-Za-z0-9\-]+\.)+[A-Za-z]{2,})?$")
    cf_token: str | None = Field(default=None, max_length=200, pattern=r"^[A-Za-z0-9_\-]*$")   # "" = remove
    inner: str | None = Field(default=None, pattern=r"^(ssh|vless)$")   # what runs inside the tunnel


@app.get("/api/dnstt", dependencies=[Depends(require_admin)])
def get_dnstt(db: Session = Depends(get_db)):
    return dnstt_out(db)


@app.put("/api/dnstt", dependencies=[Depends(require_admin)])
def set_dnstt(body: DnsttIn, db: Session = Depends(get_db)):
    cur = dnstt_conf(db)
    domain = (cur["domain"] if body.domain is None else body.domain.lower())
    zone = (cur["zone"] if body.zone is None else body.zone.lower())
    if domain and zone and not (domain == zone or domain.endswith("." + zone)):
        raise HTTPException(422, "دامنه‌ی تونل باید زیرمجموعه‌ی همان دامنه‌ی Cloudflare باشد (مثلاً t.example.com برای example.com)")
    if domain == zone and domain:
        raise HTTPException(422, "دامنه‌ی تونل باید یک ساب‌دامین باشد (مثلاً t.example.com)، نه خود دامنه‌ی اصلی")
    put_setting(db, "dnstt_domain", domain)
    put_setting(db, "dnstt_zone", zone)
    if body.cf_token is not None:
        put_setting(db, "dnstt_cf_token", body.cf_token)
    if body.inner:
        put_setting(db, "dnstt_inner", body.inner)
    db.commit()
    return dnstt_out(db)


@app.post("/api/dnstt/sync", dependencies=[Depends(require_admin)])
def sync_dnstt(db: Session = Depends(get_db)):
    run_dns_sync(db)
    return dnstt_out(db)


# ---------- sub-admins ----------
class AdminIn(BaseModel):
    username: str = Field(pattern=r"^[A-Za-z0-9_.\-]{3,32}$")
    password: str = Field(min_length=8, max_length=128)
    max_users: int = Field(ge=0, le=100000, default=0)
    max_quota_gb: float = Field(ge=0, le=1000000, default=0)
    max_days: int = Field(ge=0, le=3650, default=0)
    can_delete: bool = False
    can_edit: bool = False


class AdminPatch(BaseModel):
    enabled: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    max_users: int | None = Field(default=None, ge=0, le=100000)
    max_quota_gb: float | None = Field(default=None, ge=0, le=1000000)
    max_days: int | None = Field(default=None, ge=0, le=3650)
    can_delete: bool | None = None
    can_edit: bool | None = None


def admin_out(a: Admin, db: Session) -> dict:
    n = len(list(db.scalars(select(User.id).where(User.owner_id == a.id))))
    return {"id": a.id, "username": a.username, "enabled": a.enabled, "max_users": a.max_users,
            "max_quota_gb": a.max_quota_gb, "max_days": a.max_days, "users": n,
            "can_delete": a.can_delete, "can_edit": a.can_edit}


@app.get("/api/admins", dependencies=[Depends(require_admin)])
def list_admins(db: Session = Depends(get_db)):
    return [admin_out(a, db) for a in db.scalars(select(Admin).order_by(Admin.id))]


@app.post("/api/admins", dependencies=[Depends(require_admin)])
def create_admin(body: AdminIn, db: Session = Depends(get_db)):
    if db.scalar(select(Admin).where(Admin.username == body.username)):
        raise HTTPException(409, "این نام کاربری ادمین وجود دارد")
    a = Admin(username=body.username, pw_hash=hash_pw(body.password), max_users=body.max_users,
              max_quota_gb=body.max_quota_gb, max_days=body.max_days, can_delete=body.can_delete, can_edit=body.can_edit)
    db.add(a)
    db.commit()
    return admin_out(a, db)


@app.patch("/api/admins/{admin_id}", dependencies=[Depends(require_admin)])
def patch_admin(admin_id: int, body: AdminPatch, db: Session = Depends(get_db)):
    a = db.get(Admin, admin_id) or _404()
    if body.enabled is not None:
        a.enabled = body.enabled
    for f in ("max_users", "max_quota_gb", "max_days", "can_delete", "can_edit"):
        if getattr(body, f) is not None:
            setattr(a, f, getattr(body, f))
    if body.password is not None:
        a.pw_hash = hash_pw(body.password)
        a.token_ver += 1   # signs the admin out everywhere
    db.commit()
    return admin_out(a, db)


@app.delete("/api/admins/{admin_id}", dependencies=[Depends(require_admin)])
def delete_admin(admin_id: int, db: Session = Depends(get_db)):
    """The admin's users stay (they keep working); they just no longer belong to anyone."""
    a = db.get(Admin, admin_id) or _404()
    for u in db.scalars(select(User).where(User.owner_id == a.id)):
        u.owner_id = None
    db.delete(a)
    db.commit()
    return {"ok": True}


# ---------- what a sub-admin may do: create users, see and open their own ----------
@app.get("/api/me")
def me(authorization: str | None = Header(None), db: Session = Depends(get_db)):
    token = _bearer(authorization)
    if _is_api_key(token) or (parse_token(token) or ("",))[0] == "sudo":
        return {"role": "sudo"}
    a = require_reseller(authorization, db)
    return {"role": "reseller", "username": a.username, **{k: v for k, v in admin_out(a, db).items() if k in ("max_users", "max_quota_gb", "max_days", "users", "can_delete", "can_edit")}}


@app.get("/api/me/options")
def me_options(admin: Admin = Depends(require_reseller), db: Session = Depends(get_db)):
    return {"protocols": [{"id": k, "label": v["label"], "counted": v["counted"]} for k, v in PROTOCOLS.items()],
            "nodes": [{"id": n.id, "cc": n.cc, "name": n.name} for n in db.scalars(select(Node).order_by(Node.id))]}


@app.get("/api/me/users")
def me_users(request: Request, admin: Admin = Depends(require_reseller), db: Session = Depends(get_db)):
    return [user_out(u, request) for u in db.scalars(select(User).where(User.owner_id == admin.id).order_by(User.id.desc()))]


@app.post("/api/me/users")
def me_create_user(body: "UserIn", request: Request, admin: Admin = Depends(require_reseller), db: Session = Depends(get_db)):
    if admin.max_users and len(list(db.scalars(select(User.id).where(User.owner_id == admin.id)))) >= admin.max_users:
        raise HTTPException(403, f"سقف تعداد کاربر شما ({admin.max_users}) پر شده است")
    if admin.max_quota_gb and not 0 < body.quota_gb <= admin.max_quota_gb:
        raise HTTPException(422, f"حجم باید بیشتر از صفر و حداکثر {admin.max_quota_gb:g} گیگابایت باشد")
    if admin.max_days and not 0 < body.days <= admin.max_days:
        raise HTTPException(422, f"مدت باید بیشتر از صفر و حداکثر {admin.max_days} روز باشد")
    known = set(db.scalars(select(Node.id)))
    body.node_ids = [i for i in body.node_ids if i in known]
    return user_out(new_user(db, body, admin), request)


def own_user(db: Session, admin: Admin, user_id: int) -> User:
    user = db.get(User, user_id)
    if not user or user.owner_id != admin.id:
        _404()
    return user


class MeUserPatch(BaseModel):
    """What a sub-admin with the edit permission may change on their own users (never protocols or locations)."""
    enabled: bool | None = None
    quota_gb: float | None = Field(default=None, ge=0)
    days: int | None = Field(default=None, ge=0)
    extend_days: int | None = Field(default=None, ge=1, le=3650)
    reset_usage: bool = False


@app.patch("/api/me/users/{user_id}")
def me_patch_user(user_id: int, body: MeUserPatch, request: Request, admin: Admin = Depends(require_reseller), db: Session = Depends(get_db)):
    if not admin.can_edit:
        raise HTTPException(403, "اجازه‌ی ویرایش کاربر را ندارید")
    user = own_user(db, admin, user_id)
    if admin.max_quota_gb and body.quota_gb is not None and not 0 < body.quota_gb <= admin.max_quota_gb:
        raise HTTPException(422, f"حجم باید بیشتر از صفر و حداکثر {admin.max_quota_gb:g} گیگابایت باشد")
    if admin.max_days:
        if body.days is not None and not 0 < body.days <= admin.max_days:
            raise HTTPException(422, f"مدت باید بیشتر از صفر و حداکثر {admin.max_days} روز باشد")
        if body.extend_days:
            base = max(user.expire_at, utcnow()) if user.expire_at else utcnow()
            if (base + timedelta(days=body.extend_days) - utcnow()).days > admin.max_days:
                raise HTTPException(422, f"زمان باقی‌مانده نباید از {admin.max_days} روز بیشتر شود")
    return patch_user(user_id, UserPatch(**body.model_dump()), request, db)


@app.delete("/api/me/users/{user_id}")
def me_delete_user(user_id: int, admin: Admin = Depends(require_reseller), db: Session = Depends(get_db)):
    if not admin.can_delete:
        raise HTTPException(403, "اجازه‌ی حذف کاربر را ندارید")
    db.delete(own_user(db, admin, user_id))
    db.commit()
    return {"ok": True}


@app.get("/api/me/users/{user_id}/configs")
def me_user_configs(user_id: int, admin: Admin = Depends(require_reseller), db: Session = Depends(get_db)):
    user = own_user(db, admin, user_id)
    return user_entries(user, list(db.scalars(select(Node).order_by(Node.id))), dnstt_info(db))


# ---------- subscription (public, token in URL) ----------
@app.get("/sub/{token}")
def subscription(token: str, request: Request, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.sub_token == token)) or _404()
    entries = user_entries(user, list(db.scalars(select(Node))), dnstt_info(db)) if user.status() == "active" else []
    days_left = max(0, (user.expire_at - utcnow()).days) if user.expire_at else None
    if "text/html" in request.headers.get("accept", ""):  # a person in a browser, not a client app
        return HTMLResponse(render_sub_page(user, entries, days_left, f"{public_url(request)}/sub/{token}", get_brand(db)))
    info = info_entries(user, days_left) if os.environ.get("PANEL_SUB_INFO", "1") != "0" else []
    headers = {"subscription-userinfo": f"upload=0; download={user.used_bytes}; total={user.quota_bytes}; "
               f"expire={int(user.expire_at.timestamp()) if user.expire_at else 0}",
               "profile-title": "base64:" + base64.b64encode(user.name.encode()).decode(),
               "profile-update-interval": "6"}
    if url := os.environ.get("PANEL_SUPPORT_URL"):
        headers["support-url"] = url
    links = info + [e["link"] for e in entries if e["link"]]
    return PlainTextResponse(base64.b64encode("\n".join(links).encode()).decode(), headers=headers)


@app.get("/sub/{token}/file/{node_id}/{proto}")
def subscription_file(token: str, node_id: int, proto: str, db: Session = Depends(get_db)):
    """The WireGuard .conf / OpenVPN .ovpn file for one location, for clients that import a file."""
    user = db.scalar(select(User).where(User.sub_token == token)) or _404()
    if user.status() == "active":
        for e in user_entries(user, list(db.scalars(select(Node))), dnstt_info(db)):
            text = (e["details"] or {}).get("config")
            if e["node_id"] == node_id and e["proto"] == proto and text and e["file_ext"]:
                slug = re.sub(r"[^A-Za-z0-9]+", "-", e["node"]).strip("-") or f"node{node_id}"
                headers = {"Content-Disposition": f'attachment; filename="{slug}-{proto}.{e["file_ext"]}"',
                           "Cache-Control": "no-store"}
                return PlainTextResponse(text, headers=headers, media_type="application/octet-stream")
    _404()


# ---------- node agent API ----------
@app.get("/api/node/config")
def node_config(node: Node = Depends(require_node), db: Session = Depends(get_db)):
    enabled = {p.proto: p.port for p in node.protocols if p.enabled}
    dc = dnstt_conf(db)
    users = []
    for u in db.scalars(select(User).order_by(User.id)):
        if u.status() != "active" or (u.node_ids and node.id not in u.node_ids):
            continue
        protos = [p for p in u.protos if p in enabled]
        if protos:
            users.append({"name": u.name, "uuid": u.uuid, "password": u.password,
                          "ss_key": user_ss_key(u.uuid), "wg_pub": u.wg_public,
                          "wg_ip": wg_ip(u.id), "protos": protos})
    agent_sha = hashlib.sha256((ROOT / "agent" / "agent.py").read_bytes()).hexdigest()
    outbounds, rules = routing.node_routing(node.outbounds, node.rules)
    return {"agent_sha256": agent_sha, "outbounds": outbounds, "rules": rules,
            "node": {"name": node.name, "reality_sni": node.reality_sni or REALITY_SNI, "ss_method": SS_METHOD,
                     "ss_key": node.ss_key, "l2tp_psk": node.l2tp_psk},
            "protocols": enabled, "users": users,
            "dnstt": ({"domain": dc["domain"], "privkey": dc["priv"], "inner": dc["inner"]} if "dnstt" in enabled and dc["domain"] else None)}


class Report(BaseModel):
    load: int = Field(ge=0, le=100, default=0)
    usage: dict[str, int] = {}  # username -> bytes since last report
    reality_pub: str = ""
    reality_sid: str = ""
    tls_self_signed: bool = True
    tls_pin: str = Field(default="", max_length=128, pattern=r"^[0-9a-fA-F]*$")
    wg_pub: str = ""
    ovpn_ca: str = ""
    conflicts: list[str] = Field(default=[], max_length=50)
    errors: list[str] = Field(default=[], max_length=20)
    dnstt_priv: str = Field(default="", max_length=200, pattern=r"^[0-9a-fA-F]*$")   # set only by the node that generated the key pair
    dnstt_pub: str = Field(default="", max_length=200, pattern=r"^[0-9a-fA-F]*$")


@app.post("/api/node/report")
def node_report(body: Report, node: Node = Depends(require_node), db: Session = Depends(get_db)):
    node.last_seen, node.load = utcnow(), body.load
    node.conflicts = [c[:120] for c in body.conflicts]
    node.errors = [e[:300] for e in body.errors]
    node.tls_self_signed = body.tls_self_signed
    node.tls_pin = body.tls_pin or node.tls_pin
    if body.reality_pub:
        node.reality_pub, node.reality_sid = body.reality_pub, body.reality_sid
    node.wg_pub, node.ovpn_ca = body.wg_pub or node.wg_pub, body.ovpn_ca or node.ovpn_ca
    if body.dnstt_priv and body.dnstt_pub and not get_setting(db, "dnstt_priv"):   # the first key pair wins; nodes then adopt it
        put_setting(db, "dnstt_priv", body.dnstt_priv)
        put_setting(db, "dnstt_pub", body.dnstt_pub)
    if body.usage:
        for u in db.scalars(select(User).where(User.name.in_(body.usage))):
            u.used_bytes += max(0, body.usage[u.name])
    db.commit()
    return {"ok": True}


# ---------- node install assets ----------
@app.get("/node/agent.py")
def agent_py():
    return FileResponse(ROOT / "agent" / "agent.py", media_type="text/x-python")


@app.get("/node-install.sh")
def node_install(request: Request):
    script = (ROOT / "agent" / "install.sh").read_text().replace("__PANEL_URL__", public_url(request))
    return Response(script, media_type="text/x-shellscript")


def _404():
    raise HTTPException(404, "پیدا نشد")


app.mount("/", StaticFiles(directory=BASE / "static", html=True), name="static")
