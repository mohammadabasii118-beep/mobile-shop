"""The panel's reverse-proxy settings (Caddy). Standard library only: the installer runs it on the host, the panel in its container.

  admin.json   {"port": 37214, "path": "9f3a1c7e5b2d4a68"}  where the login and admin pages live (absent = on the normal address)
  Caddyfile    generated from it; Caddy watches the file and reloads by itself

With a port and a path, the normal address answers only what nodes and subscription links need (404 for everything else,
login page included) and the login page lives at https://domain:PORT/PATH/."""
import json
import os
import re
import sys

PORT_RE, PATH_RE = re.compile(r"^[0-9]{2,5}$"), re.compile(r"^[A-Za-z0-9_-]{6,64}$")
RESERVED = {22, 25, 53, 80, 443, 8000}   # taken by SSH, mail, DNS, the web itself and the panel behind Caddy
PUBLIC_PATHS = "/sub/* /api/node/* /api/relay/* /node/* /relay/* /node-install.sh /relay-install.sh /vtunnel.py"
UPSTREAM = "127.0.0.1:8000"
HEADERS = """\theader {
\t\tX-Content-Type-Options nosniff
\t\tX-Frame-Options DENY
\t\tReferrer-Policy no-referrer
\t\t-Server
\t}"""


def check(port, path):
    """-> error text or None"""
    if not (str(port).isdigit() and 1024 <= int(port) <= 65535) or int(port) in RESERVED:
        return "پورت باید بین ۱۰۲۴ و ۶۵۵۳۵ باشد و پورت‌های رزرو (۸۰، ۴۴۳، ۸۰۰۰ و ...) نیست"
    if not PATH_RE.match(path or ""):
        return "مسیر باید ۶ تا ۶۴ حرف انگلیسی، عدد، - یا _ باشد"
    return None


def render(frm, port=None, path=None):
    out = ["# generated (panel settings or install-panel.sh); Caddy reloads it by itself, do not edit"]
    if not port or not path:
        out.append(f"{frm} {{\n{HEADERS}\n\treverse_proxy {UPSTREAM}\n}}")
    else:
        out.append(f"{frm} {{\n{HEADERS}\n\t@public path {PUBLIC_PATHS}\n\thandle @public {{\n\t\treverse_proxy {UPSTREAM}\n\t}}\n\thandle {{\n\t\trespond 404\n\t}}\n}}\n")
        out.append(f"{frm}:{port} {{\n{HEADERS}\n\tredir /{path} /{path}/ 308\n\thandle_path /{path}/* {{\n\t\treverse_proxy {UPSTREAM}\n\t}}\n\thandle {{\n\t\trespond 404\n\t}}\n}}")
    return "\n".join(out) + "\n"


def load(directory):
    try:
        data = json.load(open(os.path.join(directory, "admin.json")))
        if not check(data.get("port"), data.get("path")):
            return {"port": int(data["port"]), "path": data["path"]}
    except (OSError, ValueError, TypeError):
        pass
    return {"port": None, "path": None}


def write(directory, frm, port=None, path=None):
    """Writes admin.json and the Caddyfile (atomically: a half-written file is never read)."""
    if port or path:
        err = check(port, path)
        if err:
            raise ValueError(err)
    os.makedirs(directory, exist_ok=True)
    for name, text in (("admin.json", json.dumps({"port": int(port), "path": path} if port and path else {})),
                       ("Caddyfile", render(frm, port, path))):
        tmp = os.path.join(directory, name + ".tmp")
        with open(tmp, "w") as f:
            f.write(text)
        os.chmod(tmp, 0o644)
        os.replace(tmp, os.path.join(directory, name))


def admin_url(frm, port, path):
    scheme, _, host = frm.partition("://") if "://" in frm else ("https", "", frm)
    return f"{scheme}://{host or frm}:{port}/{path}/"


def main(argv):
    """caddyfile.py FROM DIR [PORT PATH | off]   (no 3rd argument: keep the current admin.json)"""
    frm, directory, rest = argv[0], argv[1], argv[2:]
    if rest == ["off"]:
        write(directory, frm)
    elif len(rest) == 2:
        write(directory, frm, int(rest[0]), rest[1])
    else:
        cur = load(directory)
        write(directory, frm, cur["port"], cur["path"])


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except ValueError as e:
        sys.exit(str(e))
