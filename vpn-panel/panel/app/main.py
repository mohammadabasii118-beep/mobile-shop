import base64
import hashlib
import sqlite3
import tempfile
import hmac
import os
import re
import secrets
import time
import uuid as uuidlib
from contextlib import asynccontextmanager
from datetime import timedelta
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, PlainTextResponse, Response
from starlette.background import BackgroundTask
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .catalog import PROTOCOLS, REALITY_SNI, SS_METHOD
from .db import Node, NodeProtocol, User, engine, get_db, init_db, utcnow
from .subscription import new_wg_keypair, subscription_body, user_entries, user_ss_key, wg_ip

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


def make_token() -> str:
    exp = str(int(time.time()) + 7 * 86400)
    return f"{exp}.{_sign(exp)}"


def require_admin(authorization: str | None = Header(None)) -> None:
    token = (authorization or "").removeprefix("Bearer ").strip()
    exp, _, sig = token.partition(".")
    if not exp.isdigit() or not hmac.compare_digest(sig, _sign(exp)) or int(exp) < time.time():
        raise HTTPException(401, "نشست نامعتبر است")


def require_node(authorization: str | None = Header(None), db: Session = Depends(get_db)) -> Node:
    token = (authorization or "").removeprefix("Bearer ").strip()
    node = db.scalar(select(Node).where(Node.token == token)) if token else None
    if not node:
        raise HTTPException(401, "توکن نود نامعتبر است")
    return node


class Login(BaseModel):
    password: str


LOGIN_MAX_FAILS, LOGIN_WINDOW = 5, 900
_login_fails: dict[str, list[float]] = {}


def client_ip(request: Request) -> str:
    # Caddy (the only thing exposed) sets X-Forwarded-For to the real client address
    fwd = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return fwd or (request.client.host if request.client else "?")


@app.post("/api/login")
def login(body: Login, request: Request):
    ip, now = client_ip(request), time.time()
    recent = [t for t in _login_fails.get(ip, []) if now - t < LOGIN_WINDOW]
    if len(recent) >= LOGIN_MAX_FAILS:
        raise HTTPException(429, "تلاش‌های اشتباه زیاد بود؛ ۱۵ دقیقه بعد دوباره امتحان کنید")
    if not hmac.compare_digest(body.password, admin_password()):
        if len(_login_fails) > 10000:  # bound memory
            _login_fails.clear()
        _login_fails[ip] = recent + [now]
        time.sleep(1)  # slow down guessing
        raise HTTPException(401, "رمز اشتباه است")
    _login_fails.pop(ip, None)
    return {"token": make_token()}


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
    node.protocols += [NodeProtocol(proto=k, port=v["port"]) for k, v in PROTOCOLS.items() if k not in have]


def public_url(request: Request) -> str:
    return (os.environ.get("PANEL_PUBLIC_URL") or str(request.base_url)).rstrip("/")


def is_online(node: Node) -> bool:
    return bool(node.last_seen and (utcnow() - node.last_seen).total_seconds() < ONLINE_WINDOW)


