#!/usr/bin/env bash
# Measure one edit-while-previewing session against a WORKTREE's own server.
#
#   ROOT=/path/to/a/worktree LABEL=before PORT=7802 bash wire.sh
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
# How a server is stood up is `support/serve.sh`'s, shared with evidence.sh:
# one spelling of the boot, so a driver cannot end up measuring a server that
# was never started.
set -euo pipefail

. support/serve.sh

root=${ROOT:-$(cd ../.. && pwd)}
port=${PORT:-7802}
label=${LABEL:-$(basename "$root")}

olai_port_free "$port" "the numbers"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/vault"
# One outline, so the app has a tree to draw and the session is an ordinary one
# rather than a directory with nothing in it. The measured files are the
# driver's own.
printf '{"id":"house","ord":"a0","title":"house"}\n' > "$work/vault/house.olai"

olai_serve "$root" "$work/vault" "$port" "$work/server.log"
trap 'kill "$OLAI_SERVER" 2>/dev/null || true; rm -rf "$work"' EXIT

LABEL="$label" BASE="http://127.0.0.1:$port" VAULT="$work/vault" bun wire.ts
