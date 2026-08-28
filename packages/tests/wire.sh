#!/usr/bin/env bash
# Measure one session against a WORKTREE's own server — see wire.ts for which
# four sessions there are and what each is asking.
#
#   ROOT=/path/to/a/worktree LABEL=before bash wire.sh
#   SESSION=pages ROOT=… LABEL=…    # the reading session, not the preview one
#   SESSION=filter ROOT=… LABEL=…   # the narrowed-page session (calls, not bytes)
#   AGENT=$PWD/agent/fake-acp-agent.ts SESSION=chat ROOT=… LABEL=…
#                             # one chat turn: bytes AND frames. The only
#                             # session that needs an agent — serve.sh wires
#                             # AGENT through as the server OLAI_ACP_AGENT,
#                             # and without it the panel has nobody to send to.
#   DELAY=125 …               # put that many ms in front of the server, each
#                             # way, so a round trip costs twice it (delay.ts).
#                             # The stop-and-wait half of
#                             # transcript-stream-quadratic is invisible without
#                             # it: on loopback a round trip is free.
#   PORT=7802 …               # pin a port (optional; the default asks the OS)
#
# Expects to be run from packages/tests, inside `nix develop .#e2e`, with the
# named worktree's client already built there (`just build-client` in it).
#
# ROOT is the knob the whole thing exists for: the driver (wire.ts) imports no
# olai package at all, so the same driver measures a server from this branch and
# one from master, and the two numbers are of the same session. Everything else
# — the vault, the files in it, the browser — is this script's, so the only
# difference between two runs is the code being served.
#
# How a server is stood up is `support/serve.sh`'s, shared with reads.sh and
# skew.sh:
# one spelling of the boot, so a driver cannot end up measuring a server that
# was never started — or another worktree's, which a shared PORT= used to do.
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
# One outline, so the app has a tree to draw and the session is an ordinary one
# rather than a directory with nothing in it. The measured files are the
# driver's own.
printf '{"id":"house","ord":"a0","title":"house"}\n' > "$work/vault/house.olai"

olai_serve "$root" "$work/vault" "$work/server.log"
trap 'kill "$OLAI_SERVER" 2>/dev/null || true; rm -rf "$work"' EXIT

SESSION="${SESSION:-preview}" LABEL="$label" BASE="$OLAI_URL" VAULT="$work/vault" \
  bun wire.ts
