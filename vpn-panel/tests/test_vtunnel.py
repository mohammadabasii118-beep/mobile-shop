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


def test_busy_port_does_not_take_the_others_down_and_status_file_reports_it(tmp_path):
    import json
    ctl, good, tgt = free_port(), free_port(), free_port()
    busy = socket.socket()
    busy.bind(("0.0.0.0", 0))
    busy.listen(1)
    busy_port = busy.getsockname()[1]
    tcp_echo(tgt)
    status = tmp_path / "s.json"
    srv = launch("server", "--listen", f"127.0.0.1:{ctl}", "--token", "status-token-1", "--status-file", str(status),
                 "--forward", str(busy_port), "--forward", f"{good}={tgt}")
    try:
        assert wait_port(good)
        cl = launch("client", "--server", f"127.0.0.1:{ctl}", "--token", "status-token-1", "--pool", "2")
        try:
            end = time.time() + 12
            st = {}
            while time.time() < end:
                try:
                    st = json.loads(status.read_text())
                    if st.get("pool", 0) >= 2:
                        break
                except (OSError, ValueError):
                    pass
                time.sleep(0.5)
            assert st["failed"] == [f"tcp/{busy_port}"] and st["pool"] >= 2
            assert tcp_roundtrip(good, b"still works") == b"still works"
        finally:
            cl.kill()
    finally:
        srv.kill()
        busy.close()


def _run_modes(srv_mode, cl_mode, token_c="enc-token-12345", expect_ok=True):
    ctl, user_tcp, user_udp, tgt_tcp, tgt_udp = free_port(), free_port(), free_port(socket.SOCK_DGRAM), free_port(), free_port(socket.SOCK_DGRAM)
    tcp_echo(tgt_tcp)
    udp_echo(tgt_udp)
    srv = launch("server", "--listen", f"127.0.0.1:{ctl}", "--token", "enc-token-12345", "--encrypt", srv_mode,
                 "--forward", f"{user_tcp}={tgt_tcp}", "--forward", f"udp:{user_udp}={tgt_udp}")
    try:
        assert wait_port(user_tcp)
        cl = launch("client", "--server", f"127.0.0.1:{ctl}", "--token", token_c, "--encrypt", cl_mode, "--pool", "2")
        try:
            time.sleep(1.5)
            if not expect_ok:
                try:
                    got = tcp_roundtrip(user_tcp, b"nope", timeout=4)
                except OSError:
                    got = b""
                assert got != b"nope"
                return
            assert tcp_roundtrip(user_tcp, b"z" * 200000) == b"z" * 200000
            assert tcp_roundtrip(user_tcp, b"hi") == b"hi"
            u = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            u.settimeout(3)
            u.sendto(b"game-packet", ("127.0.0.1", user_udp))
            assert u.recvfrom(100)[0] == b"game-packet"
        finally:
            cl.kill()
    finally:
        srv.kill()


def test_encrypted_tcp_only():
    _run_modes("tcp", "tcp")


def test_encrypted_tcp_and_udp():
    _run_modes("all", "all")


def test_encryption_mismatch_and_wrong_token_are_rejected():
    _run_modes("tcp", "off", expect_ok=False)
    _run_modes("off", "tcp", expect_ok=False)
    _run_modes("tcp", "tcp", token_c="another-token-1", expect_ok=False)


def test_encrypted_stream_has_no_plaintext_marker():
    """What an observer sees on the tunnel port: no 'VT1' magic, only random-looking bytes."""
    ctl, user_tcp, tgt = free_port(), free_port(), free_port()
    tcp_echo(tgt)
    srv = launch("server", "--listen", f"127.0.0.1:{ctl}", "--token", "enc-token-12345", "--encrypt", "tcp", "--forward", f"{user_tcp}={tgt}")
    try:
        assert wait_port(user_tcp)
        c = socket.create_connection(("127.0.0.1", ctl), 3)
        c.settimeout(3)
        c.sendall(os.urandom(16))
        reply = c.recv(100)
        assert len(reply) == 16 and b"VT1" not in reply
        c.close()
    finally:
        srv.kill()


