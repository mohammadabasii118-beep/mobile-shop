#!/usr/bin/env python3
"""vtunnel: a reverse TCP/UDP tunnel in the spirit of Backhaul, one file, standard library only.

The server runs on the side users connect to (e.g. Iran) and opens the public ports. The client runs on the other side
(e.g. Germany) and dials the server, so only one direction has to be reachable.

  server:  vtunnel.py server --listen 0.0.0.0:7000 --token SECRET --forward 80 --forward 81=80 --forward udp:5000
  client:  vtunnel.py client --server IRAN_IP:7000 --token SECRET --pool 8

--forward [tcp:|udp:]LISTEN_PORT[=TARGET_PORT]: connections to LISTEN_PORT on the server come out on 127.0.0.1:TARGET_PORT of
the client machine (TARGET defaults to LISTEN).

TCP: the client keeps --pool connections to the server already open and authenticated, so a user connection is handed one
at once (no handshake across the tunnel on the first packet). UDP: datagrams travel as datagrams (no TCP head-of-line
blocking), which is what games need. By default the tunnel is not encrypted: run encrypted protocols (VLESS/Reality, ...) inside,
or add --encrypt tcp|all on both ends (ChaCha20-Poly1305; the handshake is random bytes, so the tunnel has no fixed fingerprint)."""
import argparse
import asyncio
import hashlib
import hmac
import logging
import os
import socket
import struct
import sys
import time
from collections import deque

MAGIC = b"VT1"
LOG = logging.getLogger("vtunnel")
UDP_IDLE = 60          # seconds without traffic before a UDP session is dropped
UDP_REGISTER = 5       # the client re-announces itself this often (keeps NAT mappings alive too)


def mac(token, data):
    return hmac.new(token.encode(), data, hashlib.sha256).digest()


def tune(writer):
    s = writer.get_extra_info("socket")
    if s is None:
        return
    s.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
    for opt, val in (("TCP_KEEPIDLE", 15), ("TCP_KEEPINTVL", 5), ("TCP_KEEPCNT", 3)):   # a dead peer is noticed in ~30 s
        if hasattr(socket, opt):
            s.setsockopt(socket.IPPROTO_TCP, getattr(socket, opt), val)


async def pump(r, w):
    try:
        while True:
            data = await r.read(65536)
            if not data:
                break
            w.write(data)
            await w.drain()
    except Exception:
        pass


async def splice(r1, w1, r2, w2):
    """Copy both ways until one side is done; the other direction gets a short grace period to finish."""
    tasks = [asyncio.ensure_future(pump(r1, w2)), asyncio.ensure_future(pump(r2, w1))]
    try:
        _, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        if pending:
            await asyncio.wait(pending, timeout=2)
    finally:
        for t in tasks:
            t.cancel()
        for w in (w1, w2):
            try:
                w.close()
            except Exception:
                pass


def parse_forward(spec):
    proto = "tcp"
    if spec[:4] in ("tcp:", "udp:"):
        proto, spec = spec[:3], spec[4:]
    listen, _, target = spec.partition("=")
    return proto, int(listen), int(target or listen)


def udp_socket(bind=None):
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.setblocking(False)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 4 * 1024 * 1024)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 4 * 1024 * 1024)
    if bind:
        s.bind(bind)
    return s


def try_send(sock, data, addr=None):
    try:
        sock.sendto(data, addr) if addr else sock.send(data)
    except (BlockingIOError, OSError):
        pass   # UDP: a dropped datagram is normal


# ---- optional encryption (ChaCha20-Poly1305, keys derived from the token; needs python3-cryptography) ----
def _crypto():
    try:
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305
        from cryptography.hazmat.primitives.kdf.hkdf import HKDF
    except ImportError:
        sys.exit("encryption needs the python3-cryptography package (apt install python3-cryptography)")
    return hashes, ChaCha20Poly1305, HKDF


def derive(token, salt, info):
    hashes, _, HKDF = _crypto()
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=salt, info=info).derive(token.encode())


