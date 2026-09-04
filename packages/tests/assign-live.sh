#!/usr/bin/env bash
# Drive the MIGRATION GESTURE and a real edit against the pinned adapter, for real — see assign-live.ts for
# what it asserts and why the load it makes is the subject.
#
#   bash assign-live.sh                  # the pin this tree builds
#   AGENT=/path/to/claude-agent-acp bash assign-live.sh
#   SHOTS=/somewhere bash assign-live.sh
#
# The same terms as `panel-live.sh`, which this is the other half of: it needs a
# real, authenticated `claude` and a built client (`just build-client`), and it
# must be run inside `nix develop .#e2e` — the shell that has Playwright's
# browsers. A thing a person runs at a pin bump, never a lane.
#
# The server is stood up by `support/serve.sh`, the same one spelling
# `panel-live.sh` uses, so a driver cannot end up photographing a server it did
# not start.
set -euo pipefail

. support/serve.sh

root=${ROOT:-$(cd ../.. && pwd)}
agent=${AGENT:-$(nix build "$root#acp-agent" --no-link --print-out-paths --accept-flake-config)/bin/claude-agent-acp}
shots=${SHOTS:-$(mktemp -d)}
mkdir -p "$shots"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/vault"

# The vault is the driver's own and deliberately small, for `panel-live.sh`'s
# reason. `connector` carries NOTHING — no `agent-session`, no engine — because
# the first thing this driver asserts is the gesture that makes a bare row into
# a node agent, and a fixture that arrived bound would be asserting the fixture.
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
BASE="$OLAI_URL" VAULT="$work/vault" SHOTS="$shots" bun "$root/packages/tests/assign-live.ts"
