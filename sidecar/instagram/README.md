# Instagram sidecar (unofficial)

Publishes photos and stories to **your own** Instagram account via the private mobile API (`instagrapi`).
**Against Instagram's Terms of Use — the account may be challenged, limited or banned.** Use sparingly.

```bash
cd sidecar/instagram
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```
Environment (put in the project `.env` — the panel reads the same file; for the sidecar export them or use pm2 `--env`):
```
IG_USERNAME=your_instagram_username
IG_PASSWORD=your_password
IG_SIDECAR_SECRET=<16+ random chars, same value in the panel .env>
IG_DRY_RUN=1        # optional: fake publishing, touches nothing on Instagram
```
Run (localhost only):
```bash
.venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8765
```
The session is cached in `.data/ig-session.json` (mode 600) so it does not log in on every post.