class EncReader:
    """Reads the AEAD records of the other side as a plain byte stream: [18 B sealed length][length + 16 B sealed data]."""
    def __init__(self, reader, key):
        self.r, self.aead, self.ctr, self.buf = reader, _crypto()[1](key), 0, b""

    def _nonce(self):
        n = self.ctr.to_bytes(12, "little")
        self.ctr += 1
        return n

    async def _fill(self):
        try:
            hdr = await self.r.readexactly(18)
        except asyncio.IncompleteReadError as e:
            if e.partial:
                raise ConnectionError("truncated record")
            return False                                     # clean end of stream
        try:
            ln = int.from_bytes(self.aead.decrypt(self._nonce(), hdr, None), "big")
            self.buf += self.aead.decrypt(self._nonce(), await self.r.readexactly(ln + 16), None)
        except asyncio.IncompleteReadError:
            raise ConnectionError("truncated record")
        except Exception as e:
            raise ConnectionError("bad record (wrong token or not a vtunnel peer)") from e
        return True

    async def read(self, n=-1):
        if not self.buf and not await self._fill():
            return b""
        n = len(self.buf) if n < 0 else n
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    async def readexactly(self, n):
        while len(self.buf) < n:
            if not await self._fill():
                raise asyncio.IncompleteReadError(self.buf, n)
        out, self.buf = self.buf[:n], self.buf[n:]
        return out


class EncWriter:
    def __init__(self, writer, key):
        self.w, self.aead, self.ctr = writer, _crypto()[1](key), 0

    def _nonce(self):
        n = self.ctr.to_bytes(12, "little")
        self.ctr += 1
        return n

    def write(self, data):
        for i in range(0, len(data), 16384):
            chunk = data[i:i + 16384]
            hdr = self.aead.encrypt(self._nonce(), len(chunk).to_bytes(2, "big"), None)
            self.w.write(hdr + self.aead.encrypt(self._nonce(), chunk, None))

    async def drain(self):
        await self.w.drain()

    def close(self):
        self.w.close()

    def get_extra_info(self, name, default=None):
        return self.w.get_extra_info(name, default)


async def secure_server(r, w, token):
    """Server side of the encrypted handshake: salts are random bytes, so nothing on the wire looks like a protocol."""
    cs = await asyncio.wait_for(r.readexactly(16), 5)
    ss = os.urandom(16)
    w.write(ss)
    await w.drain()
    er = EncReader(r, derive(token, cs + ss, b"vt-c2s"))
    ew = EncWriter(w, derive(token, cs + ss, b"vt-s2c"))
    if await asyncio.wait_for(er.readexactly(3), 5) != MAGIC:
        raise ConnectionError("bad hello")
    ew.write(b"K")
    await w.drain()
    return er, ew


async def secure_client(r, w, token):
    cs = os.urandom(16)
    w.write(cs)
    await w.drain()
    ss = await asyncio.wait_for(r.readexactly(16), 8)
    er = EncReader(r, derive(token, cs + ss, b"vt-s2c"))
    ew = EncWriter(w, derive(token, cs + ss, b"vt-c2s"))
    ew.write(MAGIC)
    await w.drain()
    if await asyncio.wait_for(er.readexactly(1), 8) != b"K":
        raise ConnectionError("rejected")
    return er, ew


class UdpBox:
    """Seals each tunnel datagram on its own: random 12-byte nonce + ChaCha20-Poly1305."""
    def __init__(self, token, role):
        chacha = _crypto()[1]
        c2s, s2c = derive(token, b"vtunnel-udp", b"udp-c2s"), derive(token, b"vtunnel-udp", b"udp-s2c")
        self.tx, self.rx = (chacha(c2s), chacha(s2c)) if role == "client" else (chacha(s2c), chacha(c2s))

    def seal(self, data):
        nonce = os.urandom(12)
        return nonce + self.tx.encrypt(nonce, data, None)

    def open(self, data):
        try:
            return self.rx.decrypt(data[:12], data[12:], None)
        except Exception:
            return None


