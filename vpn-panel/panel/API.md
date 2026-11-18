# Panel API (for bots and scripts)

Base URL: your panel address, e.g. `https://panel.example.com`. Everything is JSON.

**Authentication.** Send `Authorization: Bearer <PANEL_API_KEY>`. The key is in `.env` on the panel server
(`/opt/vpn-panel/vpn-panel/.env`); keep it secret, it is a full admin credential. Alternatively `POST /api/login`
`{"password": "..."}` returns a token valid for 7 days.

| Method and path | What it does |
|---|---|
| `GET /api/nodes` | Locations with `online`, `load`, protocols and ports |
| `GET /api/protocols` | Protocol ids, labels, whether usage is counted (`counted`) |
| `GET /api/users` | All users |
| `GET /api/users/by-name/{name}` | One user |
| `POST /api/users` | Create: `{"name": "ali", "quota_gb": 50, "days": 30, "protos": ["vless","l2tp"], "node_ids": []}`. `quota_gb` 0 and `days` 0 mean unlimited; empty `node_ids` means all locations. |
| `PATCH /api/users/{id}` | `{"enabled": true}`, `{"quota_gb": 100}`, `{"days": 30}` (expire 30 days from now), `{"extend_days": 30, "reset_usage": true}` (renew), `{"protos": [...]}`, `{"node_ids": [...]}` |
| `DELETE /api/users/{id}` | Delete |
| `POST /api/users/{id}/rotate` | New subscription link and new credentials (uuid, passwords, WireGuard key); every old link stops working. Returns the user with the new `sub_url`. Quota, expiry and usage are kept. |
| `GET /api/users/{id}/configs` | Every config of the user: `link`, or `summary` / `copy` for manual protocols (`file_ext` is `conf` or `ovpn` for protocols delivered as a file) |

A user object: `id, name, status (active|disabled|expired|quota), used_gb, quota_gb, days_left, expire_at, protos, node_ids, sub_url`.

**What to give the customer.** `sub_url` (`https://panel.example.com/sub/<token>`). Opened in a browser it shows
usage, time left, copy buttons and file downloads; in a VPN app it is the subscription. Files for WireGuard and
OpenVPN: `<sub_url>/file/<node_id>/<proto>`.

Errors are `{"detail": "..."}` with the HTTP status (401 bad key, 409 name exists, 422 invalid input, 404 unknown id).

```bash
KEY=...   # PANEL_API_KEY
curl -s -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"name":"ali","quota_gb":50,"days":30,"protos":["vless","l2tp"]}' https://panel.example.com/api/users
curl -s -X PATCH -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"extend_days":30,"reset_usage":true}' https://panel.example.com/api/users/1
```
