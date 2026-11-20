#!/usr/bin/env bash
set -euo pipefail

. support/serve.sh

root=${ROOT:-$(cd ../.. && pwd)}
label=${LABEL:-$(basename "$root")}

if [ -n "${PORT:-}" ]; then
  olai_port_free "$PORT" "the numbers"
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/vault"
printf '{"id":"house","ord":"a0","title":"house"}\n' > "$work/vault/house.olai"

olai_serve "$root" "$work/vault" "$work/server.log"
trap 'kill "$OLAI_SERVER" 2>/dev/null || true; rm -rf "$work"' EXIT

SESSION="${SESSION:-preview}" LABEL="$label" BASE="$OLAI_URL" VAULT="$work/vault" \
  bun wire.ts
