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

cat > "$work/vault/plan.olai" <<'OLAI'
{"id":"today","ord":"a0","title":"Today"}
{"id":"call","parent":"today","ord":"a0","title":"call the joiner","todo":true,"desc":"about the hinges"}
OLAI

AGENT="$agent" olai_serve "$root" "$work/vault" "$work/server.log"
trap 'kill "$OLAI_SERVER" 2>/dev/null || true; rm -rf "$work"' EXIT

echo "agent:  $agent"
echo "shots:  $shots"
BASE="$OLAI_URL" SHOTS="$shots" bun "$root/packages/tests/panel-live.ts"
