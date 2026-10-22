#!/usr/bin/env python3
"""vtunnel: a reverse TCP/UDP tunnel in the spirit of Backhaul, one file, standard library only.

The server runs on the side users connect to (e.g. Iran) and opens the public ports. The client runs on the other side
(e.g. Germany) and dials the server, so only one direction has to be reachable.

  server:  vtunnel.py server --listen 0.0.0.0:7000 --token SECRET --forward 80 --forward 81=80 --forward udp:5000
  client:  vtunnel.py client --server IRAN_IP:7000 --token SECRET --pool 8
Direct mode (the server dials out instead, for networks where only that direction is open):
  client:  vtunnel.py client --listen 0.0.0.0:7000 --token SECRET
  server:  vtunnel.py server --dial FOREIGN_IP:7000 --token SECRET --forward 80

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
import json
import logging
import os
import socket
import statistics
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


async def accept_handshake(r, w, token, encrypt):
    """The side that LISTENS for the tunnel connection: challenge/response (or the encrypted handshake) -> (reader, writer)."""
    if encrypt != "off":
        return await secure_server(r, w, token)
    nonce = os.urandom(16)
    w.write(MAGIC + nonce)
    await w.drain()
    resp = await asyncio.wait_for(r.readexactly(32), 5)
    if not hmac.compare_digest(resp, mac(token, nonce)):
        raise ConnectionError("wrong token")
    w.write(b"K")
    await w.drain()
    return r, w


async def dial_handshake(r, w, token, encrypt):
    """The side that DIALS the tunnel connection."""
    if encrypt != "off":
        return await secure_client(r, w, token)
    hdr = await asyncio.wait_for(r.readexactly(19), 8)
    if hdr[:3] != MAGIC:
        raise ConnectionError("not a vtunnel peer")
    w.write(mac(token, hdr[3:]))
    await w.drain()
    if await asyncio.wait_for(r.readexactly(1), 8) != b"K":
        raise ConnectionError("rejected")
    return r, w


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
    def __init__(self, token, host, port, forwards, status_file="", encrypt="off", dial=None, pool=8):
        self.token, self.host, self.port, self.status_file = token, host, port, status_file
        self.dial, self.pool_size = dial, pool       # dial=(host, port): DIRECT mode, this side opens the tunnel connections
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
            r, w = await accept_handshake(r, w, self.token, self.encrypt)
        except Exception as e:
            LOG.warning("tunnel connection from %s rejected (%s)", raw.get_extra_info("peername"), e.__class__.__name__)
            raw.close()
            return
        await self.serve_pooled(r, w)

    async def dial_worker(self):
        """DIRECT mode: keep one ready connection to the other side; a new one is opened as soon as it is used."""
        backoff = 1
        while True:
            raw = None
            try:
                r, raw = await asyncio.wait_for(asyncio.open_connection(*self.dial), 8)
                tune(raw)
                r, w = await dial_handshake(r, raw, self.token, self.encrypt)
                backoff = 1
            except Exception as e:
                if raw:
                    raw.close()
                if backoff == 1 or backoff >= 10:
                    LOG.warning("cannot reach %s:%s: %s (retrying)", self.dial[0], self.dial[1], e.__class__.__name__ if not str(e) else e)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 10)
                continue
            await self.serve_pooled(r, w)

    async def serve_pooled(self, r, w):
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

    async def udp_register(self):
        """DIRECT mode: announce ourselves to the other side's UDP port (it learns our address from this)."""
        loop = asyncio.get_running_loop()
        self.client_addr = (await loop.getaddrinfo(self.dial[0], self.dial[1], family=socket.AF_INET, type=socket.SOCK_DGRAM))[0][4]
        while True:
            ts = struct.pack("!Q", int(time.time()))
            frame = b"R" + ts + mac(self.token, ts)[:16]
            try_send(self.tsock, self.ubox.seal(frame) if self.ubox else frame, self.client_addr)
            await asyncio.sleep(UDP_REGISTER)

    async def run(self):
        loop = asyncio.get_running_loop()
        if self.dial:
            for _ in range(self.pool_size):
                asyncio.ensure_future(self.dial_worker())
        else:
            await asyncio.start_server(self.on_tunnel, self.host, self.port, reuse_address=True)
        for lport, tport in self.tcp:
            try:
                await asyncio.start_server(lambda r, w, t=tport: self.on_user(r, w, t), self.host, lport, reuse_address=True)
                LOG.info("tcp %s -> client:%s", lport, tport)
            except OSError as e:     # one busy port must not take the others down
                self.failed.append(f"tcp/{lport}")
                LOG.error("cannot listen on tcp %s: %s", lport, e)
        if self.udp:
            self.tsock = udp_socket(None if self.dial else (self.host, self.port))
            loop.add_reader(self.tsock.fileno(), self.tunnel_readable)
            if self.dial:
                asyncio.ensure_future(self.udp_register())
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
        LOG.info("server %s", f"dialing {self.dial[0]}:{self.dial[1]} (direct)" if self.dial else f"listening on {self.host}:{self.port}")
        await asyncio.Event().wait()


