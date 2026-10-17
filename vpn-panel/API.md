
## Import from 3x-ui

`POST /api/import/users` — body `{"clients":[{"name","uuid","quota_bytes","used_bytes","expire_ms","enabled"}],"protos":[...],"node_ids":[...]}`.
Keeps UUID, quota, expiry and used traffic; names that already exist are skipped. `agent/import_xui.py` builds this from `/etc/x-ui/x-ui.db` (run on the 3x-ui server).
