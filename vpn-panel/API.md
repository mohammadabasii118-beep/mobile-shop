
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