class Client:
    def __init__(self, token, host, port, pool, encrypt="off", listen=None):
        self.token, self.host, self.port, self.pool = token, host, port, pool
        self.listen = listen        # (host, port): DIRECT mode, the other side dials us instead of the other way round
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
                r, w = await dial_handshake(r, w, self.token, self.encrypt)
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

    async def on_front(self, r, w):
        """DIRECT mode: the other side dialed us; wait for its job on this connection."""
        tune(w)
        raw = w
        try:
            r, w = await accept_handshake(r, w, self.token, self.encrypt)
            frame = await r.readexactly(3)
        except Exception as e:
            LOG.warning("tunnel connection from %s rejected (%s)", raw.get_extra_info("peername"), e.__class__.__name__)
            raw.close()
            return
        await self.session(r, w, frame)

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
            data, addr = self.usock.recvfrom(65535)
        except (BlockingIOError, OSError):
            return
        if self.ubox:
            data = self.ubox.open(data)
            if data is None:
                return
        if self.listen:       # DIRECT mode: only the registered peer may send us datagrams
            if data[:1] == b"R" and len(data) == 25:
                ts = data[1:9]
                if abs(time.time() - struct.unpack("!Q", ts)[0]) < 120 and hmac.compare_digest(data[9:], mac(self.token, ts)[:16]):
                    self.server_udp = addr
                return
            if addr != self.server_udp:
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
        if self.server_udp:
            try_send(self.usock, self.ubox.seal(frame) if self.ubox else frame, self.server_udp)

    def reply(self, sid, sock):
        try:
            data = sock.recv(65535)
        except (BlockingIOError, OSError):
            return
        self.send(b"D" + struct.pack("!I", sid) + data)

    async def udp_loop(self):
        loop = asyncio.get_running_loop()
        if self.listen:        # DIRECT: wait on our port; the other side registers itself with its first datagram
            self.usock = udp_socket(self.listen)
        else:
            self.server_udp = (await loop.getaddrinfo(self.host, self.port, family=socket.AF_INET, type=socket.SOCK_DGRAM))[0][4]
            self.usock = udp_socket()
        loop.add_reader(self.usock.fileno(), self.readable)
        while True:
            if not self.listen:
                ts = struct.pack("!Q", int(time.time()))
                self.send(b"R" + ts + mac(self.token, ts)[:16])
            now = time.monotonic()
            for sid in [i for i, s in self.sessions.items() if now - s[1] > UDP_IDLE]:
                sock = self.sessions.pop(sid)[0]
                loop.remove_reader(sock.fileno())
                sock.close()
            await asyncio.sleep(UDP_REGISTER)

    async def run(self):
        if self.listen:
            await asyncio.start_server(self.on_front, self.listen[0], self.listen[1], reuse_address=True)
            LOG.info("client listening on %s:%s (direct: the other side dials in)", *self.listen)
            await self.udp_loop()
            return
        LOG.info("client -> %s:%s, pool %s", self.host, self.port, self.pool)
        jobs = [self.worker() for _ in range(self.pool)] + [self.udp_loop()]
        await asyncio.gather(*jobs)


