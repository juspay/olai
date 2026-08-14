#!/usr/bin/env bash
# Run each section of evidence.ts against a FRESH directory and a FRESH server.
#
#   SHOTS=/somewhere sh evidence.sh
#   PORT=7801 SHOTS=/somewhere sh evidence.sh   # a second worktree at once
#
# Expects to be run from packages/tests, inside `nix develop .#e2e`, with the
# client already built (`just build-client`).
#
# PORT is a knob because this repo is worked in several git WORKTREES at once,
# and a fixed port means the second one silently drives the FIRST one's client:
# the server here fails to bind, the curl below succeeds against whatever is
# already listening, and every screenshot is of the other branch. That is not
# hypothetical — it cost two runs of this script and looked like a missing
# feature. It is checked as well as configurable, below.
set -euo pipefail

root=$(cd ../.. && pwd)
port=${PORT:-7799}
shots=${SHOTS:-$PWD/shots}

if ss -ltn 2>/dev/null | grep -q "127.0.0.1:$port "; then
  echo "port $port is already taken — another worktree's evidence run, most" >&2
  echo "likely. Re-run with PORT=<free port>; the shots would otherwise be of" >&2
  echo "whatever is already serving there." >&2
  exit 1
fi
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$shots"

for section in $(SECTION= bun evidence.ts); do
  echo
  echo "── $section ──────────────────────────────────────────────"
  rm -rf "$work/vault"
  mkdir -p "$work/vault"
  cp -r fixtures/good/. "$work/vault/"
  OLAI_DIST_DIR="$root/packages/web/dist" OLAI_ACP_AGENT= \
    bun "$root/packages/server/src/main.ts" web "$work/vault" --port "$port" \
    > "$work/server.log" 2>&1 &
  server=$!
  for _ in $(seq 1 60); do
    curl -sf -o /dev/null "http://127.0.0.1:$port/" && break
    sleep 0.25
  done
  SECTION="$section" BASE="http://127.0.0.1:$port" SHOTS="$shots" \
    VAULT="$work/vault" bun evidence.ts
  kill "$server" 2>/dev/null || true
  wait "$server" 2>/dev/null || true
done

echo
echo "shots in $shots"
