#!/usr/bin/env bash
set -euo pipefail

. support/serve.sh

root=${ROOT:-$(cd ../.. && pwd)}
label=${LABEL:-$(basename "$root")}
shots=${SHOTS:-$PWD/shots}

if [ -n "${PORT:-}" ]; then
  olai_port_free "$PORT" "the shots"
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/vault" "$shots"

VAULT="$work/vault" bun skew.ts --seed

olai_serve "$root" "$work/vault" "$work/server.log"
trap 'kill "$OLAI_SERVER" 2>/dev/null || true; rm -rf "$work"' EXIT

LABEL="$label" BASE="$OLAI_URL" VAULT="$work/vault" SHOTS="$shots" \
  bun skew.ts
