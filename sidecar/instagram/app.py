"""
Instagram sidecar (UNOFFICIAL): publishes photos/stories to YOUR OWN account through the private mobile API (instagrapi).

WARNING: this violates Instagram's Terms of Use and the account can be challenged, limited or banned.
Use it sparingly, never with someone else's account, and prefer the official Graph API when you can.

The panel is the only client. It listens on 127.0.0.1 and requires the shared secret in `X-Sidecar-Secret`.
Credentials come from env (never from the panel UI). Set IG_DRY_RUN=1 to test the whole flow without touching Instagram.
"""
import hmac
import io
import os
import tempfile
import threading
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from PIL import Image

def _load_env_file():
    """The project .env is the single source of truth for IG_* settings.
    It overrides stale values left in the shell / pm2 environment (e.g. an old IG_DRY_RUN=1)."""
    path = Path(os.environ.get("IG_ENV_FILE", Path(__file__).resolve().parents[2] / ".env"))
    if not path.exists():
        return
    file_vars = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key, val = key.strip(), val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        file_vars[key] = val
    for key in [k for k in os.environ if k.startswith("IG_") and k != "IG_ENV_FILE"]:
        os.environ.pop(key, None)  # a variable removed from .env must really be gone
    for key, val in file_vars.items():
        if key.startswith("IG_"):
            os.environ[key] = val


_load_env_file()

DRY_RUN = os.environ.get("IG_DRY_RUN") == "1"
USERNAME = os.environ.get("IG_USERNAME", "")
PASSWORD = os.environ.get("IG_PASSWORD", "")
SECRET = os.environ.get("IG_SIDECAR_SECRET", "")
SESSION_FILE = Path(os.environ.get("IG_SESSION_FILE", ".data/ig-session.json"))

if len(SECRET) < 16:
    raise SystemExit("IG_SIDECAR_SECRET must be set (16+ chars) so only the panel can call this service")

app = FastAPI(title="Instagram sidecar", docs_url=None, redoc_url=None, openapi_url=None)
_lock = threading.Lock()  # one Instagram operation at a time
_client = None
_state = {"logged_in": False, "username": USERNAME, "error": None, "followers": None, "posts": None}


def _auth(secret: str | None):
    if not secret or not hmac.compare_digest(secret, SECRET):
        raise HTTPException(401, "Unauthorized")


def _err(code: int, kind: str, message: str):
    raise HTTPException(code, {"kind": kind, "message": message})


def _login(code: str = ""):
    """Log in (or reuse the saved session). Caller must hold _lock."""
    global _client
    if DRY_RUN:
        _state.update(logged_in=True, error=None, followers=None, posts=None)
        return
    if not USERNAME or not PASSWORD:
        _err(400, "config", "IG_USERNAME / IG_PASSWORD are not set in the server environment.")
    from instagrapi import Client
    from instagrapi import exceptions as ex

    cl = Client()
    cl.delay_range = [2, 6]  # small human-like pauses between requests
    try:
        if SESSION_FILE.exists():
            cl.load_settings(SESSION_FILE)
        cl.login(USERNAME, PASSWORD, verification_code=code)
        SESSION_FILE.parent.mkdir(parents=True, exist_ok=True)
        cl.dump_settings(SESSION_FILE)
        os.chmod(SESSION_FILE, 0o600)
    except ex.TwoFactorRequired:
        _state.update(logged_in=False, error="two_factor")
        _err(401, "two_factor", "Two-factor code required. Enter the code and press Connect again.")
    except (ex.BadPassword, ex.BadCredentials):
        _state.update(logged_in=False, error="bad_credentials")
        _err(401, "bad_credentials", "Instagram rejected the username or password.")
    except (ex.ChallengeRequired, ex.ChallengeError, ex.ChallengeRedirection, ex.ChallengeUnknownStep):
        _state.update(logged_in=False, error="challenge")
        _err(409, "challenge", "Instagram wants verification. Open the Instagram app, approve the login (\"This was me\"), then press Connect again.")
    except Exception as e:  # noqa: BLE001 - never leak details that could contain credentials
        _state.update(logged_in=False, error="login_failed")
        _err(502, "login_failed", f"Instagram login failed ({type(e).__name__}).")
    _client = cl
    _state.update(logged_in=True, error=None)
    try:  # read-only profile check; a failure here must not break the login
        info = cl.account_info()
        _state.update(username=info.username or USERNAME, followers=getattr(info, "follower_count", None), posts=getattr(info, "media_count", None))
    except Exception:  # noqa: BLE001
        pass


def _ensure():
    if _client is None and not DRY_RUN:
        _login()
    elif DRY_RUN:
        _state.update(logged_in=True)


def _to_jpeg(data: bytes) -> Path:
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:  # noqa: BLE001
        _err(400, "bad_image", "The file is not a valid image.")
    path = Path(tempfile.gettempdir()) / f"ig-{uuid.uuid4().hex}.jpg"
    img.save(path, "JPEG", quality=92)
    return path


@app.get("/status")
def status(x_sidecar_secret: str | None = Header(default=None)):
    _auth(x_sidecar_secret)
    return {"dryRun": DRY_RUN, "loggedIn": _state["logged_in"], "username": _state["username"], "error": _state["error"], "followers": _state["followers"], "posts": _state["posts"]}


@app.post("/login")
def login(code: str = Form(default=""), x_sidecar_secret: str | None = Header(default=None)):
    _auth(x_sidecar_secret)
    with _lock:
        _login(code.strip())
    return {"ok": True, "username": _state["username"], "followers": _state["followers"], "posts": _state["posts"], "dryRun": DRY_RUN}


def _publish(kind: str, file: UploadFile, caption: str):
    data = file.file.read()
    if not data or len(data) > 15 * 1024 * 1024:
        _err(400, "bad_image", "Image is empty or larger than 15 MB.")
    path = _to_jpeg(data)
    try:
        with _lock:
            _ensure()
            if DRY_RUN:
                return {"ok": True, "id": f"dryrun_{uuid.uuid4().hex[:10]}", "dryRun": True}
            from instagrapi import exceptions as ex

            try:
                if kind == "photo":
                    media = _client.photo_upload(path, caption)
                else:
                    media = _client.photo_upload_to_story(path)
                _client.dump_settings(SESSION_FILE)
                return {"ok": True, "id": str(getattr(media, "pk", "")), "dryRun": False}
            except ex.LoginRequired:
                _state.update(logged_in=False, error="session_expired")
                _err(401, "session_expired", "Instagram session expired. Press Connect to log in again.")
            except (ex.ChallengeRequired, ex.ChallengeError):
                _state.update(logged_in=False, error="challenge")
                _err(409, "challenge", "Instagram wants verification. Approve it in the Instagram app, then press Connect.")
            except HTTPException:
                raise
            except Exception as e:  # noqa: BLE001
                _err(502, "publish_failed", f"Instagram refused the upload ({type(e).__name__}).")
    finally:
        path.unlink(missing_ok=True)


@app.post("/publish/photo")
def publish_photo(file: UploadFile = File(...), caption: str = Form(default=""), x_sidecar_secret: str | None = Header(default=None)):
    _auth(x_sidecar_secret)
    return _publish("photo", file, caption[:2200])


@app.post("/publish/story")
def publish_story(file: UploadFile = File(...), x_sidecar_secret: str | None = Header(default=None)):
    _auth(x_sidecar_secret)
    return _publish("story", file, "")
