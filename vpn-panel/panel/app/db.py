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
    reality_sni: Mapped[str] = mapped_column(default="www.apple.com")  # camouflage site for Reality
    cf_domain: Mapped[str] = mapped_column(default="")
    cf_address: Mapped[str] = mapped_column(default="")
    wg_pub: Mapped[str] = mapped_column(default="")
    ovpn_ca: Mapped[str] = mapped_column(default="")
    protocols: Mapped[list["NodeProtocol"]] = relationship(
        cascade="all, delete-orphan", order_by="NodeProtocol.id")


class NodeProtocol(Base):
    __tablename__ = "node_protocols"
    id: Mapped[int] = mapped_column(primary_key=True)
    node_id: Mapped[int] = mapped_column(ForeignKey("nodes.id"))
    proto: Mapped[str]
    enabled: Mapped[bool] = mapped_column(default=True)
    port: Mapped[int]


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
