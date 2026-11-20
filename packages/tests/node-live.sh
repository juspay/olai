#!/usr/bin/env bash
set -euo pipefail

. support/serve.sh

root=${ROOT:-$(cd ../.. && pwd)}
agent=${AGENT:-$(nix build "$root#claude-agent" --no-link --print-out-paths --accept-flake-config)/bin/claude-agent-acp}
shots=${SHOTS:-$(mktemp -d)}
mkdir -p "$shots"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/vault"

cat > "$work/vault/lanes.olai" <<'OLAI'
{"id":"lanes","ord":"a0","title":"Lanes"}
{"id":"connector","parent":"lanes","ord":"a0","title":"watch the connector","doing":true,"desc":"the joiner's hinges, and whether the socket moved"}
{"id":"notes","parent":"connector","ord":"a0","title":"the socket is 4mm proud on the left"}
OLAI

AGENT="$agent" olai_serve "$root" "$work/vault" "$work/server.log"
trap 'kill "$OLAI_SERVER" 2>/dev/null || true; rm -rf "$work"' EXIT

echo "agent:  $agent"
echo "vault:  $work/vault"
echo "shots:  $shots"
BASE="$OLAI_URL" VAULT="$work/vault" SHOTS="$shots" bun "$root/packages/tests/node-live.ts"