# ---- connection probe: both ends listen AND dial at the same time, so one run tells which direction(s) work ----
PROBE_SECS = 4          # length of each throughput measurement


def _pmac(token, data):
    return hmac.new(token.encode(), data, hashlib.sha256).digest()[:16]


async def _probe_conn(r, w, token):
    """One authenticated probe connection: E = echo (RTT), D = send data for PROBE_SECS, U = receive data until EOF and report."""
    try:
        hdr = await asyncio.wait_for(r.readexactly(33), 6)
        if not hmac.compare_digest(hdr[16:32], _pmac(token, hdr[:16])):
            return
        op = hdr[32:33]
        if op == b"E":
            while (b := await asyncio.wait_for(r.read(1), 30)):
                w.write(b)
                await w.drain()
        elif op == b"D":
            end, chunk = time.monotonic() + PROBE_SECS, b"\0" * 65536
            while time.monotonic() < end:
                w.write(chunk)
                await w.drain()
        elif op == b"U":
            got, t0 = 0, time.monotonic()
            while (d := await asyncio.wait_for(r.read(65536), 15)):
                got += len(d)
            w.write(json.dumps({"bytes": got, "secs": time.monotonic() - t0}).encode() + b"\n")
            await w.drain()
    except Exception:
        pass
    finally:
        try:
            w.close()
        except Exception:
            pass


class _ProbeUdp(asyncio.DatagramProtocol):
    def __init__(self, token):
        self.token = token

    def connection_made(self, transport):
        self.t = transport

    def datagram_received(self, data, addr):
        if len(data) == 20 and hmac.compare_digest(data[4:], _pmac(self.token, data[:4])[:16]):
            self.t.sendto(data, addr)


async def _dial(host, port, token, op):
    t0 = time.monotonic()
    r, w = await asyncio.wait_for(asyncio.open_connection(host, port), 5)
    connect_ms = (time.monotonic() - t0) * 1000
    nonce = os.urandom(16)
    w.write(nonce + _pmac(token, nonce) + op)
    await w.drain()
    return r, w, connect_ms


async def _measure(host, port, token):
    out = {}
    samples = []
    for _ in range(5):
        r, w, ms = await _dial(host, port, token, b"E")
        samples.append(ms)
        if len(samples) == 5:
            rtts = []
            for _ in range(20):
                t0 = time.monotonic()
                w.write(b"x")
                await w.drain()
                await asyncio.wait_for(r.readexactly(1), 5)
                rtts.append((time.monotonic() - t0) * 1000)
            out["rtt_ms"] = round(statistics.median(rtts), 1)
        w.close()
    out["connect_ms"] = round(statistics.median(samples), 1)
    r, w, _ = await _dial(host, port, token, b"D")          # download
    got, t0 = 0, time.monotonic()
    while (d := await asyncio.wait_for(r.read(65536), 10)):
        got += len(d)
    out["down_mbps"] = round(got * 8 / max(0.001, time.monotonic() - t0) / 1e6, 1)
    w.close()
    r, w, _ = await _dial(host, port, token, b"U")          # upload (the far side counts what arrived)
    end, chunk = time.monotonic() + PROBE_SECS, b"\0" * 65536
    while time.monotonic() < end:
        w.write(chunk)
        await w.drain()
    w.write_eof()
    rep = json.loads(await asyncio.wait_for(r.readline(), 15))
    out["up_mbps"] = round(rep["bytes"] * 8 / max(0.001, rep["secs"]) / 1e6, 1)
    w.close()
    return out


