import os
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path

VT = str(Path(__file__).resolve().parent.parent / "agent" / "vtunnel.py")


def free_port(kind=socket.SOCK_STREAM):
    with socket.socket(socket.AF_INET, kind) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def tcp_echo(port):
    srv = socket.socket()
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", port))
    srv.listen(50)

    def serve(c):
        while d := c.recv(65536):
            c.sendall(d)
        c.close()

    def loop():
        while True:
            c, _ = srv.accept()
            threading.Thread(target=serve, args=(c,), daemon=True).start()
    threading.Thread(target=loop, daemon=True).start()
    return srv


def udp_echo(port):
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.bind(("127.0.0.1", port))

    def loop():
        while True:
            d, a = s.recvfrom(65535)
            s.sendto(d, a)
    threading.Thread(target=loop, daemon=True).start()
    return s


def launch(*args):
    return subprocess.Popen([sys.executable, VT, *args], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)


def wait_port(port, timeout=8):
    end = time.time() + timeout
    while time.time() < end:
        try:
            socket.create_connection(("127.0.0.1", port), 0.3).close()
            return True
        except OSError:
            time.sleep(0.1)
    return False


def tcp_roundtrip(port, payload=b"hello", timeout=5):
    with socket.create_connection(("127.0.0.1", port), timeout) as c:
        c.settimeout(timeout)
        c.sendall(payload)
        got = b""
        while len(got) < len(payload):
            d = c.recv(65536)
            if not d:
                break
            got += d
        return got


def test_tcp_and_udp_through_the_tunnel():
    ctl, user_tcp, user_udp, tgt_tcp, tgt_udp = free_port(), free_port(), free_port(socket.SOCK_DGRAM), free_port(), free_port(socket.SOCK_DGRAM)
    tcp_echo(tgt_tcp)
    udp_echo(tgt_udp)
    srv = launch("server", "--listen", f"127.0.0.1:{ctl}", "--token", "secret-token-1", "--forward", f"{user_tcp}={tgt_tcp}",
                 "--forward", f"udp:{user_udp}={tgt_udp}")
    try:
        assert wait_port(user_tcp)
        cl = launch("client", "--server", f"127.0.0.1:{ctl}", "--token", "secret-token-1", "--pool", "3")
        try:
            time.sleep(1.0)
            assert tcp_roundtrip(user_tcp, b"x" * 300000) == b"x" * 300000       # large payload, both directions
            for _ in range(10):                                                  # many short connections reuse the pool
                assert tcp_roundtrip(user_tcp, b"ping") == b"ping"
            u = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            u.settimeout(3)
            for i in range(5):
                u.sendto(b"dgram%d" % i, ("127.0.0.1", user_udp))
                assert u.recvfrom(100)[0] == b"dgram%d" % i
            # the client restarts: the tunnel recovers by itself
            cl.kill()
            cl.wait()
            cl = launch("client", "--server", f"127.0.0.1:{ctl}", "--token", "secret-token-1", "--pool", "3")
            time.sleep(1.5)
            assert tcp_roundtrip(user_tcp, b"again") == b"again"
        finally:
            cl.kill()
    finally:
        srv.kill()


def test_wrong_token_is_rejected():
    ctl, user_tcp, tgt = free_port(), free_port(), free_port()
    tcp_echo(tgt)
    srv = launch("server", "--listen", f"127.0.0.1:{ctl}", "--token", "right-token-1", "--forward", f"{user_tcp}={tgt}")
    try:
        assert wait_port(user_tcp)
        cl = launch("client", "--server", f"127.0.0.1:{ctl}", "--token", "wrong-token-1", "--pool", "2")
        try:
            time.sleep(1.5)
            try:
                got = tcp_roundtrip(user_tcp, b"nope", timeout=5)
            except OSError:
                got = b""
            assert got != b"nope"
        finally:
            cl.kill()
    finally:
        srv.kill()
