#!/usr/bin/env bash
# Print an MCP READ session against a fixture vault — see reads.ts for what the
# session asks and why.
#
#   bash reads.sh
#   bash reads.sh > /somewhere/reads.txt
#   PORT=7803 bash reads.sh          # pin a port (optional; the default asks the OS)
#
# Expects to be run from packages/tests, inside `nix develop`, with the client
# already built (`just build-client`) — the server serves it whether or not this
# driver opens a browser, and it does not.
#
# The VAULT is written here rather than taken from `fixtures/`, because the
# session's whole subject is the SHAPE of a directory: an outline with more than
# one top-level root (which is what the file arm exists for), notes under some
# of the tasks (which is what the flag brings back), a second outline to be a
# typo's near miss, and one file that does not parse. A fixture shared with the
# suite would drift away from the exhibit the moment a scenario needed a row.
#
# How a server is stood up is `support/serve.sh`'s, shared with wire.sh and
# skew.sh: one spelling of the boot, so a driver cannot end up printing a
# session against a server that was never started, or another worktree's.
set -euo pipefail

. support/serve.sh

root=${ROOT:-$(cd ../.. && pwd)}

if [ -n "${PORT:-}" ]; then
  olai_port_free "$PORT" "the session"
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/vault"

cat > "$work/vault/plan.olai" <<'OLAI'
{"id":"today","ord":"a0","title":"Today"}
{"id":"call","parent":"today","ord":"a0","title":"call the joiner","todo":true,"desc":"about the hinges, and whether the delivery slot still stands"}
{"id":"measure","parent":"call","ord":"a0","title":"measure the alcove first"}
{"id":"later","ord":"a1","title":"Later"}
{"id":"tiles","parent":"later","ord":"a0","title":"choose the splashback","todo":true,"desc":"matte, if the budget survives the cabinets"}
{"id":"echo","ord":"a2","mirror":"call"}
OLAI

printf '{"id":"scrap","ord":"a0","title":"a scrap"}\n' > "$work/vault/notes.olai"
printf '{ not a record\n' > "$work/vault/torn.olai"

olai_serve "$root" "$work/vault" "$work/server.log"
trap 'kill "$OLAI_SERVER" 2>/dev/null || true; rm -rf "$work"' EXIT

echo "vault:"
for file in plan.olai notes.olai torn.olai; do
  echo "  $file"
  sed 's/^/    /' "$work/vault/$file"
done

BASE="$OLAI_URL" bun reads.ts