async def _udp_measure(host, port, token):
    loop = asyncio.get_running_loop()
    got = {}
    class P(asyncio.DatagramProtocol):
        def datagram_received(self, data, addr):
            got[data[:4]] = time.monotonic()
    t, _ = await loop.create_datagram_endpoint(P, remote_addr=(host, port))
    sent = {}
    for i in range(60):
        seq = struct.pack("!I", i)
        sent[seq] = time.monotonic()
        t.sendto(seq + _pmac(token, seq)[:16], None)
        await asyncio.sleep(0.03)
    await asyncio.sleep(1.0)
    t.close()
    rtts = [(got[k] - sent[k]) * 1000 for k in got if k in sent]
    return {"udp_loss_pct": round(100 * (60 - len(rtts)) / 60), "udp_rtt_ms": round(statistics.median(rtts), 1) if rtts else None}


async def probe(peer, port, token, seconds, listen_port=None):
    """Listens on `port` (TCP+UDP) for `seconds` and, meanwhile, dials `peer`:`port` until it answers. -> the result dict."""
    loop = asyncio.get_running_loop()
    lport = listen_port or port
    srv = await asyncio.start_server(lambda r, w: _probe_conn(r, w, token), "0.0.0.0", lport, reuse_address=True)
    udp, _ = await loop.create_datagram_endpoint(lambda: _ProbeUdp(token), local_addr=("0.0.0.0", lport))
    result = {"ok": False, "error": "no answer from the other side"}
    deadline = time.monotonic() + seconds - 20
    try:
        while time.monotonic() < deadline:
            try:
                result = {"ok": True, **(await _measure(peer, port, token))}
                result.update(await _udp_measure(peer, port, token))
                break
            except Exception as e:
                result = {"ok": False, "error": e.__class__.__name__ if not str(e) else str(e)[:80]}
                await asyncio.sleep(2)
        await asyncio.sleep(max(0, min(25, deadline + 20 - time.monotonic())))      # keep answering until the other side is done
    finally:
        srv.close()
        udp.close()
    return result


# ---- BackPack management (used by both panel agents): the pinned binary, a config and a systemd unit per tunnel ----
BP_BIN_DIR = os.environ.get("VPNP_BIN_DIR", "/usr/local/lib/vpn-panel")
BP_CONF_DIR = os.environ.get("VPNP_CONF_DIR", "/etc/vpn-panel")
BP_UNIT_DIR = os.environ.get("VPNP_UNIT_DIR", "/etc/systemd/system")
BP_PREFIX = "vpnp-bp-"          # everything the panel creates starts with this; a BackPack installed by hand is never touched
_ANSI = None


def _sh(*cmd, timeout=30):
    import subprocess
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except Exception as e:                                   # a missing tool or a hang must not stop the whole run
        return subprocess.CompletedProcess(cmd, 127, "", str(e))


def bp_arch():
    import platform
    return {"x86_64": "amd64", "amd64": "amd64", "aarch64": "arm64", "arm64": "arm64"}.get(platform.machine().lower(), "")


def bp_ensure_binary(base_url, sha256_map):
    """Path of the pinned BackPack binary; downloads it from the panel (checked against the pinned SHA-256) when missing."""
    import tarfile
    import urllib.request
    arch = bp_arch()
    if arch not in sha256_map:
        raise RuntimeError(f"no BackPack build for this CPU ({arch or 'unknown'})")
    want = sha256_map[arch]
    dest = os.path.join(BP_BIN_DIR, f"backpack-{want[:12]}")
    if os.access(dest, os.X_OK):
        return dest
    with urllib.request.urlopen(f"{base_url.rstrip('/')}/linux-{arch}.tar.gz", timeout=120) as r:
        data = r.read()
    if hashlib.sha256(data).hexdigest() != want:
        raise RuntimeError("the BackPack download does not match its pinned SHA-256; not installing it")
    import io
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tf:
        member = next((m for m in tf.getmembers() if m.isfile() and os.path.basename(m.name) == "backpack"), None)
        if member is None:
            raise RuntimeError("the BackPack archive has no 'backpack' binary")
        blob = tf.extractfile(member).read()
    os.makedirs(BP_BIN_DIR, exist_ok=True)
    with open(dest + ".tmp", "wb") as f:
        f.write(blob)
    os.chmod(dest + ".tmp", 0o755)
    os.replace(dest + ".tmp", dest)
    return dest


