"""Cloudflare DNS automation for DNSTT: every node that runs the tunnel needs an A record for its name server and an
NS record that delegates the tunnel domain to it. Only records this module created (names `nsd<node id>`) are touched."""
import json
import re
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.cloudflare.com/client/v4"
IPV4 = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")


class CfError(Exception):
    pass


def call(token: str, method: str, path: str, body: dict | None = None):
    req = urllib.request.Request(API + path, json.dumps(body).encode() if body is not None else None, method=method,
                                 headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        try:
            msgs = "; ".join(x.get("message", "") for x in json.load(e).get("errors", []))
        except Exception:
            msgs = ""
        raise CfError(f"Cloudflare HTTP {e.code}: {msgs or e.reason}")
    except Exception as e:
        raise CfError(f"Cloudflare unreachable: {e}")
    if not data.get("success"):
        raise CfError("Cloudflare: " + "; ".join(x.get("message", "") for x in data.get("errors", [])))
    return data["result"]


def ns_host(node_id: int, zone: str) -> str:
    return f"nsd{node_id}.{zone}"


def _find(api, token, zid, rtype, name):
    q = urllib.parse.urlencode({"type": rtype, "name": name, "per_page": 100})
    return api(token, "GET", f"/zones/{zid}/dns_records?{q}")


def sync(token: str, zone: str, domain: str, nodes: list[dict], api=None) -> dict:
    """nodes: [{"id", "address", "enabled"}]. Makes the records match: created for enabled nodes, removed for the rest.
    -> {"zone_id": ..., "nodes": {id: {"a": status, "ns": status}}, "removed": n}; a status is created | exists |
    removed | error: <why>."""
    api = api or call   # looked up per call so tests can swap it
    zones = api(token, "GET", "/zones?" + urllib.parse.urlencode({"name": zone}))
    if not zones:
        raise CfError(f"zone {zone} not found for this token")
    zid = zones[0]["id"]
    out, removed = {}, 0
    mine = re.compile(rf"^nsd(\d+)\.{re.escape(zone)}$")
    want = {n["id"] for n in nodes if n["enabled"]}
    for n in nodes:
        st = out[n["id"]] = {"a": "", "ns": ""}
        host = ns_host(n["id"], zone)
        if not n["enabled"]:
            continue
        try:
            if not IPV4.match(n["address"]):
                raise CfError("node address is not an IPv4 address")
            have = [r for r in _find(api, token, zid, "A", host)]
            if any(r["content"] == n["address"] for r in have):
                st["a"] = "exists"
            else:
                for r in have:   # stale address for the same name: replace it
                    api(token, "DELETE", f"/zones/{zid}/dns_records/{r['id']}")
                api(token, "POST", f"/zones/{zid}/dns_records", {"type": "A", "name": host, "content": n["address"], "ttl": 120, "proxied": False})
                st["a"] = "created"
            if any(r["content"] == host for r in _find(api, token, zid, "NS", domain)):
                st["ns"] = "exists"
            else:
                api(token, "POST", f"/zones/{zid}/dns_records", {"type": "NS", "name": domain, "content": host, "ttl": 120})
                st["ns"] = "created"
        except CfError as e:
            st["a"] = st["a"] or f"error: {e}"
            st["ns"] = st["ns"] or f"error: {e}"
    # remove what we made for nodes that no longer run the tunnel (or were deleted)
    for r in _find(api, token, zid, "NS", domain):
        m = mine.match(r["content"])
        if m and int(m.group(1)) not in want:
            api(token, "DELETE", f"/zones/{zid}/dns_records/{r['id']}")
            removed += 1
    q = urllib.parse.urlencode({"type": "A", "per_page": 1000})
    for r in api(token, "GET", f"/zones/{zid}/dns_records?{q}"):   # A records of nodes that stopped (or were deleted)
        m = mine.match(r["name"])
        if m and int(m.group(1)) not in want:
            api(token, "DELETE", f"/zones/{zid}/dns_records/{r['id']}")
            removed += 1
            if int(m.group(1)) in out:
                out[int(m.group(1))]["a"] = "removed"
    return {"zone_id": zid, "nodes": out, "removed": removed}