def node_out(node: Node, request: Request) -> dict:
    url = public_url(request)
    return {
        "id": node.id, "name": node.name, "cc": node.cc, "address": node.address,
        "cf_domain": node.cf_domain, "cf_address": node.cf_address, "port_range": list(PORT_RANGE),
        "online": is_online(node), "load": node.load, "reality_ready": bool(node.reality_pub),
        "last_seen": node.last_seen.isoformat() + "Z" if node.last_seen else None,
        "protocols": [{"proto": p.proto, "enabled": p.enabled, "port": p.port,
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
        "days_left": days_left, "expire_at": user.expire_at.isoformat() + "Z" if user.expire_at else None, "protos": user.protos, "node_ids": user.node_ids,
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


class NodeCdn(BaseModel):
    cf_domain: str = Field(default="", pattern=r"^([A-Za-z0-9\-]+\.)+[A-Za-z]{2,}$|^$")
    cf_address: str = Field(default="", pattern=r"^[A-Za-z0-9.\-]{0,253}$")


@app.put("/api/nodes/{node_id}/cloudflare", dependencies=[Depends(require_admin)])
def set_cloudflare(node_id: int, body: NodeCdn, request: Request, db: Session = Depends(get_db)):
    node = db.get(Node, node_id) or _404()
    node.cf_domain, node.cf_address = body.cf_domain.lower(), body.cf_address
    db.commit()
    return node_out(node, request)


@app.delete("/api/nodes/{node_id}", dependencies=[Depends(require_admin)])
def delete_node(node_id: int, db: Session = Depends(get_db)):
    node = db.get(Node, node_id) or _404()
    db.delete(node)
    for u in db.scalars(select(User)):
        if node_id in u.node_ids:
            u.node_ids = [i for i in u.node_ids if i != node_id]
    db.commit()
    return {"ok": True}


class ProtoToggle(BaseModel):
    enabled: bool


@app.put("/api/nodes/{node_id}/protocols/{proto}", dependencies=[Depends(require_admin)])
def toggle_protocol(node_id: int, proto: str, body: ProtoToggle, db: Session = Depends(get_db)):
    node = db.get(Node, node_id) or _404()
    np = next((p for p in node.protocols if p.proto == proto), None) or _404()
    np.enabled = body.enabled
    db.commit()
    return {"ok": True}


class PortIn(BaseModel):
    port: int | None = Field(default=None, ge=1, le=65535)  # None = pick a random free port


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
        if port in RESERVED_PORTS:
            raise HTTPException(422, f"پورت {port} رزرو است")
        if port in used:
            raise HTTPException(409, f"پورت {port} را پروتکل دیگری در این نود استفاده می‌کند")
    np.port = port
    db.commit()
    return node_out(node, request)


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


@app.post("/api/users", dependencies=[Depends(require_admin)])
def create_user(body: UserIn, request: Request, db: Session = Depends(get_db)):
    if bad := [p for p in body.protos if p not in PROTOCOLS]:
        raise HTTPException(422, f"پروتکل ناشناخته: {bad[0]}")
    if db.scalar(select(User).where(User.name == body.name)):
        raise HTTPException(409, "این نام کاربری وجود دارد")
    user = User(name=body.name, sub_token=secrets.token_urlsafe(16), uuid=str(uuidlib.uuid4()),
                password=secrets.token_urlsafe(12), quota_bytes=int(body.quota_gb * GB),
                expire_at=utcnow() + timedelta(days=body.days) if body.days else None,
                protos=body.protos, node_ids=body.node_ids)
    user.wg_private, user.wg_public = new_wg_keypair()
    db.add(user)
    db.commit()
    return user_out(user, request)


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


@app.get("/api/users/{user_id}/configs", dependencies=[Depends(require_admin)])
def user_configs(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id) or _404()
    return user_entries(user, list(db.scalars(select(Node).order_by(Node.id))))


# ---------- subscription (public, token in URL) ----------
@app.get("/sub/{token}")
def subscription(token: str, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.sub_token == token)) or _404()
    entries = user_entries(user, list(db.scalars(select(Node)))) if user.status() == "active" else []
    headers = {"subscription-userinfo": f"upload=0; download={user.used_bytes}; total={user.quota_bytes}; "
               f"expire={int(user.expire_at.timestamp()) if user.expire_at else 0}",
               "profile-update-interval": "6"}
    return PlainTextResponse(subscription_body(entries), headers=headers)


# ---------- node agent API ----------
@app.get("/api/node/config")
def node_config(node: Node = Depends(require_node), db: Session = Depends(get_db)):
    enabled = {p.proto: p.port for p in node.protocols if p.enabled}
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
    return {"agent_sha256": agent_sha,
            "node": {"name": node.name, "reality_sni": REALITY_SNI, "ss_method": SS_METHOD,
                     "ss_key": node.ss_key, "l2tp_psk": node.l2tp_psk},
            "protocols": enabled, "users": users}


class Report(BaseModel):
    load: int = Field(ge=0, le=100, default=0)
    usage: dict[str, int] = {}  # username -> bytes since last report
    reality_pub: str = ""
    reality_sid: str = ""
    tls_self_signed: bool = True
    wg_pub: str = ""
    ovpn_ca: str = ""


@app.post("/api/node/report")
def node_report(body: Report, node: Node = Depends(require_node), db: Session = Depends(get_db)):
    node.last_seen, node.load = utcnow(), body.load
    node.tls_self_signed = body.tls_self_signed
    if body.reality_pub:
        node.reality_pub, node.reality_sid = body.reality_pub, body.reality_sid
    node.wg_pub, node.ovpn_ca = body.wg_pub or node.wg_pub, body.ovpn_ca or node.ovpn_ca
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