def bp_unit_text(tid, binary, conf):
    return f"""[Unit]
Description=BackPack tunnel {tid} (managed by the panel)
After=network-online.target

[Service]
ExecStart={binary} -c {conf}
Restart=always
RestartSec=3
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
"""


def _write(path, text, mode):
    try:
        if open(path).read() == text:
            return False
    except FileNotFoundError:
        pass
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path + ".tmp", "w") as f:
        f.write(text)
    os.chmod(path + ".tmp", mode)
    os.replace(path + ".tmp", path)
    return True


def bp_status(unit, token="", ping=""):
    """{"active", "up", "line"}: up comes from the engine's own log (and a ping of the peer for a direct tunnel)."""
    import re
    global _ANSI
    _ANSI = _ANSI or re.compile(r"\x1b\[[0-9;]*m")
    active = _sh("systemctl", "is-active", unit).stdout.strip() == "active"
    lines = [_ANSI.sub("", l) for l in _sh("journalctl", "-u", unit, "-n", "80", "--no-pager", "-o", "cat").stdout.splitlines()]
    verdict, last = None, ""
    for l in lines:
        if re.search(r"transport \w+ is up|tunnel .{0,40}is up|direct: session( \d+)? established|control channel (successfully )?established|l3: .*handshake (complete|completed|ok)", l, re.I) and "attempting" not in l:
            verdict = True
        elif re.search(r"FATAL|failed to read from the control channel|was refused|invalid security token|connection refused|timed out|i/o timeout|control channel .*(lost|closed)|handshake did not complete|layer-3 tunnel stopped|direct: (dial|session).{0,60}(failed|lost|refused)", l, re.I):
            verdict = False
        if "[" in l:
            last = l
    if ping:      # a direct tunnel is up when its far end answers; a server without `ping` falls back to the log
        r = _sh("ping", "-c", "1", "-W", "1", ping)
        if r.returncode != 127:
            verdict = r.returncode == 0
    if token:
        last = last.replace(token, "***")
    return {"active": active, "up": bool(active and verdict), "line": last[-160:]}