def test_probe_measures_both_directions_and_rejects_wrong_token():
    import json
    a, b = free_port(), free_port()
    mk = lambda lp, pp, tok: subprocess.Popen([sys.executable, VT, "probe", "--peer", "127.0.0.1", "--port", str(pp), "--listen-port", str(lp),
                                               "--token", tok, "--seconds", "26"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    pa, pb = mk(a, b, "probe-token-1"), mk(b, a, "probe-token-1")
    ra, rb = json.loads(pa.communicate(timeout=60)[0]), json.loads(pb.communicate(timeout=60)[0])
    for r in (ra, rb):
        assert r["ok"] and r["rtt_ms"] < 50 and r["down_mbps"] > 5 and r["up_mbps"] > 5 and r["udp_loss_pct"] <= 10, r
    pa, pb = mk(a, b, "probe-token-1"), mk(b, a, "another-token")          # the far side does not know the token: no data flows
    ra = json.loads(pa.communicate(timeout=60)[0])
    pb.communicate(timeout=60)
    assert ra["ok"] is False


def _run_direct(mode, token_back="direct-token-12"):
    ctl, user_tcp, user_udp, tgt_tcp, tgt_udp = free_port(), free_port(), free_port(socket.SOCK_DGRAM), free_port(), free_port(socket.SOCK_DGRAM)
    tcp_echo(tgt_tcp)
    udp_echo(tgt_udp)
    # the BACK side (foreign) listens; the FRONT side (users) dials it
    back = launch("client", "--listen", f"127.0.0.1:{ctl}", "--token", token_back, "--encrypt", mode)
    time.sleep(0.8)
    front = launch("server", "--dial", f"127.0.0.1:{ctl}", "--token", "direct-token-12", "--encrypt", mode, "--pool", "3",
                   "--forward", f"{user_tcp}={tgt_tcp}", "--forward", f"udp:{user_udp}={tgt_udp}")
    try:
        assert wait_port(user_tcp)
        time.sleep(1.5)
        return back, front, user_tcp, user_udp
    except Exception:
        back.kill()
        front.kill()
        raise


def test_direct_mode_tcp_and_udp():
    for mode in ("off", "tcp", "all"):
        back, front, user_tcp, user_udp = _run_direct(mode)
        try:
            assert tcp_roundtrip(user_tcp, b"d" * 200000) == b"d" * 200000
            for _ in range(8):                                                   # the pool refills after each use
                assert tcp_roundtrip(user_tcp, b"ping") == b"ping"
            u = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            u.settimeout(3)
            u.sendto(b"direct-game", ("127.0.0.1", user_udp))
            assert u.recvfrom(100)[0] == b"direct-game", mode
        finally:
            back.kill()
            front.kill()


def test_direct_mode_rejects_wrong_token_and_survives_a_restart_of_the_back_side():
    back, front, user_tcp, _ = _run_direct("off", token_back="not-the-token-1")
    try:
        try:
            got = tcp_roundtrip(user_tcp, b"nope", timeout=4)
        except OSError:
            got = b""
        assert got != b"nope"
    finally:
        back.kill()
        front.kill()
    back, front, user_tcp, _ = _run_direct("off")
    try:
        assert tcp_roundtrip(user_tcp, b"one") == b"one"
        ctl = int(back.args[back.args.index("--listen") + 1].rsplit(":", 1)[1])
        back.kill()
        back.wait()
        back = launch("client", "--listen", f"127.0.0.1:{ctl}", "--token", "direct-token-12")
        time.sleep(5)                                                            # the front side redials within a few seconds
        assert tcp_roundtrip(user_tcp, b"two") == b"two"
    finally:
        back.kill()
        front.kill()
