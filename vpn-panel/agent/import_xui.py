#!/usr/bin/env python3
"""Copy the clients of one 3x-ui inbound into the panel (keeps UUID, quota, expiry and used traffic).

Run as root on the 3x-ui server (read-only on x-ui.db):
    python3 import_xui.py INBOUND_ID https://panel.example.com API_KEY PROTOS [NODE_IDS] [--dry-run]
PROTOS is comma separated, e.g. vless-reality,vless-ws. NODE_IDS is comma separated panel location ids (empty = all).
Safe to repeat: users whose name already exists in the panel are skipped. Standard library only."""
import json
import sqlite3
import sys
import urllib.request

DB = "/etc/x-ui/x-ui.db"


def load(inbound_id):
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    row = con.execute("SELECT settings, remark FROM inbounds WHERE id=?", (inbound_id,)).fetchone()
    if not row:
        sys.exit(f"inbound {inbound_id} not found in {DB}")
    traffic = {e: (up + down, exp) for e, up, down, exp in
               con.execute("SELECT email, up, down, expiry_time FROM client_traffics WHERE inbound_id=?", (inbound_id,))}
    clients = []
    for c in json.loads(row[0]).get("clients", []):
        email = c.get("email") or c.get("id", "")[:8]
        used, _ = traffic.get(email, (0, 0))
        clients.append({"name": email, "uuid": c.get("id") or c.get("password", ""),
                        "quota_bytes": max(0, int(c.get("totalGB", 0))), "used_bytes": int(used),
                        "expire_ms": int(c.get("expiryTime", 0)), "enabled": bool(c.get("enable", True))})
    return row[1], clients


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) < 4 or not args[0].isdigit() or not args[1].startswith("http"):
        sys.exit(__doc__)
    remark, clients = load(int(args[0]))
    print(f'inbound {args[0]} "{remark}": {len(clients)} clients')
    if "--dry-run" in sys.argv:
        for c in clients[:5]:
            print(" ", c)
        return
    body = {"clients": clients, "protos": args[3].split(","),
            "node_ids": [int(x) for x in args[4].split(",")] if len(args) > 4 and args[4] else []}
    req = urllib.request.Request(args[1].rstrip("/") + "/api/import/users", json.dumps(body).encode(),
                                 {"Content-Type": "application/json", "Authorization": "Bearer " + args[2]})
    res = json.load(urllib.request.urlopen(req, timeout=120))
    print(f"created {res['created']}, skipped {len(res['skipped'])} (already exist)")


if __name__ == "__main__":
    main()
