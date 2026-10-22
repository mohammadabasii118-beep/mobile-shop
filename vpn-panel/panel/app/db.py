import os
from datetime import datetime, timezone

from sqlalchemy import JSON, ForeignKey, create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship

engine = create_engine(os.environ.get("PANEL_DB", "sqlite:///./panel.db"),
                       connect_args={"check_same_thread": False})


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class Node(Base):
    __tablename__ = "nodes"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    cc: Mapped[str]
    address: Mapped[str]
    token: Mapped[str] = mapped_column(unique=True)
    ss_key: Mapped[str]
    l2tp_psk: Mapped[str]
    last_seen: Mapped[datetime | None] = mapped_column(default=None)
    load: Mapped[int] = mapped_column(default=0)
    reality_pub: Mapped[str] = mapped_column(default="")
    reality_sid: Mapped[str] = mapped_column(default="")
    tls_self_signed: Mapped[bool] = mapped_column(default=True)
    tls_pin: Mapped[str] = mapped_column(default="")  # SHA-256 of the node certificate, for pinning
    conflicts: Mapped[list] = mapped_column(JSON, default=list)  # ports another program holds, from the agent
    keys: Mapped[dict] = mapped_column(JSON, default=dict)   # Reality / WireGuard key pairs, kept so a replacement server can take them over
    reality_sni: Mapped[str] = mapped_column(default="www.apple.com")  # camouflage site for Reality
    cf_domain: Mapped[str] = mapped_column(default="")
    cf_address: Mapped[str] = mapped_column(default="")
    raw_host: Mapped[str] = mapped_column(default="")  # address in plain-VLESS links (e.g. the old x-ui domain)
    errors: Mapped[list] = mapped_column(JSON, default=list)  # configs the agent rejected, from the agent
    wg_pub: Mapped[str] = mapped_column(default="")
    ovpn_ca: Mapped[str] = mapped_column(default="")
    protocols: Mapped[list["NodeProtocol"]] = relationship(
        cascade="all, delete-orphan", order_by="NodeProtocol.id")
    outbounds: Mapped[list["Outbound"]] = relationship(cascade="all, delete-orphan", order_by="Outbound.id")
    rules: Mapped[list["Rule"]] = relationship(cascade="all, delete-orphan", order_by="Rule.position, Rule.id")


class Outbound(Base):
    """Where a node can send traffic instead of straight to the internet (a proxy, WARP, another server)."""
    __tablename__ = "outbounds"
    id: Mapped[int] = mapped_column(primary_key=True)
    node_id: Mapped[int] = mapped_column(ForeignKey("nodes.id"))
    name: Mapped[str]  # tag is "out-" + name
    kind: Mapped[str]  # link | socks | http | wireguard
    data: Mapped[dict] = mapped_column(JSON, default=dict)  # {"xray": outbound dict, "summary": str}


class Rule(Base):
    """Send matching traffic of a node through an outbound (Xray routing rule). Evaluated in `position` order."""
    __tablename__ = "rules"
    id: Mapped[int] = mapped_column(primary_key=True)
    node_id: Mapped[int] = mapped_column(ForeignKey("nodes.id"))
    position: Mapped[int] = mapped_column(default=0)
    enabled: Mapped[bool] = mapped_column(default=True)
    inbounds: Mapped[list] = mapped_column(JSON, default=list)  # our protocol ids, e.g. "vless"
    ports: Mapped[str] = mapped_column(default="")  # destination ports "443,8000-9000"
    domains: Mapped[list] = mapped_column(JSON, default=list)
    ips: Mapped[list] = mapped_column(JSON, default=list)
    outbound: Mapped[str] = mapped_column(default="direct")  # direct | block | an Outbound name
    note: Mapped[str] = mapped_column(default="")


class NodeProtocol(Base):
    __tablename__ = "node_protocols"
    id: Mapped[int] = mapped_column(primary_key=True)
    node_id: Mapped[int] = mapped_column(ForeignKey("nodes.id"))
    proto: Mapped[str]
    enabled: Mapped[bool] = mapped_column(default=True)
    port: Mapped[int]
    host: Mapped[str] = mapped_column(default="")   # address in this protocol's links; empty = the node address
    label: Mapped[str] = mapped_column(default="")  # name shown to users and in the link's remark; empty = the protocol's own name
    extra: Mapped[bool] = mapped_column(default=False)   # an additional copy of the protocol (own port, address, name)


