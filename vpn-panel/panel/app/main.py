import base64
import hashlib
import io
import sqlite3
import tempfile
import hmac
import json
import os
import random
import re
import secrets
import time
import uuid as uuidlib
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse, Response
from starlette.background import BackgroundTask
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .catalog import PROTOCOLS, REALITY_SNI, SS_METHOD
from .db import Admin, BpTunnel, Setting, Node, NodeProtocol, Outbound, Rule, Tunnel, User, engine, get_db, init_db, utcnow
from . import bp as bpmod
from . import caddyfile
from . import dns as cfdns
from . import routing
from .subpage import qr_text, render_sub_page
from .subscription import info_entries, new_wg_keypair, subscription_body, user_entries, user_ss_key, wg_ip

BASE = Path(__file__).resolve().parent
ROOT = BASE.parent.parent  # vpn-panel/
GB = 1024 ** 3
RESERVED_PORTS = {22, 53, 80, 500, 1701, 2222, 4500, 10085, 18466}  # SSH, DNS, HTTP, IPsec/L2TP, loopback sshd and DNSTT inbound, Xray stats API


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


app = FastAPI(title="Multi-location VPN panel", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    resp.headers.setdefault("Referrer-Policy", "no-referrer")
    return resp


def caddy_dir() -> str:
    return os.environ.get("PANEL_CADDY_DIR", "")


def admin_base() -> str:
    """"/secret" when the admin pages live under a secret path (panel Settings / installer), else ""."""
    cur = caddyfile.load(caddy_dir()) if caddy_dir() else {"path": None}
    if cur["path"]:
        return "/" + cur["path"]
    p = os.environ.get("PANEL_ADMIN_PATH", "")     # plain setups without the managed Caddy files
    return "/" + p if re.fullmatch(r"[A-Za-z0-9_-]{6,64}", p) else ""


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


def main_password_ok(db: Session, pw: str) -> bool:
    """The password set in the panel, or the one in .env. The .env one always works: it is the way back in after a
    forgotten password (whoever can read that file owns the server anyway)."""
    stored = get_setting(db, "admin_pw_hash")
    return (bool(stored) and check_pw(pw, stored)) or hmac.compare_digest(pw.encode(), admin_password().encode())


class AdminAccess(BaseModel):
    enabled: bool
    port: int | None = None
    path: str | None = None


def access_out() -> dict:
    cur = caddyfile.load(caddy_dir()) if caddy_dir() else {"port": None, "path": None}
    frm = os.environ.get("PANEL_FROM", "")
    return {"managed": bool(caddy_dir() and frm and os.access(caddy_dir(), os.W_OK)), "enabled": bool(cur["port"] and cur["path"]),
            "port": cur["port"], "path": cur["path"],
            "url": caddyfile.admin_url(frm, cur["port"], cur["path"]) if cur["port"] and cur["path"] and frm else "",
            "normal_url": public_url_from_env()}


def public_url_from_env() -> str:
    return os.environ.get("PANEL_PUBLIC_URL", "").rstrip("/")


@app.get("/api/settings", dependencies=[Depends(require_admin)])
def get_access():
    return access_out()


@app.put("/api/settings/admin-access", dependencies=[Depends(require_admin)])
def set_access(body: AdminAccess):
    """Where the login and admin pages live. Takes effect at once (Caddy reloads its Caddyfile by itself); the open
    page keeps working until reloaded, and the new port has to be open in the server's firewall."""
    out = access_out()
    if not out["managed"]:
        raise HTTPException(409, "این نصب هنوز به‌روز نشده؛ پنل را با دستور آپدیت یک بار به‌روز کنید")
    frm = os.environ["PANEL_FROM"]
    try:
        if body.enabled:
            caddyfile.write(caddy_dir(), frm, body.port, body.path)
        else:
            caddyfile.write(caddy_dir(), frm)
    except ValueError as e:
        raise HTTPException(422, str(e))
    return access_out()


class PasswordChange(BaseModel):
    current: str = Field(max_length=200)
    new: str = Field(min_length=8, max_length=200)


@app.post("/api/password")
def change_main_password(body: PasswordChange, authorization: str | None = Header(None), db: Session = Depends(get_db)):
    """The main admin changes the panel password from the panel (the one in .env keeps working as the recovery password)."""
    parsed = parse_token(_bearer(authorization))
    if not parsed or parsed[0] != "sudo":
        raise HTTPException(401, "نشست نامعتبر است")
    if not main_password_ok(db, body.current):
        time.sleep(1)
        raise HTTPException(403, "رمز فعلی اشتباه است")
    put_setting(db, "admin_pw_hash", hash_pw(body.new))
    db.commit()
    return {"ok": True}


def require_reseller(authorization: str | None = Header(None), db: Session = Depends(get_db)) -> Admin:
    parsed = parse_token(_bearer(authorization))
    admin = db.get(Admin, parsed[1]) if parsed and parsed[0] == "reseller" else None
    if not admin or not admin.enabled or admin.token_ver != parsed[2]:
        raise HTTPException(401, "نشست نامعتبر است")
    return admin


@app.post("/api/me/password")
def change_my_password(body: PasswordChange, admin: Admin = Depends(require_reseller), db: Session = Depends(get_db)):
    if not check_pw(body.current, admin.pw_hash):
        time.sleep(1)
        raise HTTPException(403, "رمز فعلی اشتباه است")
    admin.pw_hash = hash_pw(body.new)
    admin.token_ver += 1            # every other session of theirs ends; this one gets a fresh token
    db.commit()
    return {"ok": True, "token": make_token(admin)}


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
        ok = main_password_ok(db, body.password)
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
    have = {p.proto for p in node.protocols if not p.extra}
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
        "protocols": [{"id": p.id, "proto": p.proto, "enabled": p.enabled, "port": p.port, "host": p.host,
                       "label": p.label, "extra": p.extra, "fixed": PROTOCOLS[p.proto]["fixed_port"]}
                      for p in sorted(node.protocols, key=lambda x: (x.extra, x.id))],
        "install_command": f"bash <(curl -sL {url}/node-install.sh) --token {node.token} --address {node.address}"
                           + ("" if node.address.replace(".", "").isdigit() else " --letsencrypt"),
    }


USER_ONLINE_WINDOW = timedelta(minutes=3)   # a user counts as online if a node saw real traffic this recently
ONLINE_MIN_BYTES = 1024                # keep-alive chatter alone does not count


def entries_for(user: User, db: Session) -> list[dict]:
    return user_entries(user, list(db.scalars(select(Node).order_by(Node.id))), dnstt_info(db),
                        list(db.scalars(select(Tunnel).where(Tunnel.publish == True))))  # noqa: E712


