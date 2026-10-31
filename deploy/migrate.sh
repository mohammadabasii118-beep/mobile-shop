#!/usr/bin/env bash
# Move the whole bot to another server.
#   old server:  bash deploy/migrate.sh export [/path/archive.tar.gz]     (run inside the project folder, e.g. ~/vpn-bot)
#   new server:  bash migrate.sh import /path/archive.tar.gz              (Docker must be installed; project is restored to ~/vpn-bot)
# The archive holds EVERYTHING: database dump, uploaded receipts, .env (bot token, SECRETS_KEY, DB password) and server config files.
# It contains secrets -> copy it server-to-server (scp) and delete it afterwards.
set -euo pipefail

cmd=${1:-}
die() { echo "ERROR: $*" >&2; exit 1; }

export_all() {
  [ -f docker-compose.yml ] && [ -f .env ] || die "run this inside the project folder (the one with docker-compose.yml and .env)"
  local out=${1:-$HOME/vpn-bot-migration-$(date +%F_%H%M).tar.gz}
  tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
  if [ -n "$(docker compose ps -q --status running bot 2>/dev/null)" ]; then
    echo "WARNING: the bot is still running. Orders made after this backup will NOT be in the archive."
    echo "         For the final move stop it first:  docker compose stop bot   (then run this again)"
    read -r -p "Continue anyway? [y/N] " a; [ "$a" = y ] || exit 1
  fi
  docker compose up -d db >/dev/null
  echo "[1/4] database"
  docker compose exec -T db pg_dump -U vpn --no-owner vpnbot | gzip > "$tmp/db.sql.gz"
  [ "$(gunzip -c "$tmp/db.sql.gz" | wc -c)" -gt 1000 ] || die "database dump looks empty"
  echo "[2/4] receipts"
  local vol; vol=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/data/receipts"}}{{.Name}}{{end}}{{end}}' "$(docker compose ps -a -q bot)" 2>/dev/null || true)
  [ -n "$vol" ] || die "cannot find the receipts volume (has the bot ever been started?)"
  docker run --rm -v "$vol":/r -v "$tmp":/b alpine tar czf /b/receipts.tgz -C /r .
  echo "[3/4] project folder (.env, compose file, local edits)"
  tar czf "$tmp/project.tgz" --exclude=node_modules --exclude=dist -C "$(dirname "$PWD")" "$(basename "$PWD")"
  echo "[4/4] server config (Caddy, systemd units)"
  mkdir -p "$tmp/etc"
  for f in /etc/caddy/Caddyfile /etc/systemd/system/panel-relay-bot.service /etc/systemd/system/vpn-bot.service; do [ -f "$f" ] && cp "$f" "$tmp/etc/" || true; done
  for t in User Order Payment VpnService Product Panel; do printf '%s=' "$t" >> "$tmp/counts.txt"; docker compose exec -T db psql -U vpn -d vpnbot -Atc "select count(*) from \"$t\"" >> "$tmp/counts.txt" || true; done
  tar czf "$out" -C "$tmp" .
  chmod 600 "$out"
  echo; echo "DONE: $out ($(du -h "$out" | cut -f1))"; echo "Row counts in this backup:"; tail -n 6 "$tmp/counts.txt"
}

import_all() {
  local arc=${1:-}; [ -f "$arc" ] || die "usage: bash migrate.sh import /path/archive.tar.gz"
  command -v docker >/dev/null || die "install Docker first"
  tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
  tar xzf "$arc" -C "$tmp"
  [ -f "$tmp/project.tgz" ] && [ -f "$tmp/db.sql.gz" ] || die "archive is incomplete"
  if [ -e "$HOME/vpn-bot" ]; then die "$HOME/vpn-bot already exists - move it away first"; fi
  tar xzf "$tmp/project.tgz" -C "$HOME"
  cd "$HOME/vpn-bot"
  echo "[1/3] database"
  docker compose up -d db
  for _ in $(seq 1 30); do docker compose exec -T db pg_isready -U vpn -d vpnbot >/dev/null 2>&1 && break; sleep 2; done
  gunzip -c "$tmp/db.sql.gz" | docker compose exec -T db psql -U vpn -d vpnbot -v ON_ERROR_STOP=1 -q >/dev/null
  echo "[2/3] receipts"
  docker compose up --no-start bot >/dev/null
  local vol; vol=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/data/receipts"}}{{.Name}}{{end}}{{end}}' "$(docker compose ps -a -q bot)")
  [ -n "$vol" ] || die "receipts volume not created"
  docker run --rm -v "$vol":/r -v "$tmp":/b alpine tar xzf /b/receipts.tgz -C /r
  echo "[3/3] start"
  docker compose up -d --build
  mkdir -p "$HOME/vpn-bot-old-config"; cp -r "$tmp/etc/." "$HOME/vpn-bot-old-config/" 2>/dev/null || true
  echo; echo "DONE. Config files from the old server (Caddyfile, systemd units) are in ~/vpn-bot-old-config:"
  ls "$HOME/vpn-bot-old-config"
  echo "Row counts that were in the backup:"; tail -n 6 "$tmp/counts.txt"
}

case "$cmd" in
  export) export_all "${2:-}" ;;
  import) import_all "${2:-}" ;;
  *) echo "usage: bash deploy/migrate.sh export [archive] | bash migrate.sh import archive"; exit 1 ;;
esac