class Tunnel(Base):
    """A reverse tunnel: users reach the ports of `iran_host`, which are carried to `node` (the foreign server)."""
    __tablename__ = "tunnels"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    iran_host: Mapped[str]                                   # public address of the server users connect to
    node_id: Mapped[int] = mapped_column(ForeignKey("nodes.id"))
    ctl_port: Mapped[int] = mapped_column(default=7777)      # the port the foreign side dials on the Iran server
    token: Mapped[str]                                       # shared secret of the two ends
    relay_token: Mapped[str] = mapped_column(unique=True)    # what the agent on the Iran server signs in with
    forwards: Mapped[list] = mapped_column(JSON, default=list)   # [{"proto": "tcp", "listen": 80, "target": 80}]
    enabled: Mapped[bool] = mapped_column(default=True)
    encrypt: Mapped[str] = mapped_column(default="off")      # off | tcp | all: what the tunnel encrypts between the two servers
    publish: Mapped[bool] = mapped_column(default=False)     # also give users a copy of each matching config that goes through Iran
    relay_seen: Mapped[datetime | None] = mapped_column(default=None)
    relay_state: Mapped[dict] = mapped_column(JSON, default=dict)    # last report of the Iran side
    client_seen: Mapped[datetime | None] = mapped_column(default=None)
    client_state: Mapped[dict] = mapped_column(JSON, default=dict)   # last report of the foreign side
    test: Mapped[dict] = mapped_column(JSON, default=dict)           # the last connection test: id, port, token, start_at, seconds, iran, node
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class Setting(Base):
    """Small key/value store for panel-wide options (branding)."""
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(primary_key=True)
    value: Mapped[str] = mapped_column(default="")


class Admin(Base):
    """A sub-admin (reseller): signs in with their own name and password and can only create and view their own users."""
    __tablename__ = "admins"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(unique=True)
    pw_hash: Mapped[str]
    enabled: Mapped[bool] = mapped_column(default=True)
    max_users: Mapped[int] = mapped_column(default=0)          # 0 = no cap
    max_quota_gb: Mapped[float] = mapped_column(default=0)     # per user; 0 = no cap
    max_days: Mapped[int] = mapped_column(default=0)           # per user; 0 = no cap
    max_total_gb: Mapped[float] = mapped_column(default=0)     # pool: sum of the volume of all their users; 0 = no cap
    allowed_protos: Mapped[list] = mapped_column(JSON, default=list)   # protocols they may give users; empty = all
    allowed_nodes: Mapped[list] = mapped_column(JSON, default=list)    # locations they may give users; empty = all
    can_delete: Mapped[bool] = mapped_column(default=False)    # may delete the users they created
    can_edit: Mapped[bool] = mapped_column(default=False)      # may renew, change volume/time, enable/disable their users
    token_ver: Mapped[int] = mapped_column(default=0)          # bumped on password change: older sessions die
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(unique=True)
    sub_token: Mapped[str] = mapped_column(unique=True)
    uuid: Mapped[str]
    password: Mapped[str]
    wg_private: Mapped[str] = mapped_column(default="")
    wg_public: Mapped[str] = mapped_column(default="")
    quota_bytes: Mapped[int] = mapped_column(default=0)  # 0 = unlimited
    used_bytes: Mapped[int] = mapped_column(default=0)
    expire_at: Mapped[datetime | None] = mapped_column(default=None)
    enabled: Mapped[bool] = mapped_column(default=True)
    protos: Mapped[list] = mapped_column(JSON, default=list)
    node_ids: Mapped[list] = mapped_column(JSON, default=list)  # empty = all nodes
    owner_id: Mapped[int | None] = mapped_column(default=None)  # sub-admin that created the user; None = main admin
    last_seen: Mapped[datetime | None] = mapped_column(default=None)  # last time a node reported traffic for this user

    def status(self) -> str:
        if not self.enabled:
            return "disabled"
        if self.expire_at and self.expire_at <= utcnow():
            return "expired"
        if self.quota_bytes and self.used_bytes >= self.quota_bytes:
            return "quota"
        return "active"


def _server_default(col) -> str:
    """DEFAULT clause so ALTER TABLE ADD COLUMN works on rows that already exist."""
    if isinstance(col.type, JSON):
        return " DEFAULT '[]'"
    default = col.default.arg if col.default is not None and col.default.is_scalar else None
    if isinstance(default, bool):
        return f" DEFAULT {int(default)}"
    if isinstance(default, (int, float)):
        return f" DEFAULT {default}"
    if isinstance(default, str):
        return " DEFAULT '" + default.replace("'", "''") + "'"
    if col.nullable:
        return ""
    return " DEFAULT ''" if col.type.python_type is str else " DEFAULT 0"


def migrate() -> None:
    """Add columns that newer code expects but an older database lacks (no drops or type changes)."""
    insp = inspect(engine)
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not insp.has_table(table.name):
                continue
            have = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name not in have:
                    ddl = col.type.compile(engine.dialect)
                    conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {ddl}{_server_default(col)}'))


def init_db() -> None:
    Base.metadata.create_all(engine)
    migrate()


def get_db():
    with Session(engine) as s:
        yield s
