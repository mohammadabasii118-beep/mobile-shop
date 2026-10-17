
## Import from 3x-ui

`POST /api/import/users` — body `{"clients":[{"name","uuid","quota_bytes","used_bytes","expire_ms","enabled"}],"protos":[...],"node_ids":[...]}`.
Keeps UUID, quota, expiry and used traffic; names that already exist are skipped. `agent/import_xui.py` builds this from `/etc/x-ui/x-ui.db` (run on the 3x-ui server).

`POST /api/users/bulk-protos` — `{"add":["vless_raw"],"remove":["vless"],"names":[]}` changes protocols for many users (all when `names` is empty).

`POST /api/users/bulk` — `{"ids":[...],"delete":false,"add_protos":[],"remove_protos":[],"node_ids":null}`: delete many users, or add/remove protocols and set locations (`[]` = every location, `null` = unchanged). The users tab has checkboxes, a search box and a bulk dialog for this.