def user_out(user: User, request: Request) -> dict:
    days_left = None
    if user.expire_at:
        days_left = max(0, (user.expire_at - utcnow()).days)
    return {
        "id": user.id, "name": user.name, "status": user.status(), "enabled": user.enabled,
        "used_gb": round(user.used_bytes / GB, 2), "quota_gb": round(user.quota_bytes / GB, 2),
        "days_left": days_left, "expire_at": user.expire_at.isoformat() + "Z" if user.expire_at else None, "protos": user.protos, "node_ids": user.node_ids, "owner_id": user.owner_id,
        "last_seen": user.last_seen.isoformat() + "Z" if user.last_seen else None,
        "online": bool(user.last_seen and utcnow() - user.last_seen < USER_ONLINE_WINDOW),
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
    np = primary_of(node, proto)
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
    np = primary_of(node, proto)
    np.host = body.host.lower()
    db.commit()
    return node_out(node, request)


XRAY_PROTOS = [k for k, v in PROTOCOLS.items() if v["engine"] == "xray"]   # only these can have additional copies
MAX_EXTRA = 8


def primary_of(node: Node, proto: str) -> NodeProtocol:
    return next((p for p in node.protocols if p.proto == proto and not p.extra), None) or _404()


def inst_tag(np: NodeProtocol) -> str:
    """Xray inbound tag: the protocol id for the main copy, `<proto>_x<id>` for additional ones."""
    return f"{np.proto}_x{np.id}" if np.extra else np.proto


def pick_port(node: Node, np: NodeProtocol, wanted: int | None) -> int:
    """A valid port for this copy: the wanted one, or (None) a random free one in the panel's range."""
    if PROTOCOLS[np.proto]["fixed_port"]:
        raise HTTPException(422, "پورت این پروتکل طبق استاندارد ثابت است")
    used = {p.port for p in node.protocols if p is not np}
    if wanted is None:
        free = [x for x in range(PORT_RANGE[0], PORT_RANGE[1] + 1) if x not in used and x not in RESERVED_PORTS]
        if not free:
            raise HTTPException(409, "پورت آزادی در بازه نمانده است")
        return secrets.choice(free)
    if wanted in RESERVED_PORTS and not (np.proto == "vless_raw" and wanted == 80):   # plain VLESS may take 80 like x-ui did
        raise HTTPException(422, f"پورت {wanted} رزرو است")
    if wanted in used:
        raise HTTPException(409, f"پورت {wanted} را ورودی دیگری در این نود استفاده می‌کند")
    return wanted


@app.put("/api/nodes/{node_id}/protocols/{proto}/port", dependencies=[Depends(require_admin)])
def set_port(node_id: int, proto: str, body: PortIn, request: Request, db: Session = Depends(get_db)):
    node = db.get(Node, node_id) or _404()
    np = primary_of(node, proto)
    np.port = pick_port(node, np, body.port)
    db.commit()
    return node_out(node, request)


class NpPatch(BaseModel):
    label: str | None = Field(default=None, max_length=40)           # the name users see (emoji welcome)
    enabled: bool | None = None
    port: int | None = Field(default=None, ge=1, le=65535)
    random_port: bool = False
    host: str | None = Field(default=None, pattern=r"^[A-Za-z0-9.\-]{0,253}$")   # "" = the location's address


@app.patch("/api/node-protocols/{np_id}", dependencies=[Depends(require_admin)])
def patch_node_protocol(np_id: int, body: NpPatch, request: Request, db: Session = Depends(get_db)):
    """Name, port, address and on/off of one entry of a location (the main copy of a protocol or an additional one)."""
    np = db.get(NodeProtocol, np_id) or _404()
    node = db.get(Node, np.node_id)
    if body.label is not None:
        np.label = body.label.strip()
    if body.host is not None:
        np.host = body.host.lower()
    if body.port is not None or body.random_port:
        np.port = pick_port(node, np, None if body.random_port else body.port)
    if body.enabled is not None:
        np.enabled = body.enabled
    db.commit()
    out = node_out(node, request)
    if np.proto == "dnstt" and body.enabled is not None and dnstt_conf(db)["token"]:
        out["dns"] = run_dns_sync(db)
    return out


@app.post("/api/nodes/{node_id}/protocols/{proto}/instances", dependencies=[Depends(require_admin)])
def add_instance(node_id: int, proto: str, request: Request, db: Session = Depends(get_db)):
    """An additional copy of an Xray protocol on this location: its own random free port, to be named and addressed."""
    node = db.get(Node, node_id) or _404()
    if proto not in XRAY_PROTOS:
        raise HTTPException(422, "فقط پروتکل‌های Xray نسخه‌ی اضافه می‌گیرند")
    if sum(1 for p in node.protocols if p.extra) >= MAX_EXTRA:
        raise HTTPException(409, f"حداکثر {MAX_EXTRA} نسخه‌ی اضافه برای هر لوکیشن")
    np = NodeProtocol(proto=proto, port=0, extra=True)
    node.protocols.append(np)
    np.port = pick_port(node, np, None)
    db.commit()
    return node_out(node, request)


@app.delete("/api/node-protocols/{np_id}", dependencies=[Depends(require_admin)])
def delete_instance(np_id: int, request: Request, db: Session = Depends(get_db)):
    np = db.get(NodeProtocol, np_id) or _404()
    if not np.extra:
        raise HTTPException(422, "نسخه‌ی اصلی حذف نمی‌شود؛ آن را خاموش کنید")
    node = db.get(Node, np.node_id)
    node.protocols.remove(np)
    db.delete(np)
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
    return {"inbound_ids": [{"id": i, "label": PROTOCOLS[i]["label"]} for i in routing.INBOUND_IDS]
                           + [{"id": inst_tag(p), "label": p.label or f"{PROTOCOLS[p.proto]['label']} (پورت {p.port})"}
                              for p in node.protocols if p.extra and p.enabled],
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
    return entries_for(user, db)


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
    max_total_gb: float = Field(ge=0, le=100000000, default=0)
    allowed_protos: list[str] = []
    allowed_nodes: list[int] = []
    can_delete: bool = False
    can_edit: bool = False


class AdminPatch(BaseModel):
    enabled: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    max_users: int | None = Field(default=None, ge=0, le=100000)
    max_quota_gb: float | None = Field(default=None, ge=0, le=1000000)
    max_days: int | None = Field(default=None, ge=0, le=3650)
    max_total_gb: float | None = Field(default=None, ge=0, le=100000000)
    allowed_protos: list[str] | None = None
    allowed_nodes: list[int] | None = None
    can_delete: bool | None = None
    can_edit: bool | None = None


def check_allowed(db: Session, protos: list[str] | None, nodes: list[int] | None) -> None:
    if protos and (bad := [p for p in protos if p not in PROTOCOLS]):
        raise HTTPException(422, f"پروتکل ناشناخته: {bad[0]}")
    if nodes and (bad := [i for i in nodes if i not in set(db.scalars(select(Node.id)))]):
        raise HTTPException(422, f"لوکیشن ناشناخته: {bad[0]}")


def admin_out(a: Admin, db: Session) -> dict:
    mine = list(db.scalars(select(User).where(User.owner_id == a.id)))
    return {"id": a.id, "username": a.username, "enabled": a.enabled, "max_users": a.max_users,
            "max_quota_gb": a.max_quota_gb, "max_days": a.max_days, "users": len(mine),
            "max_total_gb": a.max_total_gb, "allowed_protos": a.allowed_protos or [], "allowed_nodes": a.allowed_nodes or [],
            "active_users": sum(1 for u in mine if u.status() == "active"),
            "allocated_gb": round(sum(u.quota_bytes for u in mine) / GB, 2), "used_gb": round(sum(u.used_bytes for u in mine) / GB, 2),
            "can_delete": a.can_delete, "can_edit": a.can_edit}


@app.get("/api/admins", dependencies=[Depends(require_admin)])
def list_admins(db: Session = Depends(get_db)):
    return [admin_out(a, db) for a in db.scalars(select(Admin).order_by(Admin.id))]


@app.post("/api/admins", dependencies=[Depends(require_admin)])
def create_admin(body: AdminIn, db: Session = Depends(get_db)):
    if db.scalar(select(Admin).where(Admin.username == body.username)):
        raise HTTPException(409, "این نام کاربری ادمین وجود دارد")
    check_allowed(db, body.allowed_protos, body.allowed_nodes)
    a = Admin(username=body.username, pw_hash=hash_pw(body.password), max_users=body.max_users,
              max_quota_gb=body.max_quota_gb, max_days=body.max_days, can_delete=body.can_delete, can_edit=body.can_edit,
              max_total_gb=body.max_total_gb, allowed_protos=body.allowed_protos, allowed_nodes=body.allowed_nodes)
    db.add(a)
    db.commit()
    return admin_out(a, db)


@app.patch("/api/admins/{admin_id}", dependencies=[Depends(require_admin)])
def patch_admin(admin_id: int, body: AdminPatch, db: Session = Depends(get_db)):
    a = db.get(Admin, admin_id) or _404()
    if body.enabled is not None:
        a.enabled = body.enabled
    check_allowed(db, body.allowed_protos, body.allowed_nodes)
    for f in ("max_users", "max_quota_gb", "max_days", "max_total_gb", "allowed_protos", "allowed_nodes", "can_delete", "can_edit"):
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
    return {"role": "reseller", "username": a.username, **{k: v for k, v in admin_out(a, db).items() if k in ("max_users", "max_quota_gb", "max_days", "users", "can_delete", "can_edit", "max_total_gb", "allocated_gb", "allowed_protos", "allowed_nodes")}}


@app.get("/api/me/options")
def me_options(admin: Admin = Depends(require_reseller), db: Session = Depends(get_db)):
    return {"protocols": [{"id": k, "label": v["label"], "counted": v["counted"]} for k, v in PROTOCOLS.items()
                          if not admin.allowed_protos or k in admin.allowed_protos],
            "nodes": [{"id": n.id, "cc": n.cc, "name": n.name} for n in db.scalars(select(Node).order_by(Node.id))
                      if not admin.allowed_nodes or n.id in admin.allowed_nodes]}


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
    if admin.allowed_protos and (bad := [p for p in body.protos if p not in admin.allowed_protos]):
        raise HTTPException(403, f"این پروتکل برای شما مجاز نیست: {bad[0]}")
    known = set(db.scalars(select(Node.id)))
    body.node_ids = [i for i in body.node_ids if i in known]
    if admin.allowed_nodes:
        if bad := [i for i in body.node_ids if i not in admin.allowed_nodes]:
            raise HTTPException(403, "این لوکیشن برای شما مجاز نیست")
        body.node_ids = body.node_ids or list(admin.allowed_nodes)   # "all locations" means all the ones they may use
    if admin.max_total_gb:
        if body.quota_gb <= 0:
            raise HTTPException(422, "با سقف کل حجم، کاربر بدون محدودیت حجم نمی‌شود ساخت")
        left = admin.max_total_gb - allocated_gb(db, admin)
        if body.quota_gb > left + 1e-9:
            raise HTTPException(403, f"سقف کل حجم شما کم است؛ {max(0, left):.2f} گیگابایت باقی مانده")
    return user_out(new_user(db, body, admin), request)


def allocated_gb(db: Session, admin: Admin) -> float:
    """Volume already handed to the admin's users (what counts against their pool)."""
    return sum(u.quota_bytes for u in db.scalars(select(User).where(User.owner_id == admin.id))) / GB


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
    if admin.max_total_gb and body.quota_gb is not None:
        if body.quota_gb <= 0:
            raise HTTPException(422, "با سقف کل حجم، کاربر بدون محدودیت حجم نمی‌شود")
        left = admin.max_total_gb - allocated_gb(db, admin) + user.quota_bytes / GB    # the user's own volume is handed back first
        if body.quota_gb > left + 1e-9:
            raise HTTPException(403, f"سقف کل حجم شما کم است؛ برای این کاربر حداکثر {max(0, left):.2f} گیگابایت می‌شود")
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
    return entries_for(user, db)


# ---------- subscription (public, token in URL) ----------
@app.get("/sub/{token}")
def subscription(token: str, request: Request, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.sub_token == token)) or _404()
    entries = entries_for(user, db) if user.status() == "active" else []
    days_left = max(0, (user.expire_at - utcnow()).days) if user.expire_at else None
    if "text/html" in request.headers.get("accept", ""):  # a person in a browser, not a client app
        return HTMLResponse(render_sub_page(user, entries, days_left, f"{public_url(request)}/sub/{token}", get_brand(db),
                                         os.environ.get("PANEL_SUPPORT_URL", "")))
    info = info_entries(user, days_left) if os.environ.get("PANEL_SUB_INFO", "1") != "0" else []
    headers = {"subscription-userinfo": f"upload=0; download={user.used_bytes}; total={user.quota_bytes}; "
               f"expire={int(user.expire_at.timestamp()) if user.expire_at else 0}",
               "profile-title": "base64:" + base64.b64encode(user.name.encode()).decode(),
               "profile-update-interval": "6"}
    if url := os.environ.get("PANEL_SUPPORT_URL"):
        headers["support-url"] = url
    links = info + [e["link"] for e in entries if e["link"]]
    return PlainTextResponse(base64.b64encode("\n".join(links).encode()).decode(), headers=headers)


@app.get("/sub/{token}/qr.svg")
def subscription_qr(token: str, i: int = -1, request: Request = None, db: Session = Depends(get_db)):
    """QR code (SVG) of the subscription link (i=-1) or of the i-th config on the user's page."""
    import segno
    user = db.scalar(select(User).where(User.sub_token == token)) or _404()
    if user.status() != "active":
        _404()
    text = f"{public_url(request)}/sub/{token}"
    if i >= 0:
        entries = entries_for(user, db)
        text = qr_text(entries[i]) if i < len(entries) else None
        if not text:
            _404()
    buf = io.BytesIO()   # standalone SVG: it needs the xmlns, or <img> refuses to draw it
    segno.make(text, error="l").save(buf, kind="svg", scale=4, border=2, dark="#000", light="#fff", xmldecl=False, svgns=True)
    return Response(buf.getvalue(), media_type="image/svg+xml", headers={"Cache-Control": "private, max-age=300"})


@app.get("/sub/{token}/file/{node_id}/{proto}")
def subscription_file(token: str, node_id: int, proto: str, db: Session = Depends(get_db)):
    """The WireGuard .conf / OpenVPN .ovpn file for one location, for clients that import a file."""
    user = db.scalar(select(User).where(User.sub_token == token)) or _404()
    if user.status() == "active":
        for e in entries_for(user, db):
            text = (e["details"] or {}).get("config")
            if e["node_id"] == node_id and e["proto"] == proto and text and e["file_ext"]:
                slug = re.sub(r"[^A-Za-z0-9]+", "-", e["node"]).strip("-") or f"node{node_id}"
                headers = {"Content-Disposition": f'attachment; filename="{slug}-{proto}.{e["file_ext"]}"',
                           "Cache-Control": "no-store"}
                return PlainTextResponse(text, headers=headers, media_type="application/octet-stream")
    _404()


# ---------- tunnels (Iran side <-> foreign node) ----------
TUNNEL_FRESH = 120   # seconds: an end that reported this recently counts as online


def parse_forwards(text: str) -> list[dict]:
    """"80, 81=80, udp:5000, 2000-2005" -> [{"proto","listen","target"}]; 2000-2005 forwards each port to itself."""
    out, seen = [], set()
    for tok in re.split(r"[\s,;]+", text.strip()):
        if not tok:
            continue
        m = re.fullmatch(r"(?:(tcp|udp):)?(\d{1,5})(?:-(\d{1,5}))?(?:=(\d{1,5}))?", tok)
        if not m or (m.group(3) and m.group(4)):
            raise HTTPException(422, f"پورت نامعتبر: {tok}  (نمونه: 80  یا  81=80  یا  udp:5000  یا  2000-2005)")
        proto, lo = m.group(1) or "tcp", int(m.group(2))
        hi = int(m.group(3) or lo)
        if not (1 <= lo <= hi <= 65535) or hi - lo > 200:
            raise HTTPException(422, f"بازه‌ی پورت نامعتبر: {tok}")
        for port in range(lo, hi + 1):
            target = int(m.group(4)) if m.group(4) else port
            if not 1 <= target <= 65535:
                raise HTTPException(422, f"پورت مقصد نامعتبر: {tok}")
            if (proto, port) in seen:
                raise HTTPException(422, f"پورت تکراری: {proto}:{port}")
            seen.add((proto, port))
            out.append({"proto": proto, "listen": port, "target": target})
    if not out:
        raise HTTPException(422, "حداقل یک پورت بدهید")
    if len(out) > 300:
        raise HTTPException(422, "حداکثر ۳۰۰ پورت")
    return out


def forwards_text(forwards: list[dict]) -> str:
    return ", ".join(("udp:" if f["proto"] == "udp" else "") + str(f["listen"]) + (f"={f['target']}" if f["target"] != f["listen"] else "")
                     for f in forwards)


def fresh(ts) -> bool:
    return bool(ts and (utcnow() - ts).total_seconds() < TUNNEL_FRESH)


TEST_SECONDS, TEST_LEAD = 90, 50       # a connection test lasts this long and starts this many seconds after the request
TEST_FIELDS = {"ok": bool, "error": str, "connect_ms": (int, float), "rtt_ms": (int, float), "down_mbps": (int, float),
               "up_mbps": (int, float), "udp_loss_pct": (int, float), "udp_rtt_ms": (int, float)}


def clean_result(res) -> dict:
    return {k: (v[:80] if isinstance(v, str) else v) for k, v in (res or {}).items()
            if k in TEST_FIELDS and isinstance(v, TEST_FIELDS[k]) and (k == "ok" or not isinstance(v, bool))} if isinstance(res, dict) else {}


def test_state(t: Tunnel) -> dict | None:
    tt = t.test or {}
    if not tt.get("id"):
        return None
    now = time.time()
    both = tt.get("iran") is not None and tt.get("node") is not None
    status = "done" if both else "running" if now < tt["start_at"] + tt["seconds"] + 60 else "timeout"
    return {"status": status, "port": tt["port"], "start_at": tt["start_at"], "iran": tt.get("iran"), "node": tt.get("node")}


def test_job(t: Tunnel, side: str, peer: str) -> dict | None:
    """What an agent on `side` ("iran" / "node") must run now, or None (no test, already reported, or too late)."""
    tt = t.test or {}
    now = time.time()
    if not tt.get("id") or tt.get(side) is not None or not tt["start_at"] - 90 < now < tt["start_at"] + tt["seconds"] + 30:
        return None
    return {"id": tt["id"], "peer": peer, "port": tt["port"], "token": tt["token"], "start_at": tt["start_at"], "seconds": tt["seconds"]}


def store_test_result(t: Tunnel, side: str, body) -> None:
    tt = dict(t.test or {})
    if isinstance(body, dict) and tt.get("id") and body.get("id") == tt["id"] and tt.get(side) is None:
        tt[side] = clean_result(body.get("result")) or {"ok": False, "error": "no result"}
        t.test = tt


def tunnel_out(t: Tunnel, db: Session, request: Request) -> dict:
    node = db.get(Node, t.node_id)
    relay_on, client_on = fresh(t.relay_seen), fresh(t.client_seen)
    rs, cs = (t.relay_state or {}), (t.client_state or {})
    pool = int(rs.get("pool", 0)) if relay_on else 0
    if not t.enabled:
        status = "off"
    elif not relay_on:
        status = "wait_iran"
    elif pool > 0:
        status = "up"
    else:
        status = "wait_client"
    problems = list(rs.get("errors", [])) if relay_on else []
    problems += [f"روی سرور ایران باز نشد: {p}" for p in rs.get("failed", [])] if relay_on else []
    if client_on and cs.get("down"):
        problems.append("روی سرور خارج چیزی روی این پورت‌ها گوش نمی‌دهد: " + ", ".join(map(str, cs["down"])))
    problems += list(cs.get("errors", [])) if client_on else []
    return {"id": t.id, "name": t.name, "iran_host": t.iran_host, "node_id": t.node_id, "node_name": node.name if node else "؟",
            "ctl_port": t.ctl_port, "forwards": t.forwards, "ports": forwards_text(t.forwards), "enabled": t.enabled, "publish": t.publish, "encrypt": t.encrypt, "mode": t.mode,
            "test": test_state(t), "status": status, "pool": pool, "iran_online": relay_on, "node_online": client_on, "problems": problems,
            "install_command": f"bash <(curl -fsSL {public_url(request)}/relay-install.sh) --token {t.relay_token}"}


class TunnelIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    iran_host: str = Field(min_length=1, max_length=253)
    node_id: int
    ports: str = Field(max_length=4000)
    publish: bool = True
    encrypt: Literal["off", "tcp", "all"] = "off"
    mode: Literal["reverse", "direct"] = "reverse"


class TunnelPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    iran_host: str | None = Field(default=None, min_length=1, max_length=253)
    ports: str | None = Field(default=None, max_length=4000)
    enabled: bool | None = None
    publish: bool | None = None
    encrypt: Literal["off", "tcp", "all"] | None = None
    mode: Literal["reverse", "direct"] | None = None


def clean_host(host: str) -> str:
    host = host.strip()
    if not re.fullmatch(r"[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?", host):
        raise HTTPException(422, "آدرس ایران باید IP یا دامنه باشد")
    return host


@app.get("/api/tunnels", dependencies=[Depends(require_admin)])
def list_tunnels(request: Request, db: Session = Depends(get_db)):
    return [tunnel_out(t, db, request) for t in db.scalars(select(Tunnel).order_by(Tunnel.id))]


def free_ctl_port(db: Session, host: str, node_id: int, taken: set, exclude: int | None = None) -> int:
    """A control port nobody else uses on either server: tunnels of the same Iran address (reverse mode listens there) and of the
    same foreign location (direct mode listens there) must not share one."""
    used = {t.ctl_port for t in db.scalars(select(Tunnel).where((Tunnel.iran_host == host) | (Tunnel.node_id == node_id))) if t.id != exclude}
    return next(p for p in range(7777, 7977) if p not in used and p not in taken)


@app.post("/api/tunnels", dependencies=[Depends(require_admin)])
def create_tunnel(body: TunnelIn, request: Request, db: Session = Depends(get_db)):
    if not db.get(Node, body.node_id):
        raise HTTPException(404, "لوکیشن خارج پیدا نشد")
    host, forwards = clean_host(body.iran_host), parse_forwards(body.ports)
    ctl = free_ctl_port(db, host, body.node_id, {f["listen"] for f in forwards})
    t = Tunnel(name=body.name.strip(), iran_host=host, node_id=body.node_id, ctl_port=ctl, forwards=forwards,
               token=secrets.token_hex(16), relay_token=secrets.token_urlsafe(24), publish=body.publish, encrypt=body.encrypt, mode=body.mode)
    db.add(t)
    db.commit()
    return tunnel_out(t, db, request)


@app.patch("/api/tunnels/{tunnel_id}", dependencies=[Depends(require_admin)])
def patch_tunnel(tunnel_id: int, body: TunnelPatch, request: Request, db: Session = Depends(get_db)):
    t = db.get(Tunnel, tunnel_id) or _404()
    if body.name is not None:
        t.name = body.name.strip()
    if body.iran_host is not None:
        t.iran_host = clean_host(body.iran_host)
    if body.ports is not None:
        t.forwards = parse_forwards(body.ports)
        if t.ctl_port in {f["listen"] for f in t.forwards}:
            raise HTTPException(422, f"پورت {t.ctl_port} برای خود تونل رزرو است")
    if body.enabled is not None:
        t.enabled = body.enabled
    if body.publish is not None:
        t.publish = body.publish
    if body.encrypt is not None:
        t.encrypt = body.encrypt
    if body.mode is not None:
        t.mode = body.mode
    if body.mode is not None or body.iran_host is not None:       # the port must stay free on the server that listens
        t.ctl_port = free_ctl_port(db, t.iran_host, t.node_id, {f["listen"] for f in t.forwards} | {t.ctl_port}, exclude=t.id) \
            if db.scalar(select(Tunnel.id).where(Tunnel.id != t.id, Tunnel.ctl_port == t.ctl_port, (Tunnel.iran_host == t.iran_host) | (Tunnel.node_id == t.node_id))) else t.ctl_port
    db.commit()
    return tunnel_out(t, db, request)


@app.post("/api/tunnels/{tunnel_id}/test", dependencies=[Depends(require_admin)])
def start_tunnel_test(tunnel_id: int, request: Request, db: Session = Depends(get_db)):
    """Both ends listen and dial on one test port for ~90 s; the result says which direction works, with delay and speed."""
    t = db.get(Tunnel, tunnel_id) or _404()
    cur = test_state(t)
    if cur and cur["status"] == "running":
        raise HTTPException(409, "یک تست در حال انجام است؛ چند دقیقه صبر کنید")
    if not fresh(t.relay_seen):
        raise HTTPException(409, "سرور ایران هنوز به پنل وصل نیست؛ اول دستور نصب را روی آن اجرا کنید")
    taken = {f["listen"] for f in t.forwards} | {t.ctl_port}
    port = next(p for p in random.sample(range(7900, 8000), 100) if p not in taken)
    t.test = {"id": int(time.time()), "port": port, "token": secrets.token_hex(16), "start_at": int(time.time()) + TEST_LEAD,
              "seconds": TEST_SECONDS, "iran": None, "node": None}
    db.commit()
    return tunnel_out(t, db, request)


@app.delete("/api/tunnels/{tunnel_id}", dependencies=[Depends(require_admin)])
def delete_tunnel(tunnel_id: int, db: Session = Depends(get_db)):
    db.delete(db.get(Tunnel, tunnel_id) or _404())
    db.commit()
    return {"ok": True}


def require_relay(authorization: str | None = Header(None), db: Session = Depends(get_db)) -> Tunnel:
    token = (authorization or "").removeprefix("Bearer ").strip()
    t = db.scalar(select(Tunnel).where(Tunnel.relay_token == token)) if token else None
    if not t:
        raise HTTPException(401, "توکن تونل نامعتبر است")
    return t


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require_relay_any(authorization: str | None = Header(None), db: Session = Depends(get_db)):
    """The agent on an Iran server signs in with the token of one tunnel: one of the panel's own tunnels or a BackPack tunnel."""
    token = (authorization or "").removeprefix("Bearer ").strip()
    t = (db.scalar(select(Tunnel).where(Tunnel.relay_token == token)) or db.scalar(select(BpTunnel).where(BpTunnel.relay_token == token))) if token else None
    if not t:
        raise HTTPException(401, "توکن تونل نامعتبر است")
    return t


@app.get("/api/relay/config")
def relay_config(t=Depends(require_relay_any), db: Session = Depends(get_db)):
    node = db.get(Node, t.node_id)
    if isinstance(t, BpTunnel):
        return {"engine": "backpack", "tunnel": {"id": f"bp{t.id}", "name": t.name, "enabled": t.enabled},
                "bp": {"id": str(t.id), "toml": bpmod.render(t, "iran", t.iran_host, node.address if node else ""),
                       "ping": bpmod.net_addrs(t.net_n)[1] if t.kind == "direct" else "", "sha256": bpmod.BP_SHA256},
                "vtunnel_sha256": _sha(ROOT / "agent" / "vtunnel.py"), "agent_sha256": _sha(ROOT / "agent" / "relay_agent.py")}
    return {"test": test_job(t, "iran", node.address) if node else None,
            "tunnel": {"id": t.id, "name": t.name, "enabled": t.enabled, "ctl_port": t.ctl_port, "token": t.token, "forwards": t.forwards, "encrypt": t.encrypt,
                       "mode": t.mode, "dial": f"{node.address}:{t.ctl_port}" if node else ""},
            "vtunnel_sha256": _sha(ROOT / "agent" / "vtunnel.py"), "agent_sha256": _sha(ROOT / "agent" / "relay_agent.py")}


class RelayReport(BaseModel):
    pool: int = Field(default=0, ge=0, le=100000)
    udp_client: bool = False
    failed: list[str] = Field(default=[], max_length=300)
    errors: list[str] = Field(default=[], max_length=20)
    test: dict | None = None      # {"id": ..., "result": {...}} of a connection test this side ran
    bp: dict | None = None        # BackPack tunnel: {"active", "up", "line", "errors"}


@app.post("/api/relay/report")
def relay_report(body: RelayReport, t=Depends(require_relay_any), db: Session = Depends(get_db)):
    if isinstance(t, BpTunnel):
        t.relay_seen = utcnow()
        t.relay_state = bp_state(body.bp)
        db.commit()
        return {"ok": True}
    t.relay_seen = utcnow()
    t.relay_state = {"pool": body.pool, "udp_client": body.udp_client, "failed": [f[:30] for f in body.failed],
                     "errors": [e[:200] for e in body.errors]}
    store_test_result(t, "iran", body.test)
    db.commit()
    return {"ok": True}


@app.get("/relay/agent.py")
def relay_agent_script():
    return PlainTextResponse((ROOT / "agent" / "relay_agent.py").read_text())


@app.get("/relay-install.sh")
def relay_install(request: Request):
    script = (ROOT / "agent" / "relay-install.sh").read_text().replace("__PANEL_URL__", public_url(request))
    return Response(script, media_type="text/x-shellscript")


# ---------- BackPack tunnels (managed by the panel, separate from the panel's own tunnels) ----------
def bp_state(raw) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    return {"active": bool(raw.get("active")), "up": bool(raw.get("up")), "line": str(raw.get("line", ""))[:160],
            "errors": [str(e)[:200] for e in (raw.get("errors") or [])[:5]] if isinstance(raw.get("errors"), list) else []}


def bp_out(t: BpTunnel, db: Session, request: Request) -> dict:
    node = db.get(Node, t.node_id)
    iran_on, node_on = fresh(t.relay_seen), fresh(t.client_seen)
    rs, cs = (t.relay_state or {}) if iran_on else {}, (t.client_state or {}) if node_on else {}
    if not t.enabled:
        status = "off"
    elif not iran_on:
        status = "wait_iran"
    elif not node_on:
        status = "wait_node"
    elif rs.get("up") and cs.get("up"):
        status = "up"
    else:
        status = "starting"
    problems = [e for st in (rs, cs) for e in st.get("errors", [])]
    for side, st in (("ایران", rs), ("خارج", cs)):
        if st and not st.get("active") and t.enabled:
            problems.append(f"سرویس بک‌پک روی سرور {side} اجرا نمی‌شود")
    return {"id": t.id, "name": t.name, "kind": t.kind, "transport": t.transport, "label": bpmod.describe(t), "iran_host": t.iran_host,
            "node_id": t.node_id, "node_name": node.name if node else "؟", "port": t.port, "forwards": t.forwards,
            "ports": forwards_text(t.forwards), "accept_udp": t.accept_udp, "fallbacks": t.fallbacks, "fec_data": t.fec_data,
            "fec_parity": t.fec_parity, "enabled": t.enabled, "status": status, "iran": rs or None, "node": cs or None, "problems": problems,
            "net": list(bpmod.net_addrs(t.net_n)) if t.kind == "direct" else None,
            "install_command": f"bash <(curl -fsSL {public_url(request)}/relay-install.sh) --token {t.relay_token}"}


class BpIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    kind: Literal["reverse", "direct"] = "reverse"
    transport: str = Field(max_length=20)
    iran_host: str = Field(min_length=1, max_length=253)
    node_id: int
    ports: str = Field(default="", max_length=4000)
    accept_udp: bool = False
    fallbacks: list[str] = Field(default=[], max_length=11)
    fec_data: int = Field(default=0, ge=0, le=30)
    fec_parity: int = Field(default=0, ge=0, le=30)


class BpPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    transport: str | None = Field(default=None, max_length=20)
    iran_host: str | None = Field(default=None, min_length=1, max_length=253)
    ports: str | None = Field(default=None, max_length=4000)
    accept_udp: bool | None = None
    fallbacks: list[str] | None = Field(default=None, max_length=11)
    fec_data: int | None = Field(default=None, ge=0, le=30)
    fec_parity: int | None = Field(default=None, ge=0, le=30)
    enabled: bool | None = None


def bp_check(kind: str, transport: str, fallbacks: list[str], fec_data: int, fec_parity: int) -> None:
    allowed = bpmod.TRANSPORTS if kind == "reverse" else bpmod.CARRIERS
    if transport not in allowed:
        raise HTTPException(422, "نوع حمل نامعتبر است")
    if kind == "reverse" and (bad := [f for f in fallbacks if f not in bpmod.TRANSPORTS or f == transport]):
        raise HTTPException(422, f"نوع جایگزین نامعتبر: {bad[0]}")
    if bool(fec_data) != bool(fec_parity):
        raise HTTPException(422, "اصلاح خطا (FEC) را با هر دو عدد داده و توازن بدهید، یا هر دو را صفر بگذارید")


def bp_forwards(kind: str, ports: str) -> list[dict]:
    return [] if kind == "direct" and not ports.strip() else parse_forwards(ports)


def free_bp_port(db: Session, kind: str, host: str, node_id: int, taken: set, exclude: int | None = None) -> int:
    """A tunnel port nobody else uses on the server that listens: the Iran server for a reverse tunnel, the foreign one for a direct tunnel."""
    col = BpTunnel.iran_host == host if kind == "reverse" else BpTunnel.node_id == node_id
    vcol = Tunnel.iran_host == host if kind == "reverse" else Tunnel.node_id == node_id
    used = {t.port for t in db.scalars(select(BpTunnel).where(col, BpTunnel.kind == kind)) if t.id != exclude}
    used |= {t.ctl_port for t in db.scalars(select(Tunnel).where(vcol))}
    return next(p for p in range(9100, 9900) if p not in used and p not in taken)


@app.get("/api/bp/meta", dependencies=[Depends(require_admin)])
def bp_meta():
    return {"version": bpmod.BP_VERSION,
            "transports": [{"id": k, "label": v[0], "family": v[1], "desc": v[2], "raw": k in bpmod.NEEDS_RAW} for k, v in bpmod.TRANSPORTS.items()],
            "carriers": [{"id": k, "label": v[0], "desc": v[1], "raw": k in bpmod.NEEDS_RAW} for k, v in bpmod.CARRIERS.items()]}


@app.get("/api/bp", dependencies=[Depends(require_admin)])
def list_bp(request: Request, db: Session = Depends(get_db)):
    return [bp_out(t, db, request) for t in db.scalars(select(BpTunnel).order_by(BpTunnel.id))]


@app.post("/api/bp", dependencies=[Depends(require_admin)])
def create_bp(body: BpIn, request: Request, db: Session = Depends(get_db)):
    if not db.get(Node, body.node_id):
        raise HTTPException(404, "لوکیشن خارج پیدا نشد")
    bp_check(body.kind, body.transport, body.fallbacks, body.fec_data, body.fec_parity)
    host, forwards = clean_host(body.iran_host), bp_forwards(body.kind, body.ports)
    net_n = 0
    if body.kind == "direct":
        used = {t.net_n for t in db.scalars(select(BpTunnel).where(BpTunnel.kind == "direct"))}
        net_n = next((n for n in range(1, 251) if n not in used), 0)
        if not net_n:
            raise HTTPException(409, "شبکه‌ی خصوصی آزاد برای تونل مستقیم نمانده")
    t = BpTunnel(name=body.name.strip(), kind=body.kind, transport=body.transport, iran_host=host, node_id=body.node_id, forwards=forwards,
                 port=free_bp_port(db, body.kind, host, body.node_id, {f["listen"] for f in forwards}), token=bpmod.new_token(),
                 relay_token=secrets.token_urlsafe(24), accept_udp=body.accept_udp, fallbacks=body.fallbacks if body.kind == "reverse" else [],
                 fec_data=body.fec_data, fec_parity=body.fec_parity, net_n=net_n)
    db.add(t)
    db.commit()
    return bp_out(t, db, request)


@app.patch("/api/bp/{bp_id}", dependencies=[Depends(require_admin)])
def patch_bp(bp_id: int, body: BpPatch, request: Request, db: Session = Depends(get_db)):
    t = db.get(BpTunnel, bp_id) or _404()
    transport = body.transport if body.transport is not None else t.transport
    fallbacks = body.fallbacks if body.fallbacks is not None else t.fallbacks
    fd = body.fec_data if body.fec_data is not None else t.fec_data
    fp = body.fec_parity if body.fec_parity is not None else t.fec_parity
    bp_check(t.kind, transport, fallbacks, fd, fp)
    if body.name is not None:
        t.name = body.name.strip()
    if body.iran_host is not None:
        t.iran_host = clean_host(body.iran_host)
    if body.ports is not None:
        t.forwards = bp_forwards(t.kind, body.ports)
        if t.port in {f["listen"] for f in t.forwards}:
            raise HTTPException(422, f"پورت {t.port} برای خود تونل رزرو است")
    if body.accept_udp is not None:
        t.accept_udp = body.accept_udp
    if body.enabled is not None:
        t.enabled = body.enabled
    t.transport, t.fallbacks, t.fec_data, t.fec_parity = transport, (fallbacks if t.kind == "reverse" else []), fd, fp
    db.commit()
    return bp_out(t, db, request)


@app.delete("/api/bp/{bp_id}", dependencies=[Depends(require_admin)])
def delete_bp(bp_id: int, db: Session = Depends(get_db)):
    db.delete(db.get(BpTunnel, bp_id) or _404())
    db.commit()
    return {"ok": True}


def bp_cache_dir() -> Path:
    return Path(os.environ.get("PANEL_BP_CACHE", "/data/bp"))


@app.get("/backpack/linux-{arch}.tar.gz")
def backpack_binary(arch: str):
    """The pinned BackPack release, downloaded once from GitHub (checked against its pinned SHA-256) and handed to the servers."""
    import urllib.request
    if arch not in bpmod.BP_SHA256:
        _404()
    path = bp_cache_dir() / f"backpack_{bpmod.BP_VERSION}_{arch}.tar.gz"
    if not path.exists():
        try:
            with urllib.request.urlopen(bpmod.BP_URL.format(version=bpmod.BP_VERSION, arch=arch), timeout=120) as r:
                data = r.read()
        except Exception:
            raise HTTPException(502, "دانلود بک‌پک از GitHub ممکن نشد")
        if hashlib.sha256(data).hexdigest() != bpmod.BP_SHA256[arch]:
            raise HTTPException(502, "فایل دانلودشده با هش ثبت‌شده نمی‌خواند؛ نصب نمی‌شود")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.with_suffix(".tmp").write_bytes(data)
        path.with_suffix(".tmp").replace(path)
    return Response(path.read_bytes(), media_type="application/gzip")


# ---------- node agent API ----------
@app.get("/api/node/config")
def node_config(node: Node = Depends(require_node), db: Session = Depends(get_db)):
    enabled = {p.proto: p.port for p in node.protocols if p.enabled and not p.extra}
    served = {p.proto for p in node.protocols if p.enabled}   # a user needs an account while any copy of the protocol runs
    extra = [{"proto": p.proto, "port": p.port, "tag": inst_tag(p)} for p in node.protocols if p.enabled and p.extra]
    dc = dnstt_conf(db)
    tunnels = [{"id": t.id, "server": f"{t.iran_host}:{t.ctl_port}", "token": t.token, "pool": 8, "encrypt": t.encrypt, "mode": t.mode, "listen": t.ctl_port, "test": test_job(t, "node", t.iran_host),
                "targets": sorted({f["target"] for f in t.forwards if f["proto"] == "tcp"})}
               for t in db.scalars(select(Tunnel).where(Tunnel.node_id == node.id, Tunnel.enabled == True))]  # noqa: E712
    users = []
    for u in db.scalars(select(User).order_by(User.id)):
        if u.status() != "active" or (u.node_ids and node.id not in u.node_ids):
            continue
        protos = [p for p in u.protos if p in served]
        if protos:
            users.append({"name": u.name, "uuid": u.uuid, "password": u.password,
                          "ss_key": user_ss_key(u.uuid), "wg_pub": u.wg_public,
                          "wg_ip": wg_ip(u.id), "protos": protos})
    agent_sha = hashlib.sha256((ROOT / "agent" / "agent.py").read_bytes()).hexdigest()
    outbounds, rules = routing.node_routing(node.outbounds, node.rules)
    return {"agent_sha256": agent_sha, "outbounds": outbounds, "rules": rules,
            "node": {"name": node.name, "reality_sni": node.reality_sni or REALITY_SNI, "ss_method": SS_METHOD,
                     "ss_key": node.ss_key, "l2tp_psk": node.l2tp_psk},
            "protocols": enabled, "extra": extra, "users": users, "tunnels": tunnels,
            "keys": node.keys if isinstance(node.keys, dict) else {},
            "vtunnel_sha256": _sha(ROOT / "agent" / "vtunnel.py"),
            "bp": [{"id": str(t.id), "toml": bpmod.render(t, "node", t.iran_host, node.address),
                    "ping": bpmod.net_addrs(t.net_n)[0] if t.kind == "direct" else ""}
                   for t in db.scalars(select(BpTunnel).where(BpTunnel.node_id == node.id, BpTunnel.enabled == True))],  # noqa: E712
            "bp_sha256": bpmod.BP_SHA256,
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
    bp: dict[str, dict] = Field(default={}, max_length=100)        # BackPack tunnel id -> {"active", "up", "line", "errors"}
    keys: dict[str, dict[str, str]] = Field(default={}, max_length=4)   # {"reality": {private, public, short_id}, "wg": {private, public}}
    tunnels: dict[str, dict] = Field(default={}, max_length=100)   # tunnel id -> {"active": bool, "down": [ports], "errors": [..]}
    dnstt_priv: str = Field(default="", max_length=200, pattern=r"^[0-9a-fA-F]*$")   # set only by the node that generated the key pair
    dnstt_pub: str = Field(default="", max_length=200, pattern=r"^[0-9a-fA-F]*$")


KEY_FIELDS = {"reality": {"private", "public", "short_id"}, "wg": {"private", "public"}}


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
    kept = dict(node.keys) if isinstance(node.keys, dict) else {}
    for name, fields in body.keys.items():      # the first key pair of each kind wins; a replacement server adopts it
        if name in KEY_FIELDS and name not in kept and set(fields) == KEY_FIELDS[name] and all(0 < len(v) <= 200 for v in fields.values()):
            kept[name] = fields
    if kept != node.keys:
        node.keys = kept
    if body.dnstt_priv and body.dnstt_pub and not get_setting(db, "dnstt_priv"):   # the first key pair wins; nodes then adopt it
        put_setting(db, "dnstt_priv", body.dnstt_priv)
        put_setting(db, "dnstt_pub", body.dnstt_pub)
    for bid, st in body.bp.items():
        bt = db.get(BpTunnel, int(bid)) if bid.isdigit() else None
        if bt and bt.node_id == node.id:
            bt.client_seen, bt.client_state = utcnow(), bp_state(st)
    for tid, st in body.tunnels.items():
        t = db.get(Tunnel, int(tid)) if tid.isdigit() else None
        if t and t.node_id == node.id:
            t.client_seen = utcnow()
            store_test_result(t, "node", st.get("test"))
            t.client_state = {"active": bool(st.get("active")), "down": [int(p) for p in st.get("down", [])[:50] if isinstance(p, int)],
                              "errors": [str(e)[:200] for e in st.get("errors", [])[:5]]}
    if body.usage:
        for u in db.scalars(select(User).where(User.name.in_(body.usage))):
            u.used_bytes += max(0, body.usage[u.name])
            if body.usage[u.name] >= ONLINE_MIN_BYTES:
                u.last_seen = utcnow()
    db.commit()
    return {"ok": True}


# ---------- node install assets ----------
@app.get("/node/agent.py")
def agent_py():
    return FileResponse(ROOT / "agent" / "agent.py", media_type="text/x-python")


@app.get("/vtunnel.py")
def vtunnel_script():
    """The standalone tunnel program (public, no secrets in it): curl it onto the two servers of a tunnel."""
    return PlainTextResponse((ROOT / "agent" / "vtunnel.py").read_text())


@app.get("/node-install.sh")
def node_install(request: Request):
    script = (ROOT / "agent" / "install.sh").read_text().replace("__PANEL_URL__", public_url(request))
    return Response(script, media_type="text/x-shellscript")


def _404():
    raise HTTPException(404, "پیدا نشد")


def _accent_style(hex_color: str) -> str:
    """The same inline CSS variables app.js sets, so the first paint already has the panel's colour."""
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", hex_color or ""):
        return ""
    r, g, b = (int(hex_color[i:i + 2], 16) for i in (1, 3, 5))
    fg = "#06121a" if 0.299 * r + 0.587 * g + 0.114 * b > 150 else "#ffffff"
    return (f"--accent:{hex_color};--accent2:color-mix(in srgb, {hex_color} 62%, #0ea5e9);"
            f"--accent-soft:color-mix(in srgb, {hex_color} 14%, transparent);--glow1:rgba({r},{g},{b},.13);--accent-fg:{fg}")


@app.get("/", include_in_schema=False)
@app.get("/index.html", include_in_schema=False)
def index_page(db: Session = Depends(get_db)):
    """The page with the panel's own name, logo and colour already in it: no flash of the defaults while the script loads."""
    from html import escape
    brand = get_brand(db)
    html = (BASE / "static" / "index.html").read_text(encoding="utf-8")
    name = escape(brand["name"])
    html = html.replace("<title>پنل چندلوکیشن</title>", f"<title>{name}</title>", 1)
    html = html.replace('<html lang="fa" dir="rtl">', f'<html lang="fa" dir="rtl" style="{escape(_accent_style(brand["color"]), quote=True)}">', 1)
    if brand["logo"]:
        html = html.replace('<link rel="icon" href="data:,">', f'<link rel="icon" href="{escape(brand["logo"], quote=True)}">', 1)
        html = re.sub(r'(<div class="brand" id="brand">)<span class="logo">.*?</span>(<span>)',
                      lambda m: f'{m.group(1)}<span class="logo img"><img src="{escape(brand["logo"], quote=True)}" alt=""></span>{m.group(2)}', html, count=1, flags=re.S)
    html = re.sub(r'(<div class="brand" id="brand">.*?<span>)پنل چندلوکیشن(<small>)', lambda m: f"{m.group(1)}{name}{m.group(2)}", html, count=1, flags=re.S)
    # a changed app.js is fetched at once after an update (no hard refresh needed): its mtime is in the URL
    base = admin_base()   # behind the secret path every URL the page uses carries it
    html = html.replace('<script src="/app.js">', f'<script>window.BASE={json.dumps(base)}</script><script src="{base}/app.js?v={int((BASE / "static" / "app.js").stat().st_mtime)}">', 1)
    return HTMLResponse(html, headers={"Cache-Control": "no-store"})


app.mount("/", StaticFiles(directory=BASE / "static", html=True), name="static")