class Idle:
    """An authenticated connection from the client that waits for a user."""
    def __init__(self, r, w):
        self.r, self.w = r, w
        self.assigned = asyncio.get_running_loop().create_future()
        self.eof = asyncio.ensure_future(r.read(1))   # b"" when the peer goes away; b"A" once it accepted a job

    @property
    def alive(self):
        return not self.eof.done() and not self.assigned.done()


class Server:
    def __init__(self, token, host, port, forwards, status_file="", encrypt="off"):
        self.token, self.host, self.port, self.status_file = token, host, port, status_file
        self.encrypt = encrypt
        self.ubox = UdpBox(token, "server") if encrypt == "all" else None
        self.failed = []        # forwarded ports that could not be opened (taken by another program)
        self.tcp = [(l, t) for p, l, t in forwards if p == "tcp"]
        self.udp = [(l, t) for p, l, t in forwards if p == "udp"]
        self.pool = deque()
        self.wake = asyncio.Event()
        self.client_addr = None
        self.tsock = None
        self.sessions = {}      # id -> [listener socket, user addr, last seen]
        self.by_user = {}       # (user addr, listen port) -> id
        self.next_id = 1

    # ---- TCP ----
    async def on_tunnel(self, r, w):
        tune(w)
        raw = w
        try:
            if self.encrypt != "off":
                r, w = await secure_server(r, w, self.token)
            else:
                nonce = os.urandom(16)
                w.write(MAGIC + nonce)
                await w.drain()
                resp = await asyncio.wait_for(r.readexactly(32), 5)
                if not hmac.compare_digest(resp, mac(self.token, nonce)):
                    LOG.warning("tunnel connection from %s rejected (wrong token)", raw.get_extra_info("peername"))
                    w.close()
                    return
                w.write(b"K")
                await w.drain()
        except Exception as e:
            LOG.warning("tunnel connection from %s rejected (%s)", raw.get_extra_info("peername"), e.__class__.__name__)
            raw.close()
            return
        e = Idle(r, w)
        self.pool.append(e)
        self.wake.set()
        ur = uw = None
        try:
            await asyncio.wait([e.eof, e.assigned], return_when=asyncio.FIRST_COMPLETED)
            if not e.assigned.done():
                return                       # the client closed it while idle
            ur, uw, port = e.assigned.result()
            w.write(b"O" + struct.pack("!H", port))
            await w.drain()
            if await asyncio.wait_for(e.eof, 5) != b"A":
                return                       # the client could not reach its target
            await splice(r, w, ur, uw)
        except Exception:
            pass
        finally:
            e.eof.cancel()
            for x in (w, uw):
                try:
                    if x is not None:
                        x.close()
                except Exception:
                    pass

    async def borrow(self, ur, uw, port):
        deadline = time.monotonic() + 3
        while True:
            while self.pool:
                e = self.pool.popleft()
                if e.alive:
                    e.assigned.set_result((ur, uw, port))
                    return True
            left = deadline - time.monotonic()
            if left <= 0:
                return False
            self.wake.clear()
            try:
                await asyncio.wait_for(self.wake.wait(), left)
            except asyncio.TimeoutError:
                return False

    async def on_user(self, r, w, port):
        tune(w)
        if not await self.borrow(r, w, port):
            w.close()

    # ---- UDP ----
    def tunnel_readable(self):
        try:
            data, addr = self.tsock.recvfrom(65535)
        except (BlockingIOError, OSError):
            return
        if self.ubox:
            data = self.ubox.open(data)
            if data is None:
                return
        kind = data[:1]
        if kind == b"R" and len(data) == 25:
            ts = data[1:9]
            if abs(time.time() - struct.unpack("!Q", ts)[0]) < 120 and hmac.compare_digest(data[9:], mac(self.token, ts)[:16]):
                if self.client_addr != addr:
                    LOG.info("udp client registered from %s", addr)
                self.client_addr = addr
        elif kind == b"D" and addr == self.client_addr and len(data) >= 5:
            s = self.sessions.get(struct.unpack("!I", data[1:5])[0])
            if s:
                s[2] = time.monotonic()
                try_send(s[0], data[5:], s[1])

    def user_readable(self, sock, port):
        try:
            data, addr = sock.recvfrom(65535)
        except (BlockingIOError, OSError):
            return
        if self.client_addr is None:
            return
        key = (addr, port)
        sid = self.by_user.get(key)
        if sid is None:
            sid, self.next_id = self.next_id, (self.next_id + 1) & 0xFFFFFFFF or 1
            self.by_user[key] = sid
            self.sessions[sid] = [sock, addr, time.monotonic(), key]
        self.sessions[sid][2] = time.monotonic()
        frame = b"D" + struct.pack("!IH", sid, port) + data
        try_send(self.tsock, self.ubox.seal(frame) if self.ubox else frame, self.client_addr)

    async def sweep(self):
        while True:
            await asyncio.sleep(15)
            now = time.monotonic()
            for sid in [i for i, s in self.sessions.items() if now - s[2] > UDP_IDLE]:
                self.by_user.pop(self.sessions.pop(sid)[3], None)

    async def write_status(self):
        """For the tool that supervises this server: how many client connections are ready, and what could not be opened."""
        import json
        while True:
            self.pool = deque(e for e in self.pool if e.alive)
            data = {"time": int(time.time()), "pool": len(self.pool), "udp_client": self.client_addr is not None, "failed": self.failed}
            try:
                with open(self.status_file + ".tmp", "w") as f:
                    json.dump(data, f)
                os.replace(self.status_file + ".tmp", self.status_file)
            except OSError:
                pass
            await asyncio.sleep(5)

    async def run(self):
        loop = asyncio.get_running_loop()
        await asyncio.start_server(self.on_tunnel, self.host, self.port, reuse_address=True)
        for lport, tport in self.tcp:
            try:
                await asyncio.start_server(lambda r, w, t=tport: self.on_user(r, w, t), self.host, lport, reuse_address=True)
                LOG.info("tcp %s -> client:%s", lport, tport)
            except OSError as e:     # one busy port must not take the others down
                self.failed.append(f"tcp/{lport}")
                LOG.error("cannot listen on tcp %s: %s", lport, e)
        if self.udp:
            self.tsock = udp_socket((self.host, self.port))
            loop.add_reader(self.tsock.fileno(), self.tunnel_readable)
            for lport, tport in self.udp:
                try:
                    s = udp_socket((self.host, lport))
                except OSError as e:
                    self.failed.append(f"udp/{lport}")
                    LOG.error("cannot listen on udp %s: %s", lport, e)
                    continue
                loop.add_reader(s.fileno(), self.user_readable, s, tport)
                LOG.info("udp %s -> client:%s", lport, tport)
            asyncio.ensure_future(self.sweep())
        if self.status_file:
            asyncio.ensure_future(self.write_status())
        LOG.info("server listening on %s:%s", self.host, self.port)
        await asyncio.Event().wait()


