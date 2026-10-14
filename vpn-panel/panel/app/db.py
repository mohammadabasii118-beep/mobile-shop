import os
from datetime import datetime, timezone

from sqlalchemy import JSON, ForeignKey, create_engine
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


def init_db() -> None:
    Base.metadata.create_all(engine)


def get_db():
    with Session(engine) as s:
        yield s
