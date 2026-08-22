#!/usr/bin/env bash
# Photograph the manifest/heads skew window against a WORKTREE's own client —
# see skew.ts for which frame is held and what the three shots are of.
#
#   SHOTS=/tmp/shots bash skew.sh
#   ROOT=/path/to/a/worktree LABEL=before SHOTS=/tmp/shots bash skew.sh
#   HOLD_MS=15000 WINDOW_MS=5000 …   # a longer window (optional)
#   PORT=7803 …                      # pin a port (optional; the default asks the OS)
#
# Expects to be run from packages/tests, inside `nix develop .#e2e`, with the
# named worktree's client already built there (`just build-client` in it).
#
# ROOT is the knob, exactly as in wire.sh: the driver imports no olai package,
# so the same held frame and the same repair are delivered to this branch's
# client and to master's, and the two runs are of the same window. The BEFORE
# and AFTER of `manifest-fold-skew` were taken that way.
#
# `--seed` runs BEFORE the server, and it has to: the boot this photographs is
# a boot over a set that never validated, so the refused files must already be
# on disk when the store first probes — an empty directory is a valid set and
# would boot to a directory. Both states of the vault are skew.ts's, so there
# is one spelling of them and the repair cannot drift from what was refused.
#
# How a server is stood up is `support/serve.sh`'s, shared with evidence.sh
# and wire.sh.
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