class Client:
    def __init__(self, token, host, port, pool, encrypt="off"):
        self.token, self.host, self.port, self.pool = token, host, port, pool
        self.encrypt = encrypt
        self.ubox = UdpBox(token, "client") if encrypt == "all" else None
        self.usock = None
        self.sessions = {}      # id -> [local socket, last seen]
        self.server_udp = None

    async def worker(self):
        backoff = 1
        while True:
            w = None
            try:
                r, w = await asyncio.wait_for(asyncio.open_connection(self.host, self.port), 8)
                tune(w)
                if self.encrypt != "off":
                    r, w = await secure_client(r, w, self.token)
                else:
                    hdr = await asyncio.wait_for(r.readexactly(19), 8)
                    if hdr[:3] != MAGIC:
                        raise ConnectionError("not a vtunnel server")
                    w.write(mac(self.token, hdr[3:]))
                    await w.drain()
                    if await asyncio.wait_for(r.readexactly(1), 8) != b"K":
                        raise ConnectionError("rejected")
                backoff = 1
                frame = await r.readexactly(3)       # idle until a user arrives; TCP keepalive notices a dead server
            except Exception as e:
                if w:
                    w.close()
                if backoff == 1 or backoff >= 10:
                    LOG.warning("server %s:%s: %s (retrying)", self.host, self.port, e.__class__.__name__ if not str(e) else e)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 10)
                continue
            asyncio.ensure_future(self.session(r, w, frame))

    async def session(self, r, w, frame):
        try:
            port = struct.unpack("!H", frame[1:])[0]
            tr, tw = await asyncio.wait_for(asyncio.open_connection("127.0.0.1", port), 5)
        except Exception:
            w.close()
            return
        tune(tw)
        w.write(b"A")
        await splice(r, w, tr, tw)

    # ---- UDP ----
    def readable(self):
        try:
            data, _ = self.usock.recvfrom(65535)
        except (BlockingIOError, OSError):
            return
        if self.ubox:
            data = self.ubox.open(data)
            if data is None:
                return
        if data[:1] != b"D" or len(data) < 7:
            return
        sid, port = struct.unpack("!IH", data[1:7])
        s = self.sessions.get(sid)
        if s is None:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setblocking(False)
            sock.connect(("127.0.0.1", port))
            s = self.sessions[sid] = [sock, time.monotonic()]
            asyncio.get_running_loop().add_reader(sock.fileno(), self.reply, sid, sock)
        s[1] = time.monotonic()
        try_send(s[0], data[7:])

    def send(self, frame):
        try_send(self.usock, self.ubox.seal(frame) if self.ubox else frame, self.server_udp)

    def reply(self, sid, sock):
        try:
            data = sock.recv(65535)
        except (BlockingIOError, OSError):
            return
        self.send(b"D" + struct.pack("!I", sid) + data)

    async def udp_loop(self):
        loop = asyncio.get_running_loop()
        self.server_udp = (await loop.getaddrinfo(self.host, self.port, family=socket.AF_INET, type=socket.SOCK_DGRAM))[0][4]
        self.usock = udp_socket()
        loop.add_reader(self.usock.fileno(), self.readable)
        while True:
            ts = struct.pack("!Q", int(time.time()))
            self.send(b"R" + ts + mac(self.token, ts)[:16])
            now = time.monotonic()
            for sid in [i for i, s in self.sessions.items() if now - s[1] > UDP_IDLE]:
                sock = self.sessions.pop(sid)[0]
                loop.remove_reader(sock.fileno())
                sock.close()
            await asyncio.sleep(UDP_REGISTER)

    async def run(self):
        LOG.info("client -> %s:%s, pool %s", self.host, self.port, self.pool)
        jobs = [self.worker() for _ in range(self.pool)] + [self.udp_loop()]
        await asyncio.gather(*jobs)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="mode", required=True)
    sv = sub.add_parser("server")
    sv.add_argument("--listen", default="0.0.0.0:7000")
    sv.add_argument("--forward", action="append", default=[], metavar="[tcp:|udp:]PORT[=TARGET]")
    sv.add_argument("--status-file", default="", help="JSON file refreshed every 5 s with the pool size and failed ports")
    cl = sub.add_parser("client")
    cl.add_argument("--server", required=True, metavar="HOST:PORT")
    cl.add_argument("--pool", type=int, default=8)
    for p in (sv, cl):
        p.add_argument("--token", default=os.environ.get("VTUNNEL_TOKEN", ""))
        p.add_argument("--encrypt", choices=["off", "tcp", "all"], default="off",
                       help="tcp: encrypt the TCP connections; all: also the UDP datagrams (both ends must use the same value)")
    a = ap.parse_args(argv)
    if len(a.token) < 8:
        sys.exit("--token (or VTUNNEL_TOKEN) must be at least 8 characters")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if a.mode == "server":
        host, _, port = a.listen.rpartition(":")
        if not a.forward:
            sys.exit("give at least one --forward")
        job = Server(a.token, host or "0.0.0.0", int(port), [parse_forward(f) for f in a.forward], a.status_file, a.encrypt).run()
    else:
        host, _, port = a.server.rpartition(":")
        job = Client(a.token, host, int(port), max(1, a.pool), a.encrypt).run()
    try:
        asyncio.run(job)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