def bp_apply(spec):
    """spec = {"base_url", "sha256": {arch: hex}, "tunnels": [{"id", "toml", "ping"?}]} -> {"tunnels": {id: status}, "errors": [...]}.
    Installs/updates what the panel wants and removes the panel's own units that are no longer wanted."""
    import re
    errors, out, wanted = [], {}, set()
    tunnels = spec.get("tunnels", [])
    binary = None
    if tunnels:
        try:
            binary = bp_ensure_binary(spec["base_url"], spec["sha256"])
        except Exception as e:
            errors.append("BackPack install: " + str(e)[:150])
    for t in tunnels:
        tid = str(t["id"])
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,20}", tid):
            continue
        wanted.add(tid)
        unit = f"{BP_PREFIX}{tid}"
        if binary is None:
            out[tid] = {"active": False, "up": False, "line": ""}
            continue
        conf = os.path.join(BP_CONF_DIR, f"bp-{tid}.toml")
        changed = _write(conf, t["toml"], 0o600)
        changed |= _write(os.path.join(BP_UNIT_DIR, unit + ".service"), bp_unit_text(tid, binary, conf), 0o644)
        if changed:
            _sh("systemctl", "daemon-reload")
            _sh("systemctl", "enable", unit)
            _sh("systemctl", "restart", unit)
        elif _sh("systemctl", "is-active", unit).stdout.strip() != "active":
            _sh("systemctl", "restart", unit)
        m = re.search(r'^token\s*=\s*"([^"]+)"', t["toml"], re.M)
        out[tid] = bp_status(unit, m.group(1) if m else "", t.get("ping", ""))
    try:
        names = os.listdir(BP_UNIT_DIR)
    except OSError:
        names = []
    gone = {str(i) for i in spec.get("remove", [])}
    for name in names:     # units the panel no longer wants: every unmanaged one when prune is on, or just the ones named in "remove"
        tid0 = name[len(BP_PREFIX):-8]
        if name.startswith(BP_PREFIX) and name.endswith(".service") and tid0 not in wanted and (spec.get("prune", True) or tid0 in gone):
            tid = name[len(BP_PREFIX):-8]
            _sh("systemctl", "disable", "--now", name)
            extra = []
            try:       # the config and whatever BackPack wrote next to it (e.g. bp-3.metrics.json)
                extra = [os.path.join(BP_CONF_DIR, f) for f in os.listdir(BP_CONF_DIR) if f.startswith(f"bp-{tid}.")]
            except OSError:
                pass
            for path in (os.path.join(BP_UNIT_DIR, name), *extra):
                try:
                    os.remove(path)
                except OSError:
                    pass
            _sh("systemctl", "daemon-reload")
    return {"tunnels": out, "errors": errors}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="mode", required=True)
    bpp = sub.add_parser("bp", help="manage the panel's BackPack tunnels on this server: reads a JSON spec on stdin, prints a JSON status")
    bpp.add_argument("action", choices=["apply"])
    pr = sub.add_parser("probe", help="connection test: listen and dial on one port, print a JSON result")
    pr.add_argument("--peer", required=True)
    pr.add_argument("--port", type=int, required=True)
    pr.add_argument("--seconds", type=int, default=60)
    pr.add_argument("--listen-port", type=int, default=0, help="listen here instead of on --port (tests on one machine)")
    sv = sub.add_parser("server")
    sv.add_argument("--listen", default="0.0.0.0:7000")
    sv.add_argument("--forward", action="append", default=[], metavar="[tcp:|udp:]PORT[=TARGET]")
    sv.add_argument("--dial", default="", metavar="HOST:PORT", help="DIRECT mode: open the tunnel connections to a client started with --listen")
    sv.add_argument("--pool", type=int, default=8)
    sv.add_argument("--status-file", default="", help="JSON file refreshed every 5 s with the pool size and failed ports")
    cl = sub.add_parser("client")
    cl.add_argument("--server", default="", metavar="HOST:PORT")
    cl.add_argument("--listen", default="", metavar="HOST:PORT", help="DIRECT mode: wait for the other side to dial in (instead of --server)")
    cl.add_argument("--pool", type=int, default=8)
    for p in (sv, cl, pr):
        p.add_argument("--token", default=os.environ.get("VTUNNEL_TOKEN", ""))
        p.add_argument("--encrypt", choices=["off", "tcp", "all"], default="off",
                       help="tcp: encrypt the TCP connections; all: also the UDP datagrams (both ends must use the same value)")
    a = ap.parse_args(argv)
    if a.mode == "bp":
        print(json.dumps(bp_apply(json.load(sys.stdin))))
        return
    if a.mode == "probe":
        a.token = a.token or os.environ.get("VTUNNEL_TOKEN", "")
    if len(a.token) < 8:
        sys.exit("--token (or VTUNNEL_TOKEN) must be at least 8 characters")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if a.mode == "probe":
        print(json.dumps(asyncio.run(probe(a.peer, a.port, a.token, a.seconds, a.listen_port or None))))
        return
    if a.mode == "server":
        host, _, port = a.listen.rpartition(":")
        if not a.forward:
            sys.exit("give at least one --forward")
        dial = None
        if a.dial:
            dh, _, dp = a.dial.rpartition(":")
            dial = (dh, int(dp))
        job = Server(a.token, host or "0.0.0.0", int(port), [parse_forward(f) for f in a.forward], a.status_file, a.encrypt, dial, max(1, a.pool)).run()
    else:
        if bool(a.server) == bool(a.listen):
            sys.exit("give exactly one of --server (the other side listens) or --listen (the other side dials)")
        if a.listen:
            lh, _, lp = a.listen.rpartition(":")
            job = Client(a.token, "", 0, 1, a.encrypt, (lh or "0.0.0.0", int(lp))).run()
        else:
            host, _, port = a.server.rpartition(":")
            job = Client(a.token, host, int(port), max(1, a.pool), a.encrypt).run()
    try:
        asyncio.run(job)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
