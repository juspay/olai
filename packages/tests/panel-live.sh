#!/usr/bin/env bash
# Drive the CHAT PANEL against the pinned adapter, for real — see panel-live.ts
# for what it asserts and why the order it asserts it in is the subject.
#
#   bash panel-live.sh                 # the pin this tree builds
#   AGENT=/path/to/claude-agent-acp bash panel-live.sh
#   SHOTS=/somewhere bash panel-live.sh
#
# It needs a real, authenticated `claude` and a built client
# (`just build-client`), and it must be run inside `nix develop .#e2e` — the
# shell that has Playwright's browsers. So it is a thing a person runs at a pin
# bump and never a lane: what it measures is the agent olai SHIPS, patches and
# all, which is exactly what a scripted agent cannot say anything about.
#
# The server is stood up by `support/serve.sh`, the same one spelling `wire.sh`,
# `reads.sh` and `skew.sh` use, so a driver cannot end up photographing a server
# it did not start.
set -euo pipefail

. support/serve.sh

root=${ROOT:-$(cd ../.. && pwd)}
agent=${AGENT:-$(nix build "$root#acp-agent" --no-link --print-out-paths --accept-flake-config)/bin/claude-agent-acp}
shots=${SHOTS:-$(mktemp -d)}
mkdir -p "$shots"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/vault"

# The vault is the driver's own and deliberately small: what is being driven is
# the PANEL, and a corpus shared with the suite would drift away from that the
# moment a scenario needed a row.
cat > "$work/vault/plan.olai" <<'OLAI'
{"id":"today","ord":"a0","title":"Today"}
{"id":"call","parent":"today","ord":"a0","title":"call the joiner","todo":true,"desc":"about the hinges"}
OLAI

AGENT="$agent" olai_serve "$root" "$work/vault" "$work/server.log"
trap 'kill "$OLAI_SERVER" 2>/dev/null || true; rm -rf "$work"' EXIT

echo "agent:  $agent"
echo "shots:  $shots"
BASE="$OLAI_URL" SHOTS="$shots" bun "$root/packages/tests/panel-live.ts"
