
## Import from 3x-ui

`POST /api/import/users` — body `{"clients":[{"name","uuid","quota_bytes","used_bytes","expire_ms","enabled"}],"protos":[...],"node_ids":[...]}`.
Keeps UUID, quota, expiry and used traffic; names that already exist are skipped. `agent/import_xui.py` builds this from `/etc/x-ui/x-ui.db` (run on the 3x-ui server).

`POST /api/users/bulk-protos` — `{"add":["vless_raw"],"remove":["vless"],"names":[]}` changes protocols for many users (all when `names` is empty).

`POST /api/users/bulk` — `{"ids":[...],"delete":false,"add_protos":[],"remove_protos":[],"node_ids":null}`: delete many users, or add/remove protocols and set locations (`[]` = every location, `null` = unchanged). The users tab has checkboxes, a search box and a bulk dialog for this.

`PUT /api/nodes/{id}/protocols/{proto}/host` — `{"host":"relay.example.com"}`: domain or IP clients of that protocol connect to (empty = automatic, the node address). Only links change; TLS names and certificates keep using the node address.

## Sub-admins (resellers)
`POST /api/login` takes `{"username":"sara","password":"..."}` for a sub-admin (empty username = main admin).
Main admin: `GET/POST /api/admins`, `PATCH/DELETE /api/admins/{id}` (`enabled`, `password`, `max_users`, `max_quota_gb`, `max_days`; 0 = no cap).
A sub-admin session only works on `/api/me`, `/api/me/options`, `/api/me/users` (GET, POST) and `/api/me/users/{id}/configs`; everything else answers 403.

## Branding
`GET /api/branding` (public) -> `{name, logo, color}`. `PUT /api/branding` (main admin) with `{"name":"My VPN","color":"#7c3aed","logo":"data:image/png;base64,..."}`; empty `logo`/`color` restore the defaults. The name, logo and colour appear in the panel, the login box, the browser tab and the users' subscription page.

### Per-admin permissions
`can_edit` and `can_delete` (both default `false`) on `/api/admins`. With them a sub-admin may `PATCH /api/me/users/{id}` (`enabled`, `quota_gb`, `days`, `extend_days`, `reset_usage`, still within `max_quota_gb`/`max_days`) and `DELETE /api/me/users/{id}`, on their own users only. Without the permission both answer 403.

## DNSTT (DNS tunnel)
`GET/PUT /api/dnstt` (`domain`, `zone`, `cf_token`; the token is never returned, only `token_set`), `POST /api/dnstt/sync`.
Turning the `dnstt` protocol on or off for a node (`PUT /api/nodes/{id}/protocols/dnstt`) makes the panel create/remove that node's records in Cloudflare:
`A nsd<node id>.<zone>` -> node IP and `NS <tunnel domain>` -> that name. Records it did not create are never touched.
The first node that generates the key pair reports it; the panel keeps that key and hands it to every node, so all nodes answer for the same domain.
Users with the `dnstt` protocol get one config entry (domain, public key, UUID, dnstt-client commands). Inside the tunnel runs a loopback-only VLESS inbound, so each user is metered and limited like any other.

### DNSTT inner protocol
`inner` on `PUT /api/dnstt` is `ssh` (default; what NetMod's "DNSTT + SSH" speaks) or `vless`. In `ssh` mode each node runs a loopback-only sshd (`127.0.0.1:2222`, its own config, unit `vpn-node-sshd`) and manages accounts `vs_<name>` (group `vpnssh`, shell `nologin`, password = the panel user's password); expired or disabled users are removed and their sessions killed. SSH traffic is **not** counted against the user's volume. In `vless` mode a loopback Xray inbound is used and the traffic is counted.
