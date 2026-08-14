#!/usr/bin/env bash
# Run each section of evidence.ts against a FRESH directory and a FRESH server.
#
#   SHOTS=/somewhere sh evidence.sh
#
# Expects to be run from packages/tests, inside `nix develop .#e2e`, with the
# client already built (`just build-client`).
set -euo pipefail

root=$(cd ../.. && pwd)
shots=${SHOTS:-$PWD/shots}
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
    bun "$root/packages/server/src/main.ts" web "$work/vault" --port 7799 \
    > "$work/server.log" 2>&1 &
  server=$!
  for _ in $(seq 1 60); do
    curl -sf -o /dev/null http://127.0.0.1:7799/ && break
    sleep 0.25
  done
  SECTION="$section" BASE=http://127.0.0.1:7799 SHOTS="$shots" bun evidence.ts
  kill "$server" 2>/dev/null || true
  wait "$server" 2>/dev/null || true
done

echo
echo "shots in $shots"
